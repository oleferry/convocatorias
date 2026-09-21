// ================================================================
//  Datos para las páginas públicas /ayudas/[ccaa]/[sector]: lee
//  directamente el catálogo `convocatorias_publicas` (lectura pública,
//  sin RLS) — sin coste de IA, es el mismo dato que ya ingiere el cron
//  diario. Pensado para Server Components estáticos/ISR.
// ================================================================
import { createPublicSupabase } from './supabase-server'
import { sectionLetter, esConcesionDirecta } from './matching'
import { tituloCorto, formatEuro } from './matching'
import type { Sector } from './sectores'

export interface PublicGrantCard {
  codigo_bdns: string
  titulo: string
  organo: string | null
  importe: string
  importeEsTotal: boolean
  finalidad: string | null
  fechaFin: string | null
  bases_url: string | null
  fuente: string | null
  sectorLabels: string[]
}

const SELECT_FIELDS = 'codigo_bdns,titulo,tipo_convocatoria,organo,nivel1,ccaa,presupuesto_total,finalidad,beneficiarios,sectores,bases_url,fecha_fin,fecha_inicio,fuente,resumen_periodista,importe_beneficiario'

function isOpen(fecha_fin: string | null, todayISO: string): boolean {
  return !fecha_fin || fecha_fin >= todayISO
}

function toCard(row: any): PublicGrantCard {
  return {
    codigo_bdns: row.codigo_bdns,
    titulo: tituloCorto(row.titulo),
    organo: row.organo,
    importe: row.importe_beneficiario || formatEuro(row.presupuesto_total),
    importeEsTotal: !row.importe_beneficiario && row.presupuesto_total != null,
    finalidad: row.resumen_periodista || row.finalidad,
    fechaFin: row.fecha_fin,
    bases_url: row.bases_url,
    fuente: row.fuente,
    sectorLabels: (row.sectores || []).map((s: any) => s.descripcion).filter(Boolean).slice(0, 3),
  }
}

/**
 * Mínimo de convocatorias propias de su sector para que una página
 * /ayudas/[ccaa]/[sector] se ofrezca a Google (sitemap e índice).
 *
 * Medido el 21-09-2026 sobre la web publicada: las 304 páginas de sector
 * compartían con las demás de su comunidad ~104 convocatorias sin sector y
 * solo tenían una mediana de 3 propias. Google las trataba como copias
 * ("Duplicada: el usuario no ha indicado ninguna versión canónica") y dejaba
 * sin indexar la mayoría. Por debajo de este umbral la página sigue
 * existiendo para quien llega a ella, pero con noindex.
 */
export const MIN_PROPIAS_PARA_INDEXAR = 5

/** ¿La convocatoria declara sectores? Sin ellos está abierta a cualquiera. */
function tieneSector(row: any): boolean {
  return Array.isArray(row.sectores) && row.sectores.length > 0
}

function matchesSector(row: any, sector: Sector): boolean {
  if (!tieneSector(row)) return true // sin sector específico = abierta a todos
  return declaraSector(row, sector)
}

/** La convocatoria nombra expresamente este sector (no vale "abierta a todos"). */
function declaraSector(row: any, sector: Sector): boolean {
  const sect = row.sectores || []
  for (const s of sect) {
    const code = (s.codigo || '').trim()
    if (/^\d/.test(code)) {
      const letter = sectionLetter(code.replace(/\D/g, '').slice(0, 2))
      if (letter && sector.letters.includes(letter)) return true
    } else if (sector.letters.includes(code.slice(0, 1).toUpperCase())) {
      return true
    }
  }
  return false
}

/** Todas las filas abiertas (estatales + de todas las CCAA) — para contar por CCAA en /ayudas. */
export async function fetchOpenGrantsSummary(): Promise<{ ccaa: string | null; nivel1: string | null }[]> {
  const sb = createPublicSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('convocatorias_publicas')
    .select('ccaa,nivel1,fecha_fin,tipo_convocatoria')
    .or(`fecha_fin.is.null,fecha_fin.gte.${today}`)
    .limit(5000)
  if (error) { console.error('[public-grants] summary', error.message); return [] }
  return (data || []).filter((r: any) => !esConcesionDirecta(r.tipo_convocatoria)).map((r: any) => ({ ccaa: r.ccaa, nivel1: r.nivel1 }))
}

