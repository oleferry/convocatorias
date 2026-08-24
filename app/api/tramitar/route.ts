import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { adminEmails } from '@/lib/admin'
import { documentacionHabitual, DOC_AVISO, verifyTramitar } from '@/lib/tramitacion'
import { tituloCorto } from '@/lib/matching'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const FROM = process.env.DIGEST_FROM || 'DamePerrasPerro <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dameperrasperro.es'

function esc(s: any) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key || !to) return false
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    return r.ok
  } catch { return false }
}

/** Email al interesado con la documentación que debe ir preparando. */
async function emailDocumentacion(to: string, nombre: string | null, titulo: string, tipoEntidad?: string | null) {
  const docs = documentacionHabitual(tipoEntidad)
  const html = `
  <div style="background:#F0F1EC;padding:24px 0;font-family:Barlow,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:0 16px">
      <div style="font-size:13px;color:#767C73;margin-bottom:18px">🐾 <b style="color:#1A1A18">DamePerrasPerro</b></div>
      <p style="font-size:15px;color:#1A1A18;line-height:1.6;margin:0 0 14px">Hola${nombre ? ' ' + esc(nombre) : ''}:</p>
      <p style="font-size:15px;color:#4A4E48;line-height:1.7;margin:0 0 18px">
        Hemos recibido tu solicitud para que te tramitemos <b style="color:#1A1A18">${esc(titulo)}</b>.
        Te contactamos en breve para ponerte en manos de una gestoría que la conoce.
      </p>
      <div style="background:#FFFFFF;border:1px solid #E2E4DC;border-radius:12px;padding:18px 20px">
        <div style="font-size:15px;font-weight:700;color:#1A1A18;margin-bottom:10px">📁 Ve preparando esto</div>
        <ul style="margin:0;padding-left:20px;color:#4A4E48;font-size:14px;line-height:1.9">
          ${docs.map(d => `<li>${esc(d)}</li>`).join('')}
        </ul>
        <p style="font-size:12.5px;color:#767C73;margin:14px 0 0">${esc(DOC_AVISO)}</p>
      </div>
      <p style="font-size:14px;color:#4A4E48;line-height:1.7;margin:20px 0 4px">Con el hocico bien afinado,</p>
      <p style="font-size:14px;color:#1A1A18;font-weight:700;margin:0">DamePerrasPerro 🐾</p>
    </div>
  </div>`
  return sendEmail(to, `Tu solicitud: ${titulo}`.slice(0, 90), html)
}

/** Aviso al admin de que hay un lead nuevo. */
async function notifyAdmin(lead: any) {
  const to = process.env.LEADS_NOTIFY_EMAIL || adminEmails()[0]
  const html = `
  <div style="font-family:Barlow,Arial,sans-serif;max-width:560px;margin:0 auto">
    <h2 style="color:#1A1A18">🐾 Nuevo lead (${esc(lead.origen)})</h2>
    <div style="background:#F0F1EC;border-radius:10px;padding:16px">
      <div style="font-weight:700;color:#1A1A18;font-size:15px">${esc(lead.grant_titulo)}</div>
      ${lead.grant_url ? `<div><a href="${esc(lead.grant_url)}">${esc(lead.grant_url)}</a></div>` : ''}
      <hr style="border:none;border-top:1px solid #E2E4DC;margin:12px 0"/>
      <div>👤 <b>${esc(lead.contacto_nombre || '—')}</b></div>
      <div>✉️ ${esc(lead.contacto_email || '—')}</div>
      <div>📞 ${esc(lead.contacto_telefono || '—')}</div>
    </div>
    <p style="margin-top:16px"><a href="${APP_URL}/admin/leads" style="background:#C99A3D;color:#1A1305;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:800">Gestionar en el panel →</a></p>
  </div>`
  return sendEmail(to, `🐾 Nuevo lead: ${lead.grant_titulo}`.slice(0, 90), html)
}

