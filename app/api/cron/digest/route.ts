import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { matchGrant, formatEuro, tituloCorto, type PublicGrantRow } from '@/lib/matching'
import { tramitarUrl } from '@/lib/tramitacion'
import type { Organization } from '@/lib/types'
import { APP_URL } from '@/lib/site'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// GET /api/cron/digest → digest semanal por usuario (Telegram + email Resend).
// Sin Railway. Protegido por CRON_SECRET. Envío gracioso: salta el canal sin clave.
const FROM = process.env.DIGEST_FROM || 'DamePerrasPerro <onboarding@resend.dev>'

function esc(s: any) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function daysLeft(d?: string | null) { return d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null }
function fechaCorta(d?: string | null) { return d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—' }
function plazoTxt(d?: string | null) {
  const n = daysLeft(d); if (n == null) return 'consulta el plazo en la web'
  if (n <= 0) return 'cierra hoy'; return `cierra en ${n}d (${fechaCorta(d)})`
}
const firstName = (u: any) => (u.full_name || '').trim().split(/\s+/)[0] || ''

function composeTelegram(user: any, items: any[]) {
  const name = firstName(user)
  const top = items.map((it, i) => {
    const c = it.c
    const importe = c.importe_beneficiario || (c.presupuesto_total != null ? formatEuro(c.presupuesto_total) : null)
    const esTotal = !c.importe_beneficiario && c.presupuesto_total != null && (!c.fuente || c.fuente === 'bdns')
    return [
      `<b>${i + 1}. ${esc(tituloCorto(c.titulo))}</b>`,
      c.resumen_periodista ? esc(c.resumen_periodista) : null,
      `💰 ${esc(importe || '—')}${esTotal ? ' (total convocatoria)' : ''}   ·   ⏳ ${esc(plazoTxt(c.fecha_fin))}`,
      it.reason ? `💡 ${esc(it.reason)}` : null,
      c.bases_url ? `🔗 ${esc(c.bases_url)}` : null,
      `🤝 <a href="${esc(tramitarUrl(APP_URL, user.id, c.codigo_bdns))}">Te la tramito</a>`,
    ].filter(Boolean).join('\n')
  }).join('\n\n──────────\n\n')
  return [
    `🐾 ${name ? 'Oye ' + esc(name) + ', ' : ''}he olido <b>${items.length}</b> ${items.length === 1 ? 'perra' : 'perras'} que te pueden encajar esta semana:`,
    '', top, `\n👉 Verlas y guardarlas: ${esc(APP_URL)}/dashboard`,
  ].join('\n')
}

function composeEmail(user: any, items: any[]) {
  const name = firstName(user)
  const n = items.length
  const subject = `Te he olido ${n} ayuda${n !== 1 ? 's' : ''} esta semana 🐾`
  // Nota: el email mantiene fondo claro por fiabilidad en clientes de correo
  // (Outlook y otros renderizan mal fondos oscuros), pero usa los mismos
  // acentos de la dirección "Rastro" (latón/menta/ladrillo), no crema+dorado.
  const T = { card: '#FFFFFF', ink: '#1A1A18', mid: '#4A4E48', light: '#767C73', green: '#2F6B4F', amber: '#B8863A', red: '#B14A32', purple: '#6D28D9', border: '#E2E4DC' }
  const cards = items.map((it) => {
    const c = it.c, dl = daysLeft(c.fecha_fin)
    const plazoColor = dl != null && dl <= 7 ? T.red : T.green
    const importe = c.importe_beneficiario || (c.presupuesto_total != null ? formatEuro(c.presupuesto_total) : null)
    const esTotal = !c.importe_beneficiario && c.presupuesto_total != null && (!c.fuente || c.fuente === 'bdns')
    return `
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:12px;padding:18px 20px;margin:0 0 14px">
      <div style="font-size:12px;color:${T.light};margin-bottom:4px">${esc(c.organo || '')}</div>
      <div style="font-size:16px;font-weight:700;color:${T.ink};line-height:1.35;margin-bottom:8px">${esc(tituloCorto(c.titulo))}</div>
      ${c.resumen_periodista ? `<div style="font-size:13.5px;color:${T.mid};line-height:1.55;margin-bottom:8px">${esc(c.resumen_periodista)}</div>` : ''}
      ${importe ? `<div style="font-size:15px;font-weight:800;color:${T.ink};margin-bottom:2px">${esc(importe)}</div>` : ''}
      ${esTotal ? `<div style="font-size:11px;color:${T.light};margin-bottom:6px">Presupuesto total de la convocatoria</div>` : ''}
      <div style="font-size:13px;font-weight:700;color:${plazoColor};margin-bottom:8px">⏳ ${esc(plazoTxt(c.fecha_fin))}</div>
      ${it.reason ? `<div style="display:inline-block;background:#EDE6F7;color:${T.purple};font-size:12px;font-weight:600;padding:3px 9px;border-radius:6px;margin-bottom:8px">💡 ${esc(it.reason)}</div>` : ''}
      ${c.bases_url ? `<div style="margin-bottom:12px"><a href="${esc(c.bases_url)}" style="font-size:13px;color:${T.amber};font-weight:600;text-decoration:none">🔗 Ver las bases →</a></div>` : ''}
      <div><a href="${esc(tramitarUrl(APP_URL, user.id, c.codigo_bdns))}" style="display:inline-block;background:${T.amber};color:#1A1305;font-size:13.5px;font-weight:800;text-decoration:none;padding:9px 18px;border-radius:8px">🤝 Te la tramito</a></div>
    </div>`
  }).join('')
  const html = `
  <div style="background:#F0F1EC;padding:24px 0;font-family:'Barlow',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:0 16px">
      <div style="font-size:13px;color:${T.light};margin-bottom:18px">🐾 <b style="color:${T.ink}">DamePerrasPerro</b> · el perro que encuentra las perras</div>
      <p style="font-size:15px;color:${T.ink};line-height:1.6;margin:0 0 14px">Hola${name ? ' ' + esc(name) : ''}:</p>
      <p style="font-size:15px;color:${T.mid};line-height:1.7;margin:0 0 22px">Me he pasado la semana con el hocico metido en la Base Nacional de Subvenciones y en los fondos europeos. Mira lo que he olido:</p>
      ${cards}
      <div style="text-align:center;margin:22px 0 26px">
        <a href="${esc(APP_URL)}/dashboard" style="display:inline-block;background:${T.amber};color:#1A1305;font-size:15px;font-weight:800;text-decoration:none;padding:12px 28px;border-radius:10px">Verlas en tu panel →</a>
      </div>
      <p style="font-size:14px;color:${T.mid};line-height:1.7;margin:0 0 4px">Con el hocico bien afinado,</p>
      <p style="font-size:14px;color:${T.ink};font-weight:700;line-height:1.7;margin:0">DamePerrasPerro 🐾</p>
    </div>
  </div>`
  return { subject, html }
}

// Telegram corta los mensajes en 4.096 caracteres: un digest largo (20
// convocatorias) los supera y la API devuelve error, así que el envío fallaba
// entero en silencio. Troceamos por el separador entre convocatorias para no
// partir ninguna por la mitad ni romper el HTML.
const TG_LIMITE = 3800

function trocearTelegram(texto: string): string[] {
  if (texto.length <= TG_LIMITE) return [texto]
  const bloques = texto.split('\n\n──────────\n\n')
  const trozos: string[] = []
  let actual = ''
  for (const b of bloques) {
    const candidato = actual ? `${actual}\n\n──────────\n\n${b}` : b
    if (candidato.length > TG_LIMITE && actual) { trozos.push(actual); actual = b }
    else actual = candidato
  }
  if (actual) trozos.push(actual)
  // Un bloque suelto que ya pase del límite: corte duro como último recurso.
  return trozos.flatMap(t => t.length <= TG_LIMITE ? [t] : (t.match(new RegExp(`[\\s\\S]{1,${TG_LIMITE}}`, 'g')) || []))
}

async function sendTelegram(chatId: any, html: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN; if (!token) return false
  let todoOk = true
  for (const trozo of trocearTelegram(html)) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: trozo, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
    if (!r.ok) { todoOk = false; console.warn('[digest] Telegram rechazó un trozo:', await r.text().catch(() => '')) }
  }
  return todoOk
}
async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY; if (!key) return false
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  return r.ok
}

