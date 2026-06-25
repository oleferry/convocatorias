// ================================================================
//  Digest semanal — convocatorias que encajan con cada usuario
//  Canales: Telegram (bot) + email (Resend). Tono: cercano y directo.
//
//  Modos:
//   node digest.js            ← una pasada (cron externo)
//   node digest.js --watch    ← se autoprograma (lunes 08:00)
//   node digest.js --dry-run  ← sin enviar: con BD imprime; sin BD usa muestra
//   node digest.js --sample   ← imprime una muestra del copy con datos ficticios
// ================================================================

const DRY = process.argv.includes('--dry-run')
const SAMPLE = process.argv.includes('--sample')
const WATCH = process.argv.includes('--watch')

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TELEGRAM_BOT_TOKEN,
  RESEND_API_KEY,
  DIGEST_FROM,
  NEXT_PUBLIC_APP_URL,
} = process.env

const APP_URL = NEXT_PUBLIC_APP_URL || 'https://convocatorias-five.vercel.app'
const FROM = DIGEST_FROM || 'Convocatorias <onboarding@resend.dev>'

let sb = null
function initDb() {
  if (sb) return sb
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  const { createClient } = require('@supabase/supabase-js')
  sb = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return sb
}

const { matchGrant, formatEuro } = require('./matching')

// ── Utilidades ─────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function daysLeft(d) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}
function fechaCorta(d) {
  return d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'
}
function plazoTxt(d) {
  const n = daysLeft(d)
  if (n == null) return 'sin plazo'
  if (n <= 0) return 'cierra hoy'
  return `cierra en ${n}d (${fechaCorta(d)})`
}
const firstName = (u) => (u.full_name || '').trim().split(/\s+/)[0] || ''

// ── COPY: Telegram ─────────────────────────────────────────────
function composeTelegram(user, items) {
  const name = firstName(user)
  const saludo = name ? `Oye ${esc(name)}, ` : 'Oye, '
  const top = items.map((it, i) => {
    const c = it.c
    return [
      `<b>${i + 1}. ${esc(c.titulo)}</b>`,
      `💰 ${esc(formatEuro(c.presupuesto_total))}   ·   ⏳ ${esc(plazoTxt(c.fecha_fin))}`,
      c.beneficiarios && c.beneficiarios.length ? `👤 ${esc(c.beneficiarios.join(' · '))}` : null,
      c.finalidad ? `🎯 ${esc(c.finalidad)}` : null,
      it.reason ? `💡 ${esc(it.reason)}` : null,
      c.bases_url ? `🔗 ${esc(c.bases_url)}` : null,
    ].filter(Boolean).join('\n')
  }).join('\n\n──────────\n\n')

  const masUrgente = items[0] && daysLeft(items[0].c.fecha_fin)
  const cierre = (masUrgente != null && masUrgente <= 10)
    ? `\n\nAviso: la primera cierra en ${masUrgente} días. En subvenciones, el que se duerme no cobra. 😏`
    : '\n\nNo las dejes para el último día. Sí, te lo digo a ti.'

  return [
    `🕵️ ${saludo}he vuelto a cotillear la Base Nacional de Subvenciones por ti.`,
    `Esta semana hay <b>${items.length}</b> que te pueden venir al pelo:`,
    '',
    top,
    cierre,
    `\n👉 Verlas y guardarlas: ${esc(APP_URL)}/dashboard`,
  ].join('\n')
}

