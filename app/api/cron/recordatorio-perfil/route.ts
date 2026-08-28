import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { APP_URL } from '@/lib/site'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// GET /api/cron/recordatorio-perfil?key=...&dry=1&solo=<email>&forzar=1
//
// Quien se registra y nunca crea un perfil de empresa no puede recibir nada:
// sin CNAE, actividad ni provincia no hay con qué cruzar las convocatorias.
// Este aviso les pide el paso que falta. Se manda UNA vez por usuario
// (queda registrado en users.perfil_recordatorio_at) salvo ?forzar=1.
const FROM = process.env.DIGEST_FROM || 'DamePerrasPerro <onboarding@resend.dev>'

function esc(s: any) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
const firstName = (u: any) => (u.full_name || '').trim().split(/\s+/)[0] || ''

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

function componer(user: any, abiertas: number) {
  const name = firstName(user)
  const T = { card: '#FFFFFF', ink: '#1A1A18', mid: '#4A4E48', light: '#767C73', amber: '#B8863A', border: '#E2E4DC' }
  const subject = 'Te falta un paso para que empiece a olfatear 🐾'
  const html = `
  <div style="background:#F0F1EC;padding:24px 0;font-family:'Barlow',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:0 16px">
      <div style="font-size:13px;color:${T.light};margin-bottom:18px">🐾 <b style="color:${T.ink}">DamePerrasPerro</b> · el perro que encuentra las perras</div>
      <p style="font-size:15px;color:${T.ink};line-height:1.6;margin:0 0 14px">Hola${name ? ' ' + esc(name) : ''}:</p>
      <p style="font-size:15px;color:${T.mid};line-height:1.7;margin:0 0 16px">
        Te registraste, pero no llegaste a decirme a qué te dedicas. Y sin eso no puedo olfatear nada para ti:
        necesito saber tu actividad y dónde estás para separar lo que te sirve de las miles de convocatorias que salen.
      </p>
      <div style="background:${T.card};border:1px solid ${T.border};border-radius:12px;padding:18px 20px;margin-bottom:20px">
        <div style="font-size:15px;font-weight:700;color:${T.ink};margin-bottom:8px">Son 2 minutos</div>
        <p style="font-size:14px;color:${T.mid};line-height:1.7;margin:0">
          Nombre del negocio, provincia y a qué te dedicas. Con eso empiezo a cruzar
          ${abiertas > 0 ? `las <b style="color:${T.ink}">${abiertas} convocatorias abiertas</b> que tengo ahora mismo` : 'las convocatorias abiertas que tengo'}
          y te aviso solo de las que puedas pedir de verdad.
        </p>
      </div>
      <div style="text-align:center;margin:22px 0 26px">
        <a href="${APP_URL}/organizations" style="display:inline-block;background:${T.amber};color:#1A1305;font-size:15px;font-weight:800;text-decoration:none;padding:12px 28px;border-radius:10px">Crear mi perfil →</a>
      </div>
      <p style="font-size:13px;color:${T.light};line-height:1.6;margin:0 0 18px">
        Si te registraste por curiosidad y no te interesa, ignora este correo: no volveré a insistir con esto.
      </p>
      <p style="font-size:14px;color:${T.mid};line-height:1.7;margin:0 0 4px">Con el hocico bien afinado,</p>
      <p style="font-size:14px;color:${T.ink};font-weight:700;line-height:1.7;margin:0">DamePerrasPerro 🐾</p>
    </div>
  </div>`
  return { subject, html }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const key = req.nextUrl.searchParams.get('key')
    if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })

  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const forzar = req.nextUrl.searchParams.get('forzar') === '1'
  const solo = (req.nextUrl.searchParams.get('solo') || '').toLowerCase().trim()

  try {
    const sb = createAdminSupabase()
    const hoy = new Date().toISOString().slice(0, 10)

    const [{ data: users }, { data: orgs }, { count: abiertas }] = await Promise.all([
      sb.from('users').select('id, email, full_name, perfil_recordatorio_at').limit(500),
      sb.from('organizations').select('user_id').eq('is_archived', false),
      sb.from('convocatorias_publicas').select('codigo_bdns', { count: 'exact', head: true })
        .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`).neq('codigo_bdns', `__nc_${Date.now()}`),
    ])

    const conPerfil = new Set((orgs || []).map((o: any) => o.user_id))

    // Solo direcciones verificadas: nadie ha validado las demás.
    const confirmados = new Set<string>()
    try {
      const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
      for (const u of (data?.users || [])) if (u.email_confirmed_at && u.id) confirmados.add(u.id)
    } catch (e: any) { console.warn('[recordatorio-perfil] confirmaciones:', e?.message) }

    const candidatos = (users || []).filter((u: any) =>
      !conPerfil.has(u.id) &&
      confirmados.has(u.id) &&
      !!u.email &&
      (forzar || !u.perfil_recordatorio_at) &&
      (!solo || (u.email || '').toLowerCase() === solo)
    )

    if (dry) {
      return NextResponse.json({
        ok: true, dry: true, convocatorias_abiertas: abiertas ?? 0,
        destinatarios: candidatos.length,
        emails: candidatos.map((u: any) => u.email),
      })
    }

    let enviados = 0
    const fallos: any[] = []
    for (const u of candidatos) {
      const { subject, html } = componer(u, abiertas ?? 0)
      const ok = await sendEmail(u.email, subject, html)
      if (ok) {
        await sb.from('users').update({ perfil_recordatorio_at: new Date().toISOString() }).eq('id', u.id)
        enviados++
      } else fallos.push(u.email)
    }
    return NextResponse.json({ ok: true, enviados, fallos, convocatorias_abiertas: abiertas ?? 0 })
  } catch (e: any) {
    console.error('[cron/recordatorio-perfil]', e)
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
