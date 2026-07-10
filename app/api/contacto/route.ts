import { NextRequest, NextResponse } from 'next/server'
import { adminEmails } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FROM = process.env.DIGEST_FROM || 'DamePerrasPerro <onboarding@resend.dev>'

function esc(s: any) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

// POST /api/contacto → formulario público de la landing (gestorías/asesorías
// interesadas en recibir leads). No requiere sesión.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const nombre = String(b.nombre || '').trim()
  const email = String(b.email || '').trim()
  const mensaje = String(b.mensaje || '').trim()
  if (!nombre || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Revisa el nombre y el email.' }, { status: 400 })
  }

  const key = process.env.RESEND_API_KEY
  const to = process.env.LEADS_NOTIFY_EMAIL || adminEmails()[0]
  if (key && to) {
    const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#121212">🤝 Nuevo contacto de gestoría — landing</h2>
      <div style="background:#F8F4EC;border-radius:10px;padding:16px">
        <div>👤 <b>${esc(nombre)}</b></div>
        <div>✉️ ${esc(email)}</div>
        <div>📞 ${esc(b.telefono || '—')}</div>
        <div>📍 ${esc(b.zona || '—')}</div>
        ${mensaje ? `<div style="margin-top:8px">💬 ${esc(mensaje)}</div>` : ''}
      </div>
    </div>`
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to, subject: `🤝 Contacto gestoría: ${nombre}`.slice(0, 90), html }),
      })
    } catch { /* no bloquea la respuesta al usuario */ }
  }
  return NextResponse.json({ ok: true })
}
