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

// GET /api/admin/leads → todos los leads (solo admin).
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const sb = createAdminSupabase()
  const { data, error } = await sb.from('leads').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data || [] })
}

// POST /api/admin/leads → actualiza estado/gestoría/comisión de un lead.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  const patch: any = {}
  for (const k of ['estado', 'gestoria', 'importe_estimado', 'comision_pct', 'comision_estimada', 'notas_admin']) {
    if (k in b) patch[k] = b[k] === '' ? null : b[k]
  }
  // Comisión estimada automática si dan importe + %
  if (patch.importe_estimado != null && patch.comision_pct != null && patch.comision_estimada == null) {
    patch.comision_estimada = Math.round(Number(patch.importe_estimado) * Number(patch.comision_pct)) / 100
  }
  const sb = createAdminSupabase()
  const { data, error } = await sb.from('leads').update(patch).eq('id', b.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, lead: data })
}
