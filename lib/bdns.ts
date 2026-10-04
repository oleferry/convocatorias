// ================================================================
//  Cliente de la API REST de la BDNS (SNPSAP)
//  Base: https://www.infosubvenciones.es/bdnstrans/api
//  Acceso público, sin autenticación. Verificado 2026-06-24.
//
//  Endpoints usados:
//   • GET /convocatorias/busqueda  → listado paginado (resumen)
//   • GET /convocatorias?numConv=  → detalle completo
//  Fechas en formato dd/mm/yyyy. Paginación estilo Spring (totalPages).
// ================================================================

import { resolveLocalGeo } from './geo'

export const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api'
export const BDNS_VPD = 'GE' // portal general (Gobierno de España)

// ── Tipos de la respuesta ──────────────────────────────────────
export interface BdnsSearchItem {
  id: number
  numeroConvocatoria: string
  descripcion: string
  fechaRecepcion: string // YYYY-MM-DD
  nivel1: string // ESTATAL | AUTONOMICA | LOCAL
  nivel2: string // CCAA u organismo (mayúsculas)
  nivel3: string
  mrr?: boolean
}

export interface BdnsSearchPage {
  content: BdnsSearchItem[]
  totalPages: number
  totalElements: number
  number: number
  size: number
}

export interface BdnsDetail {
  id: number
  codigoBDNS: string
  organo?: { nivel1?: string; nivel2?: string; nivel3?: string }
  sedeElectronica?: string | null
  fechaRecepcion?: string
  tipoConvocatoria?: string
  presupuestoTotal?: number
  mrr?: boolean
  descripcion?: string
  tiposBeneficiarios?: { descripcion: string }[]
  sectores?: { codigo?: string; descripcion: string }[]
  regiones?: { descripcion: string }[]
  descripcionFinalidad?: string
  descripcionBasesReguladoras?: string
  urlBasesReguladoras?: string
  abierto?: boolean
  fechaInicioSolicitud?: string | null
  fechaFinSolicitud?: string | null
  /** El plazo contado en texto: «Hasta el 30-12-2026 o hasta agotar…». */
  textFin?: string | null
  ayudaEstado?: string | null
  anuncios?: { texto?: string }[]
}

// Fila lista para insertar en public.convocatorias_publicas
export interface ConvocatoriaPublicaRow {
  codigo_bdns: string
  id_bdns: number | null
  titulo: string
  tipo_convocatoria: string | null
  nivel1: string | null
  ccaa_raw: string | null
  ccaa: string | null
  provincia: string | null
  organo: string | null
  presupuesto_total: number | null
  finalidad: string | null
  beneficiarios: string[]
  sectores: { codigo?: string; descripcion: string }[]
  regiones: string[]
  bases_desc: string | null
  bases_url: string | null
  sede_url: string | null
  es_ayuda_estado: boolean
  mrr: boolean
  abierto: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  fecha_recepcion: string | null
  anuncio_texto: string | null
}

// ── Utilidades de fecha ────────────────────────────────────────
/** Convierte un Date a dd/mm/yyyy (formato que exige la API BDNS). */
export function toBdnsDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

// ── Llamadas a la API ──────────────────────────────────────────
async function bdnsGet(path: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams({ vpd: BDNS_VPD })
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const url = `${BDNS_BASE}${path}?${qs.toString()}`
  // La BDNS corta con 429 si se le pide deprisa: medido el 04-10-2026, 22 de
  // 120 detalles pedidos con 20 ms de pausa. Sin reintento esas convocatorias
  // se saltaban en silencio y no volvían a mirarse. Se reintenta con espera
  // creciente (1, 2 y 4 s) respetando Retry-After si lo manda.
  for (let intento = 0; ; intento++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) return res.json()
    if (res.status !== 429 || intento >= 3) throw new Error(`BDNS ${path} → ${res.status}`)
    const retryAfter = Number(res.headers.get('retry-after'))
    const espera = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 1000 * 2 ** intento
    await new Promise(r => setTimeout(r, espera))
  }
}

export interface SearchOptions {
  page?: number
  pageSize?: number
  fechaDesde?: Date
  fechaHasta?: Date
  descripcion?: string
  order?: string
  direccion?: 'asc' | 'desc'
}

