// ================================================================
//  Matching por reglas: catálogo BDNS ↔ perfil de empresa  (v2)
//   • Filtros DUROS: estatal o de la CCAA del perfil, y abierta (plazo futuro).
//   • Relevancia (exige al menos UNA señal real, sin "comodín"):
//       - Sector: división CNAE numérica (47) Y letra de sección (G), porque
//         la BDNS mezcla ambos formatos. Listas enormes (= "todos los sectores")
//         no cuentan como señal.
//       - Beneficiario: cruza tipo de entidad, excluyendo "NO desarrollan
//         actividad económica".
//       - Keywords: keywords + actividad + descripción CNAE/IAE (auto-derivadas).
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

// tier: 'sector' = afín a tu CNAE/IAE/actividad · 'elegible' = abierta a tu tipo
// de entidad (pyme/autónomo…) en tu zona, aunque no sea específica de tu sector.
export type MatchTier = 'sector' | 'elegible'
export interface MatchResult { match: boolean; score: number; reasons: string[]; tier: MatchTier | null }

function strip(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function tokens(s?: string | null): string[] {
  return strip(s || '')
    .split(/[^a-z0-9+]+/)
    .filter(t => t.length >= 4)
}

// Palabras demasiado genéricas para servir de keyword discriminante.
const STOP_TOKENS = new Set([
  'comercio', 'menor', 'mayor', 'establecimientos', 'especializados', 'productos',
  'otros', 'otras', 'actividad', 'actividades', 'servicios', 'empresa', 'empresas',
  'general', 'varios', 'diversos',
])

// CNAE: división (2 dígitos) → letra de sección. La BDNS etiqueta los sectores
// unas veces con el número de división (47) y otras con la letra (G=comercio).
function sectionLetter(div: string): string | null {
  const n = parseInt(div, 10); if (isNaN(n)) return null
  if (n <= 3) return 'A'; if (n <= 9) return 'B'; if (n <= 33) return 'C'; if (n === 35) return 'D'
  if (n <= 39) return 'E'; if (n <= 43) return 'F'; if (n <= 47) return 'G'; if (n <= 53) return 'H'
  if (n <= 56) return 'I'; if (n <= 63) return 'J'; if (n <= 66) return 'K'; if (n === 68) return 'L'
  if (n <= 75) return 'M'; if (n <= 82) return 'N'; if (n === 84) return 'O'; if (n === 85) return 'P'
  if (n <= 88) return 'Q'; if (n <= 93) return 'R'; if (n <= 96) return 'S'; if (n <= 98) return 'T'; return 'U'
}

// IAE: división (1er dígito del epígrafe, sección empresarial) → letra de sección
// CNAE aproximada, para que elegir IAE también alimente el cruce por sector.
function iaeSectionLetter(epigrafe: string): string | null {
  const d = String(epigrafe).replace(/\D/g, '')[0]
  switch (d) {
    case '0': return 'A'   // ganadería independiente
    case '1': return 'B'   // energía y agua
    case '2': return 'C'   // extracción/transformación, química
    case '3': return 'C'   // industrias transformadoras de metales
    case '4': return 'C'   // otras manufactureras (alimentación, textil…)
    case '5': return 'F'   // construcción
    case '6': return 'G'   // comercio, restaurantes, hospedaje, reparaciones
    case '7': return 'H'   // transporte y comunicaciones
    case '8': return 'K'   // finanzas, seguros, servicios a empresas
    case '9': return 'R'   // otros servicios
    default:  return null
  }
}

/** ¿La convocatoria va dirigida a un beneficiario de este tipo de entidad? */
function beneficiarioEncaja(benefArr: string[] | null | undefined, tipo: string): boolean {
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

/** Evalúa si una convocatoria pública encaja con un perfil. */
export function matchGrant(c: PublicGrantRow, org: Organization, todayISO: string): MatchResult {
  const reasons: string[] = []

  // ── Filtros duros ──
  // El flag 'abierto' de la BDNS es poco fiable (casi siempre false): usamos el
  // PLAZO de solicitud. El radar (privadas/europeas) no trae plazo fijo aquí.
  const isRadar = !!c.fuente && c.fuente !== 'bdns'
  const open = isRadar || (!!c.fecha_fin && c.fecha_fin >= todayISO)
  if (!open) return { match: false, score: 0, reasons: [], tier: null }

  const estatal = (c.nivel1 || '').toUpperCase() === 'ESTATAL'
  let score = 10 // base por superar región + abierta

  if (estatal) {
    reasons.push('Ámbito estatal')
  } else {
    // Sub-estatal: primero la CCAA debe coincidir.
    if (!c.ccaa || c.ccaa !== org.ccaa) return { match: false, score: 0, reasons: [], tier: null }
    // ¿La ayuda está acotada a una provincia/localidad concreta?
    const prov = strip(org.provincia || ''); const muni = strip(org.municipio || '')
    const hayLoc = strip([c.organo, ...((c.regiones as any) || [])].join(' '))
    const nuts3 = ((c.regiones as any) || []).some((r: string) => /\bES\d{3}\b/i.test(r))
    const localOrg = /ayuntamiento|diputaci|comarca|municipal|concejo|cabildo|consell insular|mancomunidad/.test(hayLoc)
    const provinceSpecific = nuts3 || localOrg
    if (provinceSpecific && (prov || muni)) {
      const muniHit = !!muni && hayLoc.includes(muni)
      const provHit = !!prov && hayLoc.includes(prov)
      if (!muniHit && !provHit) return { match: false, score: 0, reasons: [], tier: null } // local de OTRA zona
      score += 15; reasons.push(muniHit ? `Tu municipio (${org.municipio})` : `Tu provincia (${org.provincia})`)
    } else {
      reasons.push(`Tu CCAA (${org.ccaa})`)
    }
  }

  // ── Divisiones y letras de sección del perfil (CNAE + IAE) ──
  const divs = new Set<string>()
  const letters = new Set<string>()
  const addCnae = (v: any) => { const d = String(v).replace(/\D/g, '').slice(0, 2); if (d) { divs.add(d); const L = sectionLetter(d); if (L) letters.add(L) } }
  for (const code of (org.cnaes || [])) addCnae(code)
  if (org.cnae) addCnae(org.cnae)
  for (const ep of (org.iaes || [])) { const L = iaeSectionLetter(ep); if (L) letters.add(L) }
  if (org.iae) { const L = iaeSectionLetter(org.iae); if (L) letters.add(L) }

  // ── Señal 1: sector (división numérica o letra). Listas ≥ 9 = "todos" ⇒ no cuenta ──
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

  // ── Señal 2: tipo de beneficiario ──
  const benefMatch = beneficiarioEncaja(c.beneficiarios, org.tipo_entidad)
  if (benefMatch) { score += 25; reasons.push('Encaja con tu tipo de entidad') }

  // ── Señal 3: keywords (keywords + actividad + descripción CNAE/IAE) ──
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

  // Dos niveles:
  //  • 'sector'   → coincide tu CNAE/IAE o una palabra clave de tu actividad.
  //  • 'elegible' → no es de tu sector, pero está abierta a tu tipo de entidad
  //                 (pyme/autónomo…) y en tu zona: podrías optar igualmente.
  const tier: MatchTier | null = (sectorMatch || kwHits > 0) ? 'sector' : (benefMatch ? 'elegible' : null)
  return { match: tier !== null, score: Math.min(100, score), reasons, tier }
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
