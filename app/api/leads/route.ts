import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { notifyAdmin } from '@/lib/leads-notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/leads → el usuario expresa interés en una convocatoria.
export async function POST(req: NextRequest) {
  const sb = createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.titulo) return NextResponse.json({ error: 'Falta la convocatoria' }, { status: 400 })

  const lead = {
    user_id: user.id,
    org_id: b.orgId || null,
    codigo_bdns: b.codigo_bdns || null,
    grant_titulo: String(b.titulo).slice(0, 300),
    grant_url: b.url || null,
    fuente: b.fuente || null,
    contacto_nombre: b.nombre || null,
    contacto_email: b.email || user.email,
    contacto_telefono: b.telefono || null,
    mensaje: b.mensaje || null,
  }
  const { data, error } = await sb.from('leads').insert(lead).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  notifyAdmin(lead).catch(() => {}) // best-effort, no bloquea la respuesta
  return NextResponse.json({ ok: true, id: data.id })
}
