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
  ayudaEstado?: string | null
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
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`BDNS ${path} → ${res.status}`)
  return res.json()
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

/** Devuelve el nombre estándar de CCAA, o null si es estatal/no identificable. */
export function normalizeCcaa(nivel1?: string, nivel2?: string): string | null {
  if (!nivel2) return null
  if ((nivel1 || '').toUpperCase() === 'ESTATAL') return null
  const norm = nivel2
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  for (const [re, name] of CCAA_MATCHERS) if (re.test(norm)) return name
  return null
}

// ── Normalizador detalle → fila de catálogo ────────────────────
export function normalizeDetail(d: BdnsDetail): ConvocatoriaPublicaRow {
  const nivel1 = d.organo?.nivel1 || null
  const ccaaRaw = d.organo?.nivel2 || null
  let ccaa = normalizeCcaa(nivel1 || undefined, ccaaRaw || undefined)
  let provincia: string | null = null
  // Sub-estatal cuyo nivel2 no es un nombre de CCAA (típico de LOCAL: municipio
  // o "Diputación de X"): resolvemos provincia/CCAA vía el catálogo INE.
  if (!ccaa && (nivel1 || '').toUpperCase() !== 'ESTATAL') {
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
    fecha_fin: d.fechaFinSolicitud || null,
    fecha_recepcion: d.fechaRecepcion || null,
  }
}