export async function searchConvocatorias(opts: SearchOptions = {}): Promise<BdnsSearchPage> {
  return bdnsGet('/convocatorias/busqueda', {
    page: opts.page ?? 0,
    pageSize: opts.pageSize ?? 100,
    order: opts.order ?? 'fechaRecepcion',
    direccion: opts.direccion ?? 'desc',
    descripcion: opts.descripcion,
    fechaDesde: opts.fechaDesde ? toBdnsDate(opts.fechaDesde) : undefined,
    fechaHasta: opts.fechaHasta ? toBdnsDate(opts.fechaHasta) : undefined,
  })
}

export async function getConvocatoriaDetail(numConv: string): Promise<BdnsDetail> {
  return bdnsGet('/convocatorias', { numConv })
}

// ── Normalización de CCAA ──────────────────────────────────────
// El campo nivel2 de la BDNS viene en mayúsculas y con nombres oficiales
// ("PRINCIPADO DE ASTURIAS"). Lo mapeamos a los nombres de lib/types CCAA.
const CCAA_MATCHERS: [RegExp, string][] = [
  [/asturias/, 'Asturias'],
  [/cantabr/, 'Cantabria'],
  [/madrid/, 'Madrid'],
  [/andaluc/, 'Andalucía'],
  [/castilla.?la.?mancha|castilla-la mancha/, 'Castilla-La Mancha'],
  [/castilla y le|castilla.?leon/, 'Castilla y León'],
  [/catal|cataluny/, 'Cataluña'],
  [/valencia|valencian/, 'Valencia'],
  [/galicia/, 'Galicia'],
  [/vasco|euskadi/, 'País Vasco'],
  [/navarra/, 'Navarra'],
  [/murcia/, 'Murcia'],
  [/balear/, 'Baleares'],
  [/canaria/, 'Canarias'],
  [/extremadura/, 'Extremadura'],
  [/rioja/, 'La Rioja'],
  [/aragon|aragón/, 'Aragón'],
  [/melilla/, 'Melilla'],
  [/ceuta/, 'Ceuta'],
]

// La BDNS llama "ESTADO" al ámbito nacional, no "ESTATAL". Todo el resto del
// código (matching, sugerencias, digest, /ayudas, bot) compara con 'ESTATAL',
// así que normalizamos AQUÍ, al ingerir: en nuestra base siempre 'ESTATAL'.
// Sin esto, ninguna ayuda estatal de la BDNS entraba en el catálogo — que son
// precisamente las que valen para toda España.
export function esEstatal(nivel1?: string | null): boolean {
  const n = (nivel1 || '').toUpperCase().trim()
  return n === 'ESTATAL' || n === 'ESTADO'
}

export function normalizeNivel1(nivel1?: string | null): string | null {
  if (!nivel1) return null
  return esEstatal(nivel1) ? 'ESTATAL' : nivel1.toUpperCase().trim()
}

/** Devuelve el nombre estándar de CCAA, o null si es estatal/no identificable. */
export function normalizeCcaa(nivel1?: string, nivel2?: string): string | null {
  if (!nivel2) return null
  if (esEstatal(nivel1)) return null
  const norm = nivel2
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  for (const [re, name] of CCAA_MATCHERS) if (re.test(norm)) return name
  return null
}

// Quita etiquetas HTML del texto del anuncio (viene como <p>...</p>) — es
// donde suele estar el importe REAL por beneficiario, a diferencia de
// presupuestoTotal (el total de la partida para toda la convocatoria).
function stripHtml(html?: string | null): string | null {
  if (!html) return null
  const s = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, 4000) : null
}

