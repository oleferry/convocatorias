// Aviso por correo de una petición de tramitación nueva. Lo usan /api/leads
// (con cuenta) y /api/solicitud (desde la ficha pública, sin cuenta).
import { adminEmails } from '@/lib/admin'
import { APP_URL } from '@/lib/site'

const FROM = process.env.DIGEST_FROM || 'DamePerrasPerro <onboarding@resend.dev>'

function esc(s: any) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

export async function notifyAdmin(lead: any) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.LEADS_NOTIFY_EMAIL || adminEmails()[0]
  if (!key || !to) return false
  const html = `
  <div style="font-family:Barlow,Arial,sans-serif;max-width:560px;margin:0 auto">
    <h2 style="color:#1A1A18">🐾 Nuevo lead en DamePerrasPerro</h2>
    <p style="font-size:15px;color:#4A4E48">Alguien quiere ayuda con una convocatoria:</p>
    <div style="background:#F0F1EC;border-radius:10px;padding:16px">
      <div style="font-weight:700;color:#1A1A18;font-size:15px">${esc(lead.grant_titulo)}</div>
      ${lead.grant_url ? `<div><a href="${esc(lead.grant_url)}">${esc(lead.grant_url)}</a></div>` : ''}
      <hr style="border:none;border-top:1px solid #E2E4DC;margin:12px 0"/>
      <div>👤 <b>${esc(lead.contacto_nombre || '—')}</b></div>
      <div>✉️ ${esc(lead.contacto_email || '—')}</div>
      <div>📞 ${esc(lead.contacto_telefono || '—')}</div>
      ${lead.mensaje ? `<div style="margin-top:8px">💬 ${esc(lead.mensaje)}</div>` : ''}
    </div>
    <p style="margin-top:16px"><a href="${APP_URL}/admin/leads" style="background:#C99A3D;color:#1A1305;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:800">Gestionar en el panel →</a></p>
  </div>`
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject: `🐾 Nuevo lead: ${lead.grant_titulo}`.slice(0, 90), html }),
    })
    return r.ok
  } catch { return false }
}
