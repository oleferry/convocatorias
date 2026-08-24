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
import { regionScopeFromRegiones } from './geo'

export interface PublicGrantRow {
  codigo_bdns: string
  titulo: string
  tipo_convocatoria: string | null
  nivel1: string | null
  ccaa: string | null
  provincia?: string | null
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
  resumen_periodista?: string | null
  importe_beneficiario?: string | null
}

// tier: 'sector' = afín a tu CNAE/IAE/actividad. Provincia y tipo de entidad
// (pyme/autónomo…) son filtro duro, pero no bastan por sí solos para sugerir.
export type MatchTier = 'sector'
export interface MatchResult { match: boolean; score: number; reasons: string[]; tier: MatchTier | null }

export function strip(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function tokens(s?: string | null): string[] {
  return strip(s || '')
    .split(/[^a-z0-9+]+/)
    .filter(t => t.length >= 4)
}

// Palabras demasiado genéricas para servir de keyword discriminante.
export const STOP_TOKENS = new Set([
  'comercio', 'menor', 'mayor', 'establecimientos', 'especializados', 'productos',
  'otros', 'otras', 'actividad', 'actividades', 'servicios', 'empresa', 'empresas',
  'general', 'varios', 'diversos',
])

// CNAE: división (2 dígitos) → letra de sección. La BDNS etiqueta los sectores
// unas veces con el número de división (47) y otras con la letra (G=comercio).
export function sectionLetter(div: string): string | null {
  const n = parseInt(div, 10); if (isNaN(n)) return null
  if (n <= 3) return 'A'; if (n <= 9) return 'B'; if (n <= 33) return 'C'; if (n === 35) return 'D'
  if (n <= 39) return 'E'; if (n <= 43) return 'F'; if (n <= 47) return 'G'; if (n <= 53) return 'H'
  if (n <= 56) return 'I'; if (n <= 63) return 'J'; if (n <= 66) return 'K'; if (n === 68) return 'L'
  if (n <= 75) return 'M'; if (n <= 82) return 'N'; if (n === 84) return 'O'; if (n === 85) return 'P'
  if (n <= 88) return 'Q'; if (n <= 93) return 'R'; if (n <= 96) return 'S'; if (n <= 98) return 'T'; return 'U'
}

// IAE profesionales (sección 2ª, prefijo "P") y artísticas (sección 3ª,
// prefijo "A") NO siguen la numeración de la sección empresarial: sus dígitos
// significan otra cosa. Mapearlos por el 1er dígito como si fueran
// empresariales clasificaba a un abogado como "transporte" y a un arquitecto
// o un médico como "industria manufacturera" — con falsos positivos reales
// (un arquitecto encajando con premios de panadería, ambos letra C).
const IAE_ESPECIALES: Record<string, string> = {
  P411:  'Q',  // Médicos
  P421:  'Q',  // Odontólogos
  P451:  'M',  // Veterinarios (CNAE 75 → M)
  P460:  'Q',  // Fisioterapeutas, ópticos y otros sanitarios
  P321:  'M',  // Ingenieros
  P411A: 'M',  // Arquitectos y aparejadores
  P731:  'M',  // Abogados
  P741:  'M',  // Economistas, contables
  P742:  'M',  // Graduados sociales, gestores administrativos
  P751:  'M',  // Publicidad y relaciones públicas
  P763:  'J',  // Programadores y analistas informáticos (CNAE 62 → J)
  P776:  'M',  // Doctores, licenciados, técnicos y consultores
  P861:  'R',  // Pintores, escultores, ceramistas y artesanos
  A011:  'R',  // Actores
  A032:  'R',  // Cantantes, músicos
  A041:  'R',  // Maestros y directores de música
}

// IAE: división (1er dígito del epígrafe, sección empresarial) → letra de sección
// CNAE aproximada, para que elegir IAE también alimente el cruce por sector.
function iaeSectionLetter(epigrafe: string): string | null {
  const code = String(epigrafe || '').trim().toUpperCase()
  if (IAE_ESPECIALES[code]) return IAE_ESPECIALES[code]
  // Cualquier otro código profesional/artístico no listado: no arriesgamos un
  // mapeo empresarial equivocado, mejor ninguna señal que una falsa.
  if (/^[PA]/.test(code)) return null
  const d = code.replace(/\D/g, '')[0]
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
    // "PERSONAS JURÍDICAS" = sociedades (nunca autónomos, que son persona
    // física) · "PERSONA FÍSICA" a secas = puede ser autónomo, nunca una
    // sociedad. Sin esto, "personas jurídicas que desarrollan actividad
    // económica" colaba como match genérico para un autónomo, y viceversa.
    const soloJuridica = s.includes('personas juridicas') && !s.includes('persona fisica') && !s.includes('personas fisicas')
    const soloFisica = (s.includes('persona fisica') || s.includes('personas fisicas')) && !s.includes('personas juridicas') && !s.includes('persona juridica')
    if (tipo === 'pyme') {
      if (s.includes('pyme') || s.includes('microempresa') || s.includes('pequena') || s.includes('mediana')) return true
      if (s.includes('desarrollan actividad econ') && !noEcon && !soloFisica) return true
    }
    if (tipo === 'gran_empresa') {
      if (s.includes('gran empresa') || s.includes('grandes empresas')) return true
      if (s.includes('desarrollan actividad econ') && !noEcon && !soloFisica) return true
    }
    if (tipo === 'autonomo') {
      if (s.includes('pyme')) return true
      if ((/aut[oó]nom/.test(s) || s.includes('persona fisica') || s.includes('personas fisicas')) && !noEcon) return true
      if (s.includes('desarrollan actividad econ') && !noEcon && !soloJuridica) return true
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

// "Concesión directa" (canónica/instrumental/por convenio/por ley...) es un
// pago ya adjudicado por nombre a una entidad concreta (un ayuntamiento y "su"
// asociación vecinal, "su" club deportivo...) — no es una convocatoria abierta
// a la que cualquier otra empresa pueda presentarse, aunque coincida provincia,
// sector o beneficiario. "Concurrencia competitiva" (y la ausencia del campo,
// típica del radar/privados) sí son abiertas.
export function esConcesionDirecta(tipoConvocatoria?: string | null): boolean {
  return strip(tipoConvocatoria || '').includes('concesion directa')
}

/** Evalúa si una convocatoria pública encaja con un perfil. */
export function matchGrant(c: PublicGrantRow, org: Organization, todayISO: string): MatchResult {
  const reasons: string[] = []

  // ── Filtros duros ──
  if (esConcesionDirecta(c.tipo_convocatoria)) return { match: false, score: 0, reasons: [], tier: null }

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

    // Alcance REAL por NUTS (c.regiones) — más fiable que nivel1: hay programas
    // etiquetados "AUTONOMICA" por la BDNS que en realidad están acotados a una
    // comarca/provincia (ej. "Nordeste de Segovia"). Si la tuya no está entre
    // las provincias listadas, fuera — sea AUTONOMICA o LOCAL.
    const prov = strip(org.provincia || ''); const muni = strip(org.municipio || '')
    const scope = regionScopeFromRegiones(c.regiones)
    if (!scope.wide && scope.provincias.length && prov) {
      if (!scope.provincias.some(p => strip(p) === prov)) return { match: false, score: 0, reasons: [], tier: null }
    }

    const isLocal = (c.nivel1 || '').toUpperCase() === 'LOCAL'
    if (isLocal) {
      // Además, para LOCAL exigimos que el organismo (ayuntamiento concreto) sea
      // el tuyo — dos pueblos de la misma provincia no deben mezclarse.
      const cProv = strip(c.provincia || ''); const organoTxt = strip(c.organo || '')
      const muniHit = !!muni && organoTxt.includes(muni)
      const provHit = !!prov && (cProv === prov || organoTxt.includes(prov))
      if (!muniHit && !provHit) {
        if (prov || muni) return { match: false, score: 0, reasons: [], tier: null } // local de OTRA zona
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

  // Filtro duro: si la BDNS especifica un beneficiario concreto (lista corta,
  // no genérica) y tu tipo de entidad no encaja, fuera — da igual que
  // coincidan sector o palabras clave. Evita que una ayuda solo para
  // sociedades le llegue a un autónomo, o al revés. Con el radar (privados/
  // europeos) el dato de beneficiario es demasiado impreciso ("pymes" para
  // casi todo) para usarlo como filtro duro, así que ahí no se aplica.
  const benefList = c.beneficiarios || []
  const benefEspecifico = benefList.length > 0 && benefList.length <= 5
  if (!isRadar && benefEspecifico && !benefMatch) return { match: false, score: 0, reasons: [], tier: null }

  // ── Señal 3: keywords (keywords + actividad + descripción CNAE/IAE) ──
  // La CCAA/provincia/municipio del perfil casi siempre aparecen también en el
  // texto de la convocatoria (es NORMAL que una convocatoria de Valladolid
  // diga "Valladolid") — pero eso ya se exigió arriba como filtro duro, así
  // que contarlo TAMBIÉN como "palabra clave de tu sector" es una coincidencia
  // vacía, no una señal real de afinidad. Se descarta del set de keywords.
  const profileTokens = new Set([...tokens(org.keywords), ...tokens(org.actividad), ...tokens(org.cnae_desc), ...tokens(org.iae_desc)])
  for (const t of STOP_TOKENS) profileTokens.delete(t)
  for (const geo of [org.ccaa, org.provincia, org.municipio]) for (const t of tokens(geo)) profileTokens.delete(t)
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

  // La provincia/CCAA y el tipo de beneficiario (pyme/autónomo…) ya se exigieron
  // arriba como filtro duro, pero por sí solos NO son señal suficiente: sin
  // coincidencia real de sector (CNAE/IAE) o palabra clave de tu actividad, no
  // se sugiere. "Encaja con tu tipo de entidad" solo suma puntos si ya hay
  // señal de sector — no basta para hacer match por sí sola.
  const tier: MatchTier | null = (sectorMatch || kwHits > 0) ? 'sector' : null
  return { match: tier !== null, score: Math.min(100, score), reasons, tier }
}

// Coletillas finales de trámite (región/año) que no aportan a "qué es esto" —
// la región/CCAA ya se ve en otro sitio de la tarjeta, así que repetirla en el
// título solo lo alarga sin dar información nueva.
const TRAILING_BOILERPLATE = [
  /,?\s*(en|para)\s+la\s+(comunidad( aut[oó]noma)?|ciudad|provincia)\s+de\s+[\wÀ-ÿ][\wÀ-ÿ\s]*$/i,
  /,?\s*en\s+el\s+[aá]mbito\s+de\s+[\wÀ-ÿ][\wÀ-ÿ\s]*$/i,
  /,?\s*(para|durante|correspondientes?\s+a)\s+el\s+(año|ejercicio)\s+\d{4}\.?$/i,
  /,?\s*\d{4}\.?$/,
]

// Resume el título oficial de la BDNS (un ladrillo tipo "Resolución de … por la
// que se aprueba la convocatoria para la concesión de subvenciones destinadas a
// X, en la Comunidad de Y, para el año Z") y se queda con el núcleo: "Subvenciones
// destinadas a X" — sin inventar nada, solo recortando boilerplate conocido.
export function tituloCorto(t: string | null | undefined): string {
  let s = (t || '').replace(/\s+/g, ' ').trim()
  const m = s.match(/(subvenci\w*|ayudas?\b|becas?\b|premios?\b|l[ií]neas? de ayuda|bono\w*)[\s\S]*/i)
  if (m) s = m[0].trim()

  let changed = true
  while (changed) {
    changed = false
    for (const re of TRAILING_BOILERPLATE) {
      const next = s.replace(re, '').trim()
      // No recortar si deja el título demasiado corto para tener sentido.
      if (next !== s && next.length >= 20) { s = next; changed = true }
    }
  }

  s = s.replace(/[\s,;.:]+$/, '')
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1)
  if (s.length > 120) s = s.slice(0, 117).replace(/\s+\S*$/, '') + '…'
  return s || (t || '')
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
  // importe_beneficiario (si el resumen periodístico lo pudo determinar) es el
  // importe REAL por beneficiario; presupuesto_total es el total de toda la
  // convocatoria — solo lo usamos de respaldo, marcado como tal.
  const importeReal = c.importe_beneficiario || null
  return {
    org_id: orgId,
    titulo: tituloCorto(c.titulo),
    organismo: c.organo || (c.nivel1 ? c.nivel1 : ''),
    tipo,
    ambito,
    importe_max: importeReal || formatEuro(c.presupuesto_total),
    importe_es_total: !importeReal && c.presupuesto_total != null,
    plazo_solicitud: c.fecha_fin,
    fecha_publicacion: c.fecha_inicio,
    resumen: c.resumen_periodista || (c.finalidad ? `Finalidad: ${c.finalidad}.` : ''),
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
