import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { adminEmails } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FROM = process.env.DIGEST_FROM || 'DamePerrasPerro <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dameperrasperro.es'

function esc(s: any) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

async function notifyAdmin(lead: any) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.LEADS_NOTIFY_EMAIL || adminEmails()[0]
  if (!key || !to) return false
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto">
    <h2 style="color:#121212">🐾 Nuevo lead en DamePerrasPerro</h2>
    <p style="font-size:15px;color:#3A3A3A">Alguien quiere ayuda con una convocatoria:</p>
    <div style="background:#F8F4EC;border-radius:10px;padding:16px">
      <div style="font-weight:700;color:#121212;font-size:15px">${esc(lead.grant_titulo)}</div>
      ${lead.grant_url ? `<div><a href="${esc(lead.grant_url)}">${esc(lead.grant_url)}</a></div>` : ''}
      <hr style="border:none;border-top:1px solid #E7E2D6;margin:12px 0"/>
      <div>👤 <b>${esc(lead.contacto_nombre || '—')}</b></div>
      <div>✉️ ${esc(lead.contacto_email || '—')}</div>
      <div>📞 ${esc(lead.contacto_telefono || '—')}</div>
      ${lead.mensaje ? `<div style="margin-top:8px">💬 ${esc(lead.mensaje)}</div>` : ''}
    </div>
    <p style="margin-top:16px"><a href="${APP_URL}/admin/leads" style="background:#E6A800;color:#121212;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:800">Gestionar en el panel →</a></p>
  </div>`
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject: `🐾 Nuevo lead: ${lead.grant_titulo}`.slice(0, 90), html }),
    })
    return r.ok
  } catch { return false }
}

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