function pagina(titulo: string, cuerpo: string, ok = true) {
  return new NextResponse(`<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800&display=swap" rel="stylesheet"/></head>
<body style="margin:0;background:#12312A;color:#F1EFE6;font-family:Barlow,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px">
<div style="background:#1B4238;border:1px solid rgba(241,239,230,0.14);border-radius:16px;padding:36px;max-width:520px;width:100%">
<div style="font-size:40px;margin-bottom:8px">${ok ? '🦴' : '😕'}</div>
<h1 style="margin:0 0 10px;font-size:22px;color:#F1EFE6">${esc(titulo)}</h1>
${cuerpo}
<p style="margin:24px 0 0"><a href="${APP_URL}/dashboard" style="background:#C99A3D;color:#1A1305;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:800;font-size:14px;display:inline-block">Ir a mi panel →</a></p>
</div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// GET /api/tramitar?u=&c=&s= → solicitud de tramitación en un clic desde el
// email del digest. El enlace va firmado (HMAC) porque un email no lleva sesión.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') || ''
  const c = req.nextUrl.searchParams.get('c') || ''
  const s = req.nextUrl.searchParams.get('s') || ''

  if (!verifyTramitar(u, c, s)) {
    return pagina('Este enlace no es válido', '<p style="font-size:15px;color:#C9C6B8;line-height:1.6;margin:0">El enlace ha caducado o está incompleto. Entra en tu panel y pídelo desde la propia convocatoria.</p>', false)
  }

  try {
    const sb = createAdminSupabase()
    const [{ data: usuario }, { data: conv }] = await Promise.all([
      sb.from('users').select('id, email, full_name').eq('id', u).maybeSingle(),
      sb.from('convocatorias_publicas').select('codigo_bdns, titulo, bases_url, fuente').eq('codigo_bdns', c).maybeSingle(),
    ])
    if (!usuario) return pagina('No encontramos tu cuenta', '<p style="font-size:15px;color:#C9C6B8;margin:0">Entra en tu panel y pide la tramitación desde la convocatoria.</p>', false)

    // Perfil por defecto, para adaptar la documentación (autónomo vs sociedad).
    const { data: orgs } = await sb.from('organizations').select('id, tipo_entidad')
      .eq('user_id', u).eq('is_archived', false)
      .order('is_default', { ascending: false }).order('created_at').limit(1)
    const org = (orgs || [])[0]

    const titulo = tituloCorto(conv?.titulo) || 'Convocatoria'

    // Si ya la había pedido, no duplicamos: confirmamos igual.
    const { data: yaExiste } = await sb.from('leads').select('id')
      .eq('user_id', u).eq('codigo_bdns', c).limit(1)
    if (yaExiste && yaExiste.length) {
      return pagina('Ya teníamos tu solicitud', `<p style="font-size:15px;color:#C9C6B8;line-height:1.6;margin:0">Ya nos habías pedido que te tramitáramos <b style="color:#F1EFE6">${esc(titulo)}</b>. Te contactamos en breve, no hace falta que hagas nada más.</p>`)
    }

    const lead = {
      user_id: u,
      org_id: org?.id || null,
      codigo_bdns: c,
      grant_titulo: titulo.slice(0, 300),
      grant_url: conv?.bases_url || null,
      fuente: conv?.fuente || null,
      contacto_nombre: usuario.full_name || null,
      contacto_email: usuario.email || null,
      origen: 'email',
    }
    const { error } = await sb.from('leads').insert(lead)
    if (error) throw new Error(error.message)

    // Best-effort, sin bloquear la respuesta al usuario.
    notifyAdmin(lead).catch(() => {})
    if (usuario.email) emailDocumentacion(usuario.email, usuario.full_name, titulo, org?.tipo_entidad).catch(() => {})

    const docs = documentacionHabitual(org?.tipo_entidad)
    return pagina('¡Recibido! Nos ponemos con ello', `
      <p style="font-size:15px;color:#C9C6B8;line-height:1.6;margin:0 0 16px">Te pondremos en contacto con una gestoría que conoce <b style="color:#F1EFE6">${esc(titulo)}</b>. Te hemos mandado esto también por email.</p>
      <div style="background:#12312A;border:1px solid rgba(241,239,230,0.14);border-radius:10px;padding:16px 18px">
        <div style="font-size:14px;font-weight:700;color:#C99A3D;margin-bottom:8px">📁 Ve preparando esto</div>
        <ul style="margin:0;padding-left:20px;color:#C9C6B8;font-size:13.5px;line-height:1.8">
          ${docs.map(d => `<li>${esc(d)}</li>`).join('')}
        </ul>
        <p style="font-size:12px;color:#728077;margin:12px 0 0">${esc(DOC_AVISO)}</p>
      </div>`)
  } catch (e: any) {
    console.error('[api/tramitar]', e)
    return pagina('No hemos podido registrar tu solicitud', '<p style="font-size:15px;color:#C9C6B8;margin:0">Inténtalo desde tu panel, en la propia convocatoria.</p>', false)
  }
}
