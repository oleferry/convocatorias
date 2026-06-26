// ================================================================
//  Matching por reglas: catálogo BDNS ↔ perfil de empresa
//  Criterio v1 (decidido con el usuario): CCAA + abierta + sector.
//   • Filtros DUROS: estatal o de la CCAA del perfil, y abierta (plazo futuro).
//   • Relevancia: sector (CNAE), tipo de beneficiario y keywords.
//  Devuelve score 0-100 y razones legibles.
// ================================================================
import type { Organization, GrantAmbito } from './types'

export interface PublicGrantRow {
  codigo_bdns: string
  titulo: string
  tipo_convocatoria: string | null
  nivel1: string | null
  ccaa: string | null
  organo: string | null
  presupuesto_total: number | null
  finalidad: string | null
  beneficiarios: string[] | null
  sectores: { codigo?: string; descripcion: string }[] | null
  regiones: string[] | null
  bases_url: string | null
  abierto: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  fuente?: string | null
}

export interface MatchResult { match: boolean; score: number; reasons: string[] }

function strip(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Patrones por tipo de entidad para cruzar con tiposBeneficiarios de la BDNS
const TIPO_BENEF_PATTERNS: Record<string, RegExp> = {
  pyme:         /pyme|peque|mediana empresa|empresa/,
  autonomo:     /persona.?fisica|autonomo|trabajador.?aut/,
  gran_empresa: /gran(des)? empresa|empresa/,
  asociacion:   /sin animo|asociaci|entidad.*no.*lucr|juridica.*no desarrolla/,
  fundacion:    /fundaci|sin animo|juridica.*no desarrolla/,
  cooperativa:  /cooperativa|economia social/,
  otro:         /./,
}

function tokens(s?: string | null): string[] {
  return strip(s || '')
    .split(/[^a-z0-9+]+/)
    .filter(t => t.length >= 4)
}

/** Evalúa si una convocatoria pública encaja con un perfil. */
export function matchGrant(c: PublicGrantRow, org: Organization, todayISO: string): MatchResult {
  const reasons: string[] = []

  // ── Filtros duros ──
  // BDNS: exigimos plazo de solicitud REAL (descarta concesiones directas).
  // Radar (privadas/europeas): son programas recurrentes sin plazo fijo aquí.
  const isRadar = !!c.fuente && c.fuente !== 'bdns'
  const open = !!c.abierto && (isRadar || (!!c.fecha_fin && c.fecha_fin >= todayISO))
  if (!open) return { match: false, score: 0, reasons: [] }

  const estatal = (c.nivel1 || '').toUpperCase() === 'ESTATAL'
  const regionOk = estatal || (!!c.ccaa && c.ccaa === org.ccaa)
  if (!regionOk) return { match: false, score: 0, reasons: [] }
  reasons.push(estatal ? 'Ámbito estatal' : `Tu CCAA (${org.ccaa})`)

  let score = 20 // base por superar región + abierta

  // ── Relevancia: sector (CNAE, admite varios) ──
  let sectorMatch = false
  const divs = new Set<string>()
  for (const code of (org.cnaes || [])) { const d = String(code).replace(/\D/g, '').slice(0, 2); if (d) divs.add(d) }
  if (org.cnae) { const d = org.cnae.replace(/\D/g, '').slice(0, 2); if (d) divs.add(d) }
  const hasSectores = !!(c.sectores && c.sectores.length)
  if (divs.size && hasSectores) {
    sectorMatch = c.sectores!.some(s => divs.has((s.codigo || '').slice(0, 2)))
    if (sectorMatch) { score += 40; reasons.push('Sector CNAE coincide') }
  }

  // ── Relevancia: tipo de beneficiario ──
  let benefMatch = false
  const hasBenef = !!(c.beneficiarios && c.beneficiarios.length)
  if (hasBenef) {
    const re = TIPO_BENEF_PATTERNS[org.tipo_entidad] || TIPO_BENEF_PATTERNS.otro
    benefMatch = c.beneficiarios!.some(b => re.test(strip(b)))
    if (benefMatch) { score += 25; reasons.push('Encaja con tu tipo de entidad') }
  }

  // ── Relevancia: keywords / actividad ──
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

  // ── ¿Hay datos suficientes para juzgar el sector? ──
  const sectorJudgeable = (divs.size > 0 && hasSectores) || hasBenef || profileTokens.size > 0
  const relevant = sectorMatch || benefMatch || kwHits > 0

  // Criterio "CCAA + abierta + sector": si podemos juzgar la relevancia y nada
  // encaja, se descarta. Si no hay datos para juzgar, se incluye con score bajo.
  const match = sectorJudgeable ? relevant : true

  return { match, score: Math.min(100, score), reasons }
}

// ── Formateo e importación a grants ────────────────────────────
export function formatEuro(n: number | null | undefined): string {
  if (n == null) return ''
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'
}

function ambitoFromNivel(nivel1: string | null): GrantAmbito {
  const n = (nivel1 || '').toUpperCase()
  if (n === 'ESTATAL') return 'nacional'
  if (n === 'LOCAL') return 'local'
  return 'autonómico'
}

/** Construye el objeto grant a insertar al guardar una sugerencia. */
export function publicToGrant(c: PublicGrantRow, orgId: string | null, matchReason?: string) {
  const tipo = c.fuente === 'europea' ? 'europeo' : c.fuente === 'privada' ? 'privada' : 'publica'
  const ambito: GrantAmbito = c.fuente === 'europea' ? 'europeo' : ambitoFromNivel(c.nivel1)
  return {
    org_id: orgId,
    titulo: c.titulo,
    organismo: c.organo || (c.nivel1 ? c.nivel1 : ''),
    tipo,
    ambito,
    importe_max: formatEuro(c.presupuesto_total),
    plazo_solicitud: c.fecha_fin,
    fecha_publicacion: c.fecha_inicio,
    resumen: c.finalidad ? `Finalidad: ${c.finalidad}.` : '',
    elegibilidad: (c.beneficiarios || []).join(', '),
    requisitos: '',
    url: c.bases_url || '',
    url_bases: c.bases_url || '',
    status: 'pendiente' as const,
    prioridad: 2 as const,
    tags: (c.sectores || []).map(s => s.descripcion).slice(0, 3),
    notas: `Importada de la BDNS (${c.codigo_bdns}). ${matchReason || ''}`.trim(),
    source: 'bdns' as const,
    codigo_bdns: c.codigo_bdns,
    auto_found: true,
  }
}