async function pickForUser(sb: any, user: any, today: string, max = 8, incluirEnviadas = false) {
  const { data: orgs } = await sb.from('organizations').select('*').eq('user_id', user.id).eq('is_archived', false)
  if (!orgs || !orgs.length) return []
  // El digest semanal salta lo ya enviado (para no repetirse). Una puesta al
  // día puede querer justo lo contrario: el panorama completo de lo que hoy
  // está abierto y encaja, se haya mencionado antes o no.
  const [{ data: saved }, { data: sent }] = await Promise.all([
    sb.from('grants').select('codigo_bdns').eq('user_id', user.id).not('codigo_bdns', 'is', null),
    incluirEnviadas
      ? Promise.resolve({ data: [] })
      : sb.from('digest_sent').select('codigo_bdns').eq('user_id', user.id),
  ])
  // Las que ya tiene guardadas se saltan siempre: ya las conoce.
  const skip = new Set([...(saved || []), ...(sent || [])].map((r: any) => r.codigo_bdns))
  const byCode = new Map<string, any>()
  for (const org of orgs as Organization[]) {
    const [bdns, radar] = await Promise.all([
      sb.from('convocatorias_publicas').select('*').not('fecha_fin', 'is', null).gte('fecha_fin', today)
        .or(`nivel1.eq.ESTATAL,ccaa.eq.${org.ccaa}`).order('fecha_fin', { ascending: true }).limit(300),
      sb.from('convocatorias_publicas').select('*').neq('fuente', 'bdns').limit(150),
    ])
    for (const c of [...(bdns.data || []), ...(radar.data || [])] as PublicGrantRow[]) {
      if (skip.has(c.codigo_bdns)) continue
      const m = matchGrant(c, org, today)
      if (!m.match) continue
      const prev = byCode.get(c.codigo_bdns)
      if (!prev || m.score > prev.score) byCode.set(c.codigo_bdns, { c, score: m.score, reason: m.reasons.join(' · ') })
    }
  }
  return [...byCode.values()].sort((a, b) => b.score - a.score || (a.c.fecha_fin || '').localeCompare(b.c.fecha_fin || '')).slice(0, max)
}