/** Convocatorias abiertas (estatales + de esa CCAA), opcionalmente filtradas por sector. */
export async function fetchOpenGrantsForCcaa(ccaaName: string, sector?: Sector | null): Promise<PublicGrantCard[]> {
  let rows = await fetchOpenRowsForCcaa(ccaaName)
  if (sector) rows = rows.filter((r: any) => matchesSector(r, sector))
  return rows.map(toCard)
}

/**
 * Para las páginas de sector: solo las convocatorias que nombran ese sector,
 * y cuántas generales (sin sector) hay además en la comunidad.
 *
 * Las generales no se listan en cada página de sector a propósito: son las
 * mismas en las 16 de la comunidad, y listarlas es lo que convertía cada
 * página en una copia de las demás. Se cuentan y se enlazan a la página de la
 * comunidad, donde sí están todas.
 */
export async function fetchSectorGrantsForCcaa(
  ccaaName: string,
  sector: Sector,
): Promise<{ propias: PublicGrantCard[]; generales: number }> {
  const rows = await fetchOpenRowsForCcaa(ccaaName)
  return {
    propias: rows.filter((r: any) => declaraSector(r, sector)).map(toCard),
    generales: rows.filter((r: any) => !tieneSector(r)).length,
  }
}

/**
 * Cuántas convocatorias propias tiene cada página de sector, en una sola
 * consulta: `${ccaaSlug}/${sectorSlug}` → número. Lo usa el sitemap para no
 * ofrecer a Google páginas que no llegan al umbral.
 */
export async function fetchSectorCounts(
  ccaaNames: readonly string[],
  sectores: readonly Sector[],
  slugDe: (ccaa: string) => string,
): Promise<Map<string, number> | null> {
  const sb = createPublicSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('convocatorias_publicas')
    .select('nivel1,ccaa,sectores,fecha_fin,tipo_convocatoria')
    .or(`fecha_fin.is.null,fecha_fin.gte.${today}`)
    .limit(5000)
  // null y no un mapa vacío: si la consulta falla, el sitemap tiene que saber
  // que no sabe, y no concluir que ninguna página llega al umbral.
  if (error) { console.error('[public-grants] counts', error.message); return null }
  const abiertas = (data || []).filter((r: any) => isOpen(r.fecha_fin, today) && !esConcesionDirecta(r.tipo_convocatoria))
  const cuentas = new Map<string, number>()
  for (const ccaa of ccaaNames) {
    const deAqui = abiertas.filter((r: any) => r.nivel1 === 'ESTATAL' || r.ccaa === ccaa)
    for (const s of sectores) {
      cuentas.set(`${slugDe(ccaa)}/${s.slug}`, deAqui.filter((r: any) => declaraSector(r, s)).length)
    }
  }
  return cuentas
}

async function fetchOpenRowsForCcaa(ccaaName: string): Promise<any[]> {
  const sb = createPublicSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('convocatorias_publicas')
    .select(SELECT_FIELDS)
    .or(`nivel1.eq.ESTATAL,ccaa.eq.${ccaaName}`)
    // El plazo se filtra AQUÍ, no solo abajo en JS. Ordenando por fecha_fin
    // ascendente, las primeras son las de plazo más antiguo —es decir, las ya
    // caducadas—, así que un `limit` sin este filtro gastaba el cupo entero en
    // convocatorias cerradas que el filtro de abajo tiraba después. Con el
    // catálogo pequeño no se notaba; al pasar a toda España, Cataluña (453
    // abiertas) mostraba 112.
    .or(`fecha_fin.is.null,fecha_fin.gte.${today}`)
    .order('fecha_fin', { ascending: true, nullsFirst: false })
    .limit(600)
  if (error) { console.error('[public-grants] ccaa', error.message); return [] }
  return (data || []).filter((r: any) => isOpen(r.fecha_fin, today) && !esConcesionDirecta(r.tipo_convocatoria))
}
