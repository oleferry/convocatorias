import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

async function requireAdmin() {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  return isAdminEmail(user?.email) ? user : null
}

// GET /api/admin/costs → uso de la API de Claude (agregado) + costes fijos.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const sb = createAdminSupabase()

  const since30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ data: usage30 }, { data: usageMonth }, { data: fixedCosts }, { data: recent }] = await Promise.all([
    sb.from('api_usage_log').select('feature, source, cost_usd, input_tokens, output_tokens, created_at').gte('created_at', since30),
    sb.from('api_usage_log').select('feature, source, cost_usd').gte('created_at', startOfMonth),
    sb.from('fixed_costs').select('*').order('created_at'),
    sb.from('api_usage_log').select('*').order('created_at', { ascending: false }).limit(50),
  ])

  const byFeature: Record<string, { calls: number; cost: number; inputTokens: number; outputTokens: number }> = {}
  for (const r of (usage30 || []) as any[]) {
    const k = r.feature || 'unknown'
    if (!byFeature[k]) byFeature[k] = { calls: 0, cost: 0, inputTokens: 0, outputTokens: 0 }
    byFeature[k].calls++
    byFeature[k].cost += Number(r.cost_usd) || 0
    byFeature[k].inputTokens += r.input_tokens || 0
    byFeature[k].outputTokens += r.output_tokens || 0
  }

  // Serie diaria (últimos 30 días) para el gráfico
  const byDay: Record<string, number> = {}
  for (const r of (usage30 || []) as any[]) {
    const day = (r.created_at || '').slice(0, 10)
    byDay[day] = (byDay[day] || 0) + (Number(r.cost_usd) || 0)
  }

  const monthApiCostUsd = (usageMonth || []).reduce((s: number, r: any) => s + (Number(r.cost_usd) || 0), 0)
  const totalFixedMonthlyEur = (fixedCosts || [])
    .filter((f: any) => f.active)
    .reduce((s: number, f: any) => s + (f.period === 'monthly' ? Number(f.amount_eur) : f.period === 'yearly' ? Number(f.amount_eur) / 12 : 0), 0)

  return NextResponse.json({
    monthApiCostUsd,
    totalFixedMonthlyEur,
    byFeature,
    byDay,
    fixedCosts: fixedCosts || [],
    recent: recent || [],
  })
}

// POST /api/admin/costs → crea/actualiza un coste fijo.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const sb = createAdminSupabase()

  if (b.delete && b.id) {
    const { error } = await sb.from('fixed_costs').delete().eq('id', b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (b.id) {
    const patch: any = {}
    for (const k of ['name', 'amount_eur', 'period', 'notes', 'active']) if (k in b) patch[k] = b[k]
    const { data, error } = await sb.from('fixed_costs').update(patch).eq('id', b.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, cost: data })
  }

  if (!b.name || b.amount_eur == null) return NextResponse.json({ error: 'Falta nombre o importe' }, { status: 400 })
  const { data, error } = await sb.from('fixed_costs')
    .insert({ name: b.name, amount_eur: b.amount_eur, period: b.period || 'monthly', notes: b.notes || null })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, cost: data })
}
