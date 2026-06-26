import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { matchGrant, formatEuro, type PublicGrantRow } from '@/lib/matching'
import type { Organization } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// GET /api/cron/digest → digest semanal por usuario (Telegram + email Resend).
// Sin Railway. Protegido por CRON_SECRET. Envío gracioso: salta el canal sin clave.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dameperrasperro.es'
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
    return [
      `<b>${i + 1}. ${esc(c.titulo)}</b>`,
      `💰 ${esc(formatEuro(c.presupuesto_total) || '—')}   ·   ⏳ ${esc(plazoTxt(c.fecha_fin))}`,
      it.reason ? `💡 ${esc(it.reason)}` : null,
      c.bases_url ? `🔗 ${esc(c.bases_url)}` : null,
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
  const T = { card: '#FFFFFF', ink: '#121212', mid: '#3A3A3A', light: '#6B7280', green: '#2BA84A', amber: '#E6A800', red: '#D62828', purple: '#7C3AED', border: '#E7E2D6' }
  const cards = items.map((it) => {
    const c = it.c, dl = daysLeft(c.fecha_fin)
    const plazoColor = dl != null && dl <= 7 ? T.red : T.green
    return `
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:12px;padding:18px 20px;margin:0 0 14px">
      <div style="font-size:12px;color:${T.light};margin-bottom:4px">${esc(c.organo || '')}</div>
      <div style="font-size:16px;font-weight:700;color:${T.ink};line-height:1.35;margin-bottom:8px">${esc(c.titulo)}</div>
      ${c.presupuesto_total != null ? `<div style="font-size:15px;font-weight:800;color:${T.ink};margin-bottom:6px">${esc(formatEuro(c.presupuesto_total))}</div>` : ''}
      <div style="font-size:13px;font-weight:700;color:${plazoColor};margin-bottom:8px">⏳ ${esc(plazoTxt(c.fecha_fin))}</div>
      ${it.reason ? `<div style="display:inline-block;background:#EDE9FE;color:${T.purple};font-size:12px;font-weight:600;padding:3px 9px;border-radius:6px;margin-bottom:8px">💡 ${esc(it.reason)}</div>` : ''}
      ${c.bases_url ? `<div><a href="${esc(c.bases_url)}" style="font-size:13px;color:#1C2B3A;font-weight:600;text-decoration:none">🔗 Ver las bases →</a></div>` : ''}
    </div>`
  }).join('')
  const html = `
  <div style="background:#F8F4EC;padding:24px 0;font-family:'Inter',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:0 16px">
      <div style="font-size:13px;color:${T.light};margin-bottom:18px">🐾 <b style="color:${T.ink}">DamePerrasPerro</b> · el perro que encuentra las perras</div>
      <p style="font-size:15px;color:${T.ink};line-height:1.6;margin:0 0 14px">Hola${name ? ' ' + esc(name) : ''}:</p>
      <p style="font-size:15px;color:${T.mid};line-height:1.7;margin:0 0 22px">Me he pasado la semana con el hocico metido en la Base Nacional de Subvenciones y en los fondos europeos. Mira lo que he olido:</p>
      ${cards}
      <div style="text-align:center;margin:22px 0 26px">
        <a href="${esc(APP_URL)}/dashboard" style="display:inline-block;background:${T.amber};color:#121212;font-size:15px;font-weight:800;text-decoration:none;padding:12px 28px;border-radius:10px">Verlas en tu panel →</a>
      </div>
      <p style="font-size:14px;color:${T.mid};line-height:1.7;margin:0 0 4px">Con el hocico bien afinado,</p>
      <p style="font-size:14px;color:${T.ink};font-weight:700;line-height:1.7;margin:0">DamePerrasPerro 🐾</p>
    </div>
  </div>`
  return { subject, html }
}

async function sendTelegram(chatId: any, html: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN; if (!token) return false
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  return r.ok
}
async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY; if (!key) return false
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  return r.ok
}

async function pickForUser(sb: any, user: any, today: string) {
  const { data: orgs } = await sb.from('organizations').select('*').eq('user_id', user.id).eq('is_archived', false)
  if (!orgs || !orgs.length) return []
  const [{ data: saved }, { data: sent }] = await Promise.all([
    sb.from('grants').select('codigo_bdns').eq('user_id', user.id).not('codigo_bdns', 'is', null),
    sb.from('digest_sent').select('codigo_bdns').eq('user_id', user.id),
  ])
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
  return [...byCode.values()].sort((a, b) => b.score - a.score || (a.c.fecha_fin || '').localeCompare(b.c.fecha_fin || '')).slice(0, 8)
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
  const { data: users } = await sb.from('users').select('id, email, full_name, telegram_id').limit(200)
  let sent = 0
  for (const user of (users || [])) {
    const items = await pickForUser(sb, user, today)
    if (!items.length) continue
    const tg = composeTelegram(user, items)
    const { subject, html } = composeEmail(user, items)
    const okTg = user.telegram_id ? await sendTelegram(user.telegram_id, tg) : false
    const okMail = user.email ? await sendEmail(user.email, subject, html) : false
    const channel = okTg && okMail ? 'both' : okTg ? 'telegram' : okMail ? 'email' : null
    if (channel) {
      await sb.from('digest_sent').upsert(items.map((it: any) => ({ user_id: user.id, codigo_bdns: it.c.codigo_bdns, channel })), { onConflict: 'user_id,codigo_bdns', ignoreDuplicates: true })
      await sb.from('search_runs').insert({ user_id: user.id, results_count: items.length, trigger: 'cron_weekly' })
      sent++
    }
  }
  return NextResponse.json({ ok: true, usuarios_con_envio: sent })
}
