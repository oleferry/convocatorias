// ================================================================
//  Matching por reglas (espejo CommonJS de lib/matching.ts)
//  Criterio v1: CCAA + abierta + PLAZO REAL + sector.
//  Usado por el digest semanal. Mantener sincronizado con lib/matching.ts.
// ================================================================

function strip(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const TIPO_BENEF_PATTERNS = {
  pyme:         /pyme|peque|mediana empresa|empresa/,
  autonomo:     /persona.?fisica|autonomo|trabajador.?aut/,
  gran_empresa: /gran(des)? empresa|empresa/,
  asociacion:   /sin animo|asociaci|entidad.*no.*lucr|juridica.*no desarrolla/,
  fundacion:    /fundaci|sin animo|juridica.*no desarrolla/,
  cooperativa:  /cooperativa|economia social/,
  otro:         /./,
}

function tokens(s) {
  return strip(s || '').split(/[^a-z0-9+]+/).filter(t => t.length >= 4)
}

// c = fila de convocatorias_publicas (snake_case) · org = fila de organizations
function matchGrant(c, org, todayISO) {
  const reasons = []

  // Filtros duros: abierta, con plazo de solicitud REAL y futuro
  const open = !!c.abierto && !!c.fecha_fin && c.fecha_fin >= todayISO
  if (!open) return { match: false, score: 0, reasons: [] }

  const estatal = (c.nivel1 || '').toUpperCase() === 'ESTATAL'
  const regionOk = estatal || (!!c.ccaa && c.ccaa === org.ccaa)
  if (!regionOk) return { match: false, score: 0, reasons: [] }
  reasons.push(estatal ? 'Ámbito estatal' : `Tu CCAA (${org.ccaa})`)

  let score = 20

  // Sector (CNAE, admite varios)
  let sectorMatch = false
  const divs = new Set()
  for (const code of (org.cnaes || [])) { const d = String(code).replace(/\D/g, '').slice(0, 2); if (d) divs.add(d) }
  if (org.cnae) { const d = org.cnae.replace(/\D/g, '').slice(0, 2); if (d) divs.add(d) }
  const hasSectores = !!(c.sectores && c.sectores.length)
  if (divs.size && hasSectores) {
    sectorMatch = c.sectores.some(s => divs.has((s.codigo || '').slice(0, 2)))
    if (sectorMatch) { score += 40; reasons.push('Sector CNAE coincide') }
  }

  // Tipo de beneficiario
  let benefMatch = false
  const hasBenef = !!(c.beneficiarios && c.beneficiarios.length)
  if (hasBenef) {
    const re = TIPO_BENEF_PATTERNS[org.tipo_entidad] || TIPO_BENEF_PATTERNS.otro
    benefMatch = c.beneficiarios.some(b => re.test(strip(b)))
    if (benefMatch) { score += 25; reasons.push('Encaja con tu tipo de entidad') }
  }

  // Keywords / actividad
  const profileTokens = new Set([...tokens(org.keywords), ...tokens(org.actividad)])
  let kwHits = 0
  if (profileTokens.size) {
    const hay = strip([
      c.titulo, c.finalidad,
      ...(c.sectores || []).map(s => s.descripcion),
      ...(c.beneficiarios || []),
    ].join(' '))
    for (const t of profileTokens) if (hay.includes(t)) kwHits++
    if (kwHits > 0) { score += Math.min(25, kwHits * 8); reasons.push(`${kwHits} palabra(s) clave`) }
  }

  const sectorJudgeable = (divs.size > 0 && hasSectores) || hasBenef || profileTokens.size > 0
  const relevant = sectorMatch || benefMatch || kwHits > 0
  const match = sectorJudgeable ? relevant : true

  return { match, score: Math.min(100, score), reasons }
}

function formatEuro(n) {
  if (n == null) return '—'
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'
}

module.exports = { matchGrant, formatEuro }
