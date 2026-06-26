import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { matchGrant, type PublicGrantRow } from '@/lib/matching'
import type { Organization } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 30

// Diagnóstico temporal (service role, salta RLS). BORRAR luego.
export async function GET() {
  const sb = createAdminSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const c = async (q: any) => (await q).count
  const total = await c(sb.from('convocatorias_publicas').select('*', { count: 'exact', head: true }))
  const fuentes: any = {}
  for (const f of ['bdns', 'privada', 'europea']) {
    fuentes[f] = await c(sb.from('convocatorias_publicas').select('*', { count: 'exact', head: true }).eq('fuente', f))
  }
  const futureBdns = await c(sb.from('convocatorias_publicas').select('*', { count: 'exact', head: true }).eq('fuente', 'bdns').not('fecha_fin', 'is', null).gte('fecha_fin', today))
  const { data: orgs } = await sb.from('organizations').select('id,name,ccaa,cnae,cnaes,keywords,user_id').limit(5)

  let matchInfo: any = null
  if (orgs && orgs[0]) {
    const org = orgs[0] as Organization
    const [bdns, radar] = await Promise.all([
      sb.from('convocatorias_publicas').select('*').not('fecha_fin', 'is', null).gte('fecha_fin', today).or(`nivel1.eq.ESTATAL,ccaa.eq.${org.ccaa}`).limit(400),
      sb.from('convocatorias_publicas').select('*').neq('fuente', 'bdns').limit(150),
    ])
    const cand = [...(bdns.data || []), ...(radar.data || [])] as PublicGrantRow[]
    let matches = 0
    for (const x of cand) if (matchGrant(x, org, today).match) matches++
    matchInfo = { org: (org as any).name, ccaa: org.ccaa, cnae: org.cnae, bdnsQ: (bdns.data || []).length, radarQ: (radar.data || []).length, pool: cand.length, matches, bdnsErr: bdns.error?.message, radarErr: radar.error?.message }
  }
  return NextResponse.json({ total, fuentes, futureBdns, orgsCount: orgs?.length || 0, matchInfo })
}
