// ================================================================
//  Matching por reglas (espejo CommonJS de lib/matching.ts) — v2
//  Mantener sincronizado con lib/matching.ts y lib/geo.ts.
// ================================================================
const provincias = require('./data/provincias.json')

function strip(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normKey(s) {
  return strip(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).sort().join('-')
}
const PROVINCIA_BY_KEY = new Map(provincias.map(p => [normKey(p.n), p]))
function provinciaFromName(name) {
  const p = PROVINCIA_BY_KEY.get(normKey(name))
  return p ? { provincia: p.n, ccaa: p.ccaa } : null
}

// Alcance geográfico real por NUTS de `regiones` (espejo de lib/geo.ts).
function regionScopeFromRegiones(regiones) {
  const list = (regiones || []).filter(Boolean)
  if (!list.length) return { wide: true, provincias: [] }
  const provs = []
  for (const r of list) {
    const m = /^(ES\d*)\s*-\s*(.+)$/i.exec(r.trim())
    const code = m ? m[1] : r.trim()
    const digits = (/^ES(\d*)/i.exec(code) || [])[1]?.length || 0
    if (digits <= 2) return { wide: true, provincias: [] }
    if (m) { const g = provinciaFromName(m[2]); if (g) provs.push(g.provincia) }
  }
  return { wide: provs.length === 0, provincias: [...new Set(provs)] }
}

function tokens(s) {
  return strip(s || '').split(/[^a-z0-9+]+/).filter(t => t.length >= 4)
}

const STOP_TOKENS = new Set([
  'comercio', 'menor', 'mayor', 'establecimientos', 'especializados', 'productos',
  'otros', 'otras', 'actividad', 'actividades', 'servicios', 'empresa', 'empresas',
  'general', 'varios', 'diversos',
])

function sectionLetter(div) {
  const n = parseInt(div, 10); if (isNaN(n)) return null
  if (n <= 3) return 'A'; if (n <= 9) return 'B'; if (n <= 33) return 'C'; if (n === 35) return 'D'
  if (n <= 39) return 'E'; if (n <= 43) return 'F'; if (n <= 47) return 'G'; if (n <= 53) return 'H'
  if (n <= 56) return 'I'; if (n <= 63) return 'J'; if (n <= 66) return 'K'; if (n === 68) return 'L'
  if (n <= 75) return 'M'; if (n <= 82) return 'N'; if (n === 84) return 'O'; if (n === 85) return 'P'
  if (n <= 88) return 'Q'; if (n <= 93) return 'R'; if (n <= 96) return 'S'; if (n <= 98) return 'T'; return 'U'
}

function iaeSectionLetter(epigrafe) {
  const d = String(epigrafe).replace(/\D/g, '')[0]
  switch (d) {
    case '0': return 'A'
    case '1': return 'B'
    case '2': return 'C'
    case '3': return 'C'
    case '4': return 'C'
    case '5': return 'F'
    case '6': return 'G'
    case '7': return 'H'
    case '8': return 'K'
    case '9': return 'R'
    default: return null
  }
}

function beneficiarioEncaja(benefArr, tipo) {
  for (const b of (benefArr || [])) {
    const s = strip(b)
    const noEcon = s.includes('no desarrollan')
    if (tipo === 'pyme' || tipo === 'gran_empresa') {
      if (s.includes('pyme') || s.includes('microempresa')) return true
      if (s.includes('desarrollan actividad econ') && !noEcon) return true
    }
    if (tipo === 'autonomo') {
      if (s.includes('pyme')) return true
      if ((/aut[oó]nom/.test(s) || s.includes('persona fisica') || s.includes('personas fisicas')) && !noEcon) return true
      if (s.includes('desarrollan actividad econ') && !noEcon) return true
    }
    if (tipo === 'asociacion' || tipo === 'fundacion') {
      if (s.includes('sin animo') || s.includes('asociaci') || s.includes('fundaci') || s.includes('no lucr') || noEcon) return true
    }
    if (tipo === 'cooperativa') {
      if (s.includes('cooperativa') || s.includes('economia social')) return true
    }
  }
  return false
}

function matchGrant(c, org, todayISO) {
  const reasons = []
  const isRadar = !!c.fuente && c.fuente !== 'bdns'
  const open = isRadar || (!!c.fecha_fin && c.fecha_fin >= todayISO)
  if (!open) return { match: false, score: 0, reasons: [], tier: null }

  const estatal = (c.nivel1 || '').toUpperCase() === 'ESTATAL'
  let score = 10

  if (estatal) {
    reasons.push('Ámbito estatal')
  } else {
    if (!c.ccaa || c.ccaa !== org.ccaa) return { match: false, score: 0, reasons: [], tier: null }

    // Alcance real por NUTS (independiente de si BDNS la marca AUTONOMICA o LOCAL).
    const prov = strip(org.provincia || ''), muni = strip(org.municipio || '')
    const scope = regionScopeFromRegiones(c.regiones)
    if (!scope.wide && scope.provincias.length && prov) {
      if (!scope.provincias.some(p => strip(p) === prov)) return { match: false, score: 0, reasons: [], tier: null }
    }

    const isLocal = (c.nivel1 || '').toUpperCase() === 'LOCAL'
    if (isLocal) {
      const cProv = strip(c.provincia || ''), organoTxt = strip(c.organo || '')
      const muniHit = !!muni && organoTxt.includes(muni)
      const provHit = !!prov && (cProv === prov || organoTxt.includes(prov))
      if (!muniHit && !provHit) {
        if (prov || muni) return { match: false, score: 0, reasons: [], tier: null }
        reasons.push(`Tu CCAA (${org.ccaa})`)
      } else {
        score += 15; reasons.push(muniHit ? `Tu municipio (${org.municipio})` : `Tu provincia (${org.provincia})`)
      }
    } else if (!scope.wide && scope.provincias.length && prov) {
      score += 15; reasons.push(`Tu provincia (${org.provincia})`)
    } else {
      reasons.push(`Tu CCAA (${org.ccaa})`)
    }
  }

  const divs = new Set(), letters = new Set()
  const addCnae = v => { const d = String(v).replace(/\D/g, '').slice(0, 2); if (d) { divs.add(d); const L = sectionLetter(d); if (L) letters.add(L) } }
  for (const code of (org.cnaes || [])) addCnae(code)
  if (org.cnae) addCnae(org.cnae)
  for (const ep of (org.iaes || [])) { const L = iaeSectionLetter(ep); if (L) letters.add(L) }
  if (org.iae) { const L = iaeSectionLetter(org.iae); if (L) letters.add(L) }

  let sectorMatch = false
  const sect = c.sectores || []
  const focused = sect.length > 0 && sect.length <= 8
  if (focused && (divs.size || letters.size)) {
    for (const s of sect) {
      const code = (s.codigo || '').trim()
      if (/^\d/.test(code)) {
        const d = code.replace(/\D/g, '').slice(0, 2)
        if (divs.has(d) || letters.has(sectionLetter(d) || '')) { sectorMatch = true; break }
      } else if (letters.has(code.slice(0, 1).toUpperCase())) { sectorMatch = true; break }
    }
  }
  if (sectorMatch) { score += 45; reasons.push('Tu sector encaja') }

  const benefMatch = beneficiarioEncaja(c.beneficiarios, org.tipo_entidad)
  if (benefMatch) { score += 25; reasons.push('Encaja con tu tipo de entidad') }

  const profileTokens = new Set([...tokens(org.keywords), ...tokens(org.actividad), ...tokens(org.cnae_desc), ...tokens(org.iae_desc)])
  for (const t of STOP_TOKENS) profileTokens.delete(t)
  let kwHits = 0
  if (profileTokens.size) {
    const hay = strip([
      c.titulo, c.finalidad,
      ...(c.sectores || []).map(s => s.descripcion),
      ...(c.beneficiarios || []),
    ].join(' '))
    for (const t of profileTokens) if (hay.includes(t)) kwHits++
    if (kwHits > 0) { score += Math.min(30, kwHits * 12); reasons.push(`${kwHits} palabra(s) clave`) }
  }

  const tier = (sectorMatch || kwHits > 0) ? 'sector' : (benefMatch && !isRadar ? 'elegible' : null)
  return { match: tier !== null, score: Math.min(100, score), reasons, tier }
}

function formatEuro(n) {
  if (n == null) return '—'
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'
}

// Coletillas finales de trámite (región/año) — espejo de lib/matching.ts.
const TRAILING_BOILERPLATE = [
  /,?\s*(en|para)\s+la\s+(comunidad( aut[oó]noma)?|ciudad|provincia)\s+de\s+[\wÀ-ÿ][\wÀ-ÿ\s]*$/i,
  /,?\s*en\s+el\s+[aá]mbito\s+de\s+[\wÀ-ÿ][\wÀ-ÿ\s]*$/i,
  /,?\s*(para|durante|correspondientes?\s+a)\s+el\s+(año|ejercicio)\s+\d{4}\.?$/i,
  /,?\s*\d{4}\.?$/,
]

// Resume el título oficial (espejo de lib/matching.ts → tituloCorto).
function tituloCorto(t) {
  let s = (t || '').replace(/\s+/g, ' ').trim()
  const m = s.match(/(subvenci\w*|ayudas?\b|becas?\b|premios?\b|l[ií]neas? de ayuda|bono\w*)[\s\S]*/i)
  if (m) s = m[0].trim()

  let changed = true
  while (changed) {
    changed = false
    for (const re of TRAILING_BOILERPLATE) {
      const next = s.replace(re, '').trim()
      if (next !== s && next.length >= 20) { s = next; changed = true }
    }
  }

  s = s.replace(/[\s,;.:]+$/, '')
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1)
  if (s.length > 120) s = s.slice(0, 117).replace(/\s+\S*$/, '') + '…'
  return s || (t || '')
}

module.exports = { matchGrant, formatEuro, tituloCorto }
