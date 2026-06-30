import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { matchGrant, tituloCorto, type PublicGrantRow } from '@/lib/matching'
import type { Organization } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  const sb = createAdminSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const { data: org } = await sb.from('organizations').select('*').limit(1).single()
  const o = org as Organization
  // Las privadas descubiertas (fuente privada, codigo priv-*)
  const { data: priv } = await sb.from('convocatorias_publicas').select('*').like('codigo_bdns', 'priv-%')
  const lista = (priv || []).map((c: any) => {
    const m = matchGrant(c as PublicGrantRow, o, today)
    return { titulo: tituloCorto(c.titulo), entidad: c.organo, url: c.bases_url, match: m.match, tier: m.tier, score: m.score }
  })
  return NextResponse.json({ descubiertas: lista.length, lista })
}