// ── COPY: Email (HTML) ─────────────────────────────────────────
function composeEmail(user, items) {
  const name = firstName(user)
  const n = items.length
  const urg = items[0] && daysLeft(items[0].c.fecha_fin)
  const subject = (urg != null && urg <= 7)
    ? `${n} ayudas para ti (y una cierra en ${urg} días)`
    : `Te he encontrado ${n} ayuda${n !== 1 ? 's' : ''} esta semana`

  const T = { bg: '#F7F5F0', card: '#FFFFFF', ink: '#111827', mid: '#374151', light: '#6B7280', navy: '#1C2B3A', green: '#059669', amber: '#D97706', purple: '#7C3AED', border: '#E5E7EB' }

  const cards = items.map((it) => {
    const c = it.c
    const dl = daysLeft(c.fecha_fin)
    const plazoColor = dl != null && dl <= 7 ? T.amber : T.green
    return `
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:12px;padding:18px 20px;margin:0 0 14px">
      <div style="font-size:12px;color:${T.light};margin-bottom:4px">🏛️ ${esc(c.organo || c.nivel1 || '')}</div>
      <div style="font-size:16px;font-weight:700;color:${T.ink};line-height:1.35;margin-bottom:8px">${esc(c.titulo)}</div>
      <div style="font-size:15px;font-weight:800;color:${T.ink};margin-bottom:6px">${esc(formatEuro(c.presupuesto_total))}</div>
      <div style="font-size:13px;font-weight:700;color:${plazoColor};margin-bottom:8px">⏳ ${esc(plazoTxt(c.fecha_fin))}</div>
      ${it.reason ? `<div style="display:inline-block;background:#EDE9FE;color:${T.purple};font-size:12px;font-weight:600;padding:3px 9px;border-radius:6px;margin-bottom:8px">💡 ${esc(it.reason)}</div>` : ''}
      ${c.beneficiarios && c.beneficiarios.length ? `<div style="font-size:12.5px;color:${T.mid};margin-bottom:4px">👤 ${esc(c.beneficiarios.join(' · '))}</div>` : ''}
      ${c.finalidad ? `<div style="font-size:12.5px;color:${T.mid};margin-bottom:10px">🎯 ${esc(c.finalidad)}</div>` : ''}
      ${c.bases_url ? `<a href="${esc(c.bases_url)}" style="font-size:13px;color:${T.navy};font-weight:600;text-decoration:none">🔗 Ver las bases →</a>` : ''}
    </div>`
  }).join('')

  const cierre = (urg != null && urg <= 7)
    ? `Una cosa más: la primera cierra en <b>${urg} días</b>. En subvenciones, el que se duerme… no cobra.`
    : `Échales un ojo cuando tengas un café delante. Algunas cierran antes de lo que parece.`

  const html = `
  <div style="background:${T.bg};padding:24px 0;font-family:'Inter',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:0 16px">
      <div style="font-size:13px;color:${T.light};margin-bottom:18px">📑 Tu buscador de subvenciones particular</div>

      <p style="font-size:15px;color:${T.ink};line-height:1.6;margin:0 0 14px">Hola${name ? ' ' + esc(name) : ''}:</p>
      <p style="font-size:15px;color:${T.mid};line-height:1.7;margin:0 0 14px">
        Te seré sincero: me he pasado la semana entre el BOE y la Base Nacional de Subvenciones para que tú no tengas que hacerlo.
      </p>
      <p style="font-size:15px;color:${T.mid};line-height:1.7;margin:0 0 22px">
        Y ha merecido la pena. Mira lo que te he encontrado:
      </p>

      ${cards}

      <p style="font-size:15px;color:${T.mid};line-height:1.7;margin:22px 0 18px">${cierre}</p>

      <div style="text-align:center;margin:0 0 26px">
        <a href="${esc(APP_URL)}/dashboard" style="display:inline-block;background:${T.green};color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px">Verlas en tu panel →</a>
      </div>

      <p style="font-size:14px;color:${T.mid};line-height:1.7;margin:0 0 4px">Un abrazo,</p>
      <p style="font-size:14px;color:${T.ink};font-weight:600;line-height:1.7;margin:0 0 22px">El equipo de Convocatorias</p>

      <div style="border-top:1px solid ${T.border};padding-top:14px">
        <p style="font-size:12.5px;color:${T.light};line-height:1.6;margin:0">
          <b>P.D.</b> Si alguna no te encaja, ábrela igualmente y descártala de un clic. Así afino la puntería para la próxima.
        </p>
      </div>
    </div>
  </div>`

  return { subject, html }
}

// ── Envío ──────────────────────────────────────────────────────
async function sendTelegram(chatId, html) {
  if (!TELEGRAM_BOT_TOKEN) return false
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  if (!res.ok) console.warn('[digest] telegram', res.status, await res.text().catch(() => ''))
  return res.ok
}

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) console.warn('[digest] resend', res.status, await res.text().catch(() => ''))
  return res.ok
}

// ── Selección de convocatorias por usuario ─────────────────────
async function pickForUser(db, user, today) {
  const { data: orgs } = await db.from('organizations').select('*').eq('user_id', user.id).eq('is_archived', false)
  if (!orgs || !orgs.length) return []

  // ya guardadas o ya enviadas → no repetir
  const [{ data: saved }, { data: sent }] = await Promise.all([
    db.from('grants').select('codigo_bdns').eq('user_id', user.id).not('codigo_bdns', 'is', null),
    db.from('digest_sent').select('codigo_bdns').eq('user_id', user.id),
  ])
  const skip = new Set([...(saved || []), ...(sent || [])].map(r => r.codigo_bdns))

  const byCode = new Map()
  for (const org of orgs) {
    const { data: cands } = await db.from('convocatorias_publicas').select('*')
      .eq('abierto', true).not('fecha_fin', 'is', null).gte('fecha_fin', today)
      .or(`nivel1.eq.ESTATAL,ccaa.eq.${org.ccaa}`)
      .order('fecha_fin', { ascending: true }).limit(300)
    for (const c of cands || []) {
      if (skip.has(c.codigo_bdns)) continue
      const m = matchGrant(c, org, today)
      if (!m.match) continue
      const prev = byCode.get(c.codigo_bdns)
      if (!prev || m.score > prev.score) byCode.set(c.codigo_bdns, { c, score: m.score, reason: m.reasons.join(' · ') })
    }
  }
  return [...byCode.values()]
    .sort((a, b) => b.score - a.score || (a.c.fecha_fin || '').localeCompare(b.c.fecha_fin || ''))
    .slice(0, 8)
}