// ── Fin de plazo escrito en texto ──────────────────────────────
// Muchas convocatorias llegan de la BDNS SIN `fechaFinSolicitud`: el plazo va
// solo en `textFin`, en texto libre. Pasa sobre todo en las que se conceden
// por orden de llegada («hasta el 30-12-2026 o hasta agotar el presupuesto»)
// y en las de organismos «OTROS», como las Cámaras de Comercio — justo las que
// puede pedir una pyme. La ingesta las tiraba todas por no tener fecha: el
// 02-10-2026, Talento Joven de la Cámara de Valladolid (BDNS 905603, 5.000 €
// por joven contratado, abierta hasta el 30-12-2026) no estaba en el catálogo.
//
// Y no vale fiarse de `abierto`: en esa misma convocatoria viene a false.
//
// Se toma la ÚLTIMA fecha completa del texto («desde el 1 de enero hasta el 31
// de marzo de 2027» → 31-03-2027). Si no hay ninguna (p. ej. «veinte días
// hábiles desde la publicación»), null: mejor no tenerla que inventarle un
// plazo.
const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

export function fechaFinDeTexto(texto?: string | null): string | null {
  if (!texto) return null
  const s = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const fechas: { pos: number; iso: string }[] = []
  const iso = (d: number, m: number, y: number) => {
    if (y < 100) y += 2000
    const f = new Date(Date.UTC(y, m - 1, d))
    // Descarta fechas imposibles (31-02) en vez de dejar que Date las arrastre.
    if (f.getUTCFullYear() !== y || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null
    return f.toISOString().slice(0, 10)
  }
  for (const m of s.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/g)) {
    const f = iso(+m[1], +m[2], +m[3]); if (f) fechas.push({ pos: m.index ?? 0, iso: f })
  }
  for (const m of s.matchAll(/\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de|del)\s+(\d{4})\b/g)) {
    const mes = MESES[m[2]]; if (!mes) continue
    const f = iso(+m[1], mes, +m[3]); if (f) fechas.push({ pos: m.index ?? 0, iso: f })
  }
  if (!fechas.length) return null
  fechas.sort((a, b) => a.pos - b.pos)
  return fechas[fechas.length - 1].iso
}

// ── Normalizador detalle → fila de catálogo ────────────────────
export function normalizeDetail(d: BdnsDetail): ConvocatoriaPublicaRow {
  const nivel1 = normalizeNivel1(d.organo?.nivel1)   // ESTADO → ESTATAL
  const ccaaRaw = d.organo?.nivel2 || null
  let ccaa = normalizeCcaa(nivel1 || undefined, ccaaRaw || undefined)
  let provincia: string | null = null
  // Sub-estatal cuyo nivel2 no es un nombre de CCAA (típico de LOCAL: municipio
  // o "Diputación de X"): resolvemos provincia/CCAA vía el catálogo INE.
  if (!ccaa && !esEstatal(nivel1)) {
    const geo = resolveLocalGeo(ccaaRaw, d.organo?.nivel3, (d.regiones || []).map(r => r.descripcion))
    if (geo) { ccaa = geo.ccaa; provincia = geo.provincia }
  }
  return {
    codigo_bdns: d.codigoBDNS || String(d.id),
    id_bdns: d.id ?? null,
    titulo: d.descripcion || '(sin título)',
    tipo_convocatoria: d.tipoConvocatoria || null,
    nivel1,
    ccaa_raw: ccaaRaw,
    ccaa,
    provincia,
    organo: d.organo?.nivel3 || null,
    presupuesto_total: typeof d.presupuestoTotal === 'number' ? d.presupuestoTotal : null,
    finalidad: d.descripcionFinalidad || null,
    beneficiarios: (d.tiposBeneficiarios || []).map(b => b.descripcion).filter(Boolean),
    sectores: (d.sectores || []).map(s => ({ codigo: s.codigo, descripcion: s.descripcion })),
    regiones: (d.regiones || []).map(r => r.descripcion).filter(Boolean),
    bases_desc: d.descripcionBasesReguladoras || null,
    bases_url: d.urlBasesReguladoras || null,
    sede_url: d.sedeElectronica || null,
    es_ayuda_estado: !!d.ayudaEstado,
    mrr: !!d.mrr,
    abierto: !!d.abierto,
    fecha_inicio: d.fechaInicioSolicitud || null,
    fecha_fin: d.fechaFinSolicitud || fechaFinDeTexto(d.textFin),
    fecha_recepcion: d.fechaRecepcion || null,
    anuncio_texto: stripHtml(d.anuncios?.[0]?.texto),
  }
}