// Emails verificados. Nunca mandamos a direcciones sin confirmar: no las ha
// validado nadie (pueden ser erróneas o de otra persona) y perjudican la
// reputación del dominio, que es lo que mantiene el digest fuera de spam.
// El dato vive en auth.users, no en public.users, de ahí el cliente admin.
async function emailsConfirmados(sb: any): Promise<Set<string>> {
  const ok = new Set<string>()
  try {
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw new Error(error.message)
    for (const u of (data?.users || [])) if (u.email_confirmed_at && u.id) ok.add(u.id)
  } catch (e: any) {
    console.warn('[digest] no pude leer confirmaciones:', e?.message)
  }
  return ok
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const key = req.nextUrl.searchParams.get('key')
    if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })

  const sb = createAdminSupabase()
  const today = new Date().toISOString().slice(0, 10)

  // ?max=N    → cuántas convocatorias por usuario (8 el digest semanal; más en
  //             una puesta al día tras ampliar el catálogo).
  // ?dry=1    → no envía nada, solo dice qué se enviaría. Para revisar antes.
  // ?solo=<email> → limita el envío a esa dirección (prueba real).
  const max = Math.min(Number(req.nextUrl.searchParams.get('max') || 8), 30)
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const solo = (req.nextUrl.searchParams.get('solo') || '').toLowerCase().trim()
  // ?incluirEnviadas=1 → panorama completo, aunque ya se mencionaran antes.
  const incluirEnviadas = req.nextUrl.searchParams.get('incluirEnviadas') === '1'

  const { data: users } = await sb.from('users').select('id, email, full_name, telegram_id').limit(200)
  const confirmados = await emailsConfirmados(sb)

  let sent = 0
  const detalle: any[] = []
  for (const user of (users || [])) {
    if (solo && (user.email || '').toLowerCase() !== solo) continue
    const emailOk = confirmados.has(user.id)
    const items = await pickForUser(sb, user, today, max, incluirEnviadas)
    if (!items.length) continue

    if (dry) {
      detalle.push({
        email: user.email, email_confirmado: emailOk, telegram: !!user.telegram_id,
        convocatorias: items.length,
        muestra: items.slice(0, 3).map((it: any) => it.c.titulo?.slice(0, 70)),
      })
      continue
    }

    const tg = composeTelegram(user, items)
    const { subject, html } = composeEmail(user, items)
    const okTg = user.telegram_id ? await sendTelegram(user.telegram_id, tg) : false
    // Solo a direcciones verificadas (ver emailsConfirmados).
    const okMail = (user.email && emailOk) ? await sendEmail(user.email, subject, html) : false
    const channel = okTg && okMail ? 'both' : okTg ? 'telegram' : okMail ? 'email' : null
    if (channel) {
      await sb.from('digest_sent').upsert(items.map((it: any) => ({ user_id: user.id, codigo_bdns: it.c.codigo_bdns, channel })), { onConflict: 'user_id,codigo_bdns', ignoreDuplicates: true })
      await sb.from('search_runs').insert({ user_id: user.id, results_count: items.length, trigger: 'cron_weekly' })
      sent++
      detalle.push({ email: user.email, canal: channel, convocatorias: items.length })
    }
  }
  return NextResponse.json({ ok: true, dry, max, usuarios_con_envio: sent, detalle })
}
