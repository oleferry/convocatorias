// ================================================================
//  Datos para las páginas públicas /ayudas/[ccaa]/[sector]: lee
//  directamente el catálogo `convocatorias_publicas` (lectura pública,
//  sin RLS) — sin coste de IA, es el mismo dato que ya ingiere el cron
//  diario. Pensado para Server Components estáticos/ISR.
// ================================================================
import { createPublicSupabase } from './supabase-server'
import { sectionLetter } from './matching'
import { tituloCorto, formatEuro } from './matching'
import type { Sector } from './sectores'

export interface PublicGrantCard {
  codigo_bdns: string
  titulo: string
  organo: string | null
  importe: string
  finalidad: string | null
  fechaFin: string | null
  bases_url: string | null
  fuente: string | null
  sectorLabels: string[]
}

const SELECT_FIELDS = 'codigo_bdns,titulo,organo,nivel1,ccaa,presupuesto_total,finalidad,beneficiarios,sectores,bases_url,fecha_fin,fecha_inicio,fuente'

function isOpen(fecha_fin: string | null, todayISO: string): boolean {
  return !fecha_fin || fecha_fin >= todayISO
}

function toCard(row: any): PublicGrantCard {
  return {
    codigo_bdns: row.codigo_bdns,
    titulo: tituloCorto(row.titulo),
    organo: row.organo,
    importe: formatEuro(row.presupuesto_total),
    finalidad: row.finalidad,
    fechaFin: row.fecha_fin,
    bases_url: row.bases_url,
    fuente: row.fuente,
    sectorLabels: (row.sectores || []).map((s: any) => s.descripcion).filter(Boolean).slice(0, 3),
  }
}

function matchesSector(row: any, sector: Sector): boolean {
  const sect = row.sectores || []
  if (!sect.length) return true // sin sector específico = abierta a todos
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
    .select('ccaa,nivel1,fecha_fin')
    .or(`fecha_fin.is.null,fecha_fin.gte.${today}`)
    .limit(2000)
  if (error) { console.error('[public-grants] summary', error.message); return [] }
  return (data || []).map((r: any) => ({ ccaa: r.ccaa, nivel1: r.nivel1 }))
}

/** Convocatorias abiertas (estatales + de esa CCAA), opcionalmente filtradas por sector. */
export async function fetchOpenGrantsForCcaa(ccaaName: string, sector?: Sector | null): Promise<PublicGrantCard[]> {
  const sb = createPublicSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('convocatorias_publicas')
    .select(SELECT_FIELDS)
    .or(`nivel1.eq.ESTATAL,ccaa.eq.${ccaaName}`)
    .order('fecha_fin', { ascending: true, nullsFirst: false })
    .limit(300)
  if (error) { console.error('[public-grants] ccaa', error.message); return [] }
  let rows = (data || []).filter((r: any) => isOpen(r.fecha_fin, today))
  if (sector) rows = rows.filter((r: any) => matchesSector(r, sector))
  return rows.map(toCard)
}
