import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { matchGrant, tituloCorto, type PublicGrantRow } from '@/lib/matching'
import type { Organization } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Inspecciona regiones de matches ESTATAL, buscando restricciones de CCAA
// disfrazadas de "estatal". BORRAR luego.
export async function GET() {
  const sb = createAdminSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const { data: org } = await sb.from('organizations').select('*').limit(1).single()
  const o = org as Organization

  const [bdns, radar] = await Promise.all([
    sb.from('convocatorias_publicas').select('*').not('fecha_fin', 'is', null).gte('fecha_fin', today)
      .or(`nivel1.eq.ESTATAL,ccaa.eq.${o.ccaa}`).limit(400),
    sb.from('convocatorias_publicas').select('*').neq('fuente', 'bdns').limit(150),
  ])
  const pool = [...(bdns.data || []), ...(radar.data || [])] as PublicGrantRow[]
  const hits = pool.map(c => ({ c, m: matchGrant(c, o, today) })).filter(x => x.m.match)
    .filter(x => (x.c.nivel1 || '').toUpperCase() === 'ESTATAL')
    .map(x => ({ titulo: tituloCorto(x.c.titulo), organo: x.c.organo, regiones: (x.c as any).regiones }))
  return NextResponse.json({ org: { ccaa: o.ccaa }, n: hits.length, hits })
}