// ── Pasada completa ────────────────────────────────────────────
async function runDigest() {
  const db = initDb()
  if (!db) {
    console.log('[digest] sin credenciales de BD → muestra de copy con datos ficticios:\n')
    return printSample()
  }
  const today = new Date().toISOString().slice(0, 10)
  const { data: users } = await db.from('users').select('id, email, full_name, telegram_id')
  let sentUsers = 0
  for (const user of users || []) {
    const items = await pickForUser(db, user, today)
    if (!items.length) continue

    const tg = composeTelegram(user, items)
    const { subject, html } = composeEmail(user, items)

    if (DRY) {
      console.log(`\n===== ${user.email} (${items.length}) =====\n[TELEGRAM]\n${tg}\n[EMAIL] ${subject}`)
    } else {
      const okTg = user.telegram_id ? await sendTelegram(user.telegram_id, tg) : false
      const okMail = user.email ? await sendEmail(user.email, subject, html) : false
      const channel = okTg && okMail ? 'both' : okTg ? 'telegram' : okMail ? 'email' : null
      if (channel) {
        await db.from('digest_sent').upsert(
          items.map(it => ({ user_id: user.id, codigo_bdns: it.c.codigo_bdns, channel })),
          { onConflict: 'user_id,codigo_bdns', ignoreDuplicates: true })
        await db.from('search_runs').insert({ user_id: user.id, results_count: items.length, trigger: 'cron_weekly' })
        sentUsers++
      }
    }
  }
  console.log(`[digest] hecho. Usuarios con envío: ${sentUsers}`)
  return sentUsers
}

// ── Muestra con datos ficticios (para calibrar el tono) ─────────
function sampleItems() {
  return [
    { score: 92, reason: 'Sector CNAE coincide · 2 palabras clave', c: {
      titulo: 'Kit Digital — Segmento III (0-2 empleados)', organo: 'Red.es', nivel1: 'ESTATAL',
      presupuesto_total: 3000, fecha_fin: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10),
      beneficiarios: ['PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA'],
      finalidad: 'Digitalización', bases_url: 'https://www.acelerapyme.gob.es/kit-digital' } },
    { score: 70, reason: 'Tu CCAA (Madrid) · encaja con tu tipo de entidad', c: {
      titulo: 'Ayudas a la contratación indefinida de jóvenes 2026', organo: 'Comunidad de Madrid', nivel1: 'AUTONOMICA',
      presupuesto_total: 9750, fecha_fin: new Date(Date.now() + 24 * 864e5).toISOString().slice(0, 10),
      beneficiarios: ['PYME', 'PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA'],
      finalidad: 'Fomento del Empleo', bases_url: 'https://www.comunidad.madrid/...' } },
  ]
}
function printSample() {
  const user = { full_name: 'Daniel Paniagua', email: 'daniel@example.com' }
  const items = sampleItems()
  console.log('──────── TELEGRAM ────────\n')
  console.log(composeTelegram(user, items).replace(/<\/?b>/g, '*'))
  const { subject } = composeEmail(user, items)
  console.log('\n──────── EMAIL (asunto) ────────\n')
  console.log(subject)
  console.log('\n(El cuerpo del email es HTML con la misma voz; se renderiza con marca papel/tinta.)')
  return 0
}

// ── Arranque ───────────────────────────────────────────────────
if (require.main === module) {
  if (SAMPLE) { printSample() }
  else if (WATCH) {
    const cron = require('node-cron')
    console.log('📨 Digest semanal en marcha. Lunes 08:00 Europe/Madrid.')
    cron.schedule('0 8 * * 1', () => runDigest().catch(e => console.error('[digest]', e)), { timezone: 'Europe/Madrid' })
  } else {
    runDigest().then(() => process.exit(0)).catch(e => { console.error('[digest]', e); process.exit(1) })
  }
}

module.exports = { runDigest, composeTelegram, composeEmail }
