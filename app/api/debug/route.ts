import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { matchGrant, type PublicGrantRow } from '@/lib/matching'
import type { Organization } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Lista qué encaja con el primer perfil (con el matching real). BORRAR luego.
export async function GET() {
  const sb = createAdminSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const { data: org } = await sb.from('organizations').select('*').limit(1).single()
  const o = org as Organization

  const [bdns, radar] = await Promise.all([
    sb.from('convocatorias_publicas').select('*').not('fecha_fin', 'is', null).gte('fecha_fin', today)
      .or(`nivel1.eq.ESTATAL,ccaa.eq.${o.ccaa}`).limit(400),
    sb.from('convocatorias_publicas').select('*').neq('fuente', 'bdns').limit(200),
  ])
  const pool = [...(bdns.data || []), ...(radar.data || [])] as PublicGrantRow[]
  const hits = pool.map(c => ({ c, m: matchGrant(c, o, today) })).filter(x => x.m.match)
    .sort((a, b) => b.m.score - a.m.score)
    .map(x => ({ score: x.m.score, fuente: x.c.fuente, titulo: (x.c.titulo || '').slice(0, 90), razon: x.m.reasons.join(' · ') }))

  return NextResponse.json({ perfil: o.name, poolTotal: pool.length, encajan: hits.length, lista: hits })
}
