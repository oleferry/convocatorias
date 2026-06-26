import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { matchGrant, type PublicGrantRow } from '@/lib/matching'
import type { Organization } from '@/lib/types'

export const runtime = 'nodejs'

// GET /api/suggestions?orgId=...  → convocatorias públicas (BDNS) que encajan
// con el perfil activo y que el usuario aún no tiene guardadas.
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const orgId = req.nextUrl.searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'Falta orgId' }, { status: 400 })

  const { data: org } = await supabase
    .from('organizations').select('*').eq('id', orgId).eq('user_id', user.id).single()
  if (!org) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)
  const ccaa = (org as Organization).ccaa

  // 1) BDNS: abiertas, con plazo futuro, estatales o de la CCAA del perfil.
  // 2) Radar (privadas/europeas): siempre, sin exigir plazo.
  const [bdns, radar] = await Promise.all([
    supabase.from('convocatorias_publicas').select('*')
      .eq('abierto', true).not('fecha_fin', 'is', null).gte('fecha_fin', today)
      .or(`nivel1.eq.ESTATAL,ccaa.eq.${ccaa}`)
      .order('fecha_fin', { ascending: true }).limit(400),
    supabase.from('convocatorias_publicas').select('*')
      .eq('abierto', true).neq('fuente', 'bdns').limit(100),
  ])
  if (bdns.error) return NextResponse.json({ error: bdns.error.message, suggestions: [] }, { status: 500 })
  const candidates = [...(bdns.data || []), ...(radar.data || [])]

  // Excluir las que el usuario ya tiene guardadas (por codigo_bdns).
  const { data: saved } = await supabase
    .from('grants').select('codigo_bdns').eq('user_id', user.id).not('codigo_bdns', 'is', null)
  const savedSet = new Set((saved || []).map((g: { codigo_bdns: string }) => g.codigo_bdns))

  const suggestions = []
  for (const c of (candidates || []) as PublicGrantRow[]) {
    if (savedSet.has(c.codigo_bdns)) continue
    const m = matchGrant(c, org as Organization, today)
    if (m.match) suggestions.push({ ...c, matchScore: m.score, matchReason: m.reasons.join(' · ') })
  }
  suggestions.sort((a, b) =>
    b.matchScore - a.matchScore || (a.fecha_fin || '').localeCompare(b.fecha_fin || ''))

  return NextResponse.json({ suggestions: suggestions.slice(0, 40) })
}
