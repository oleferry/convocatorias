// ================================================================
//  Bot de Telegram — Gestor de Convocatorias
//  Deploy: Railway (Root Directory: bot, Start: node index.js)
//
//  Funciones:
//   • Vincular cuenta de Telegram con la cuenta web (por email)
//   • Consultar convocatorias urgentes / pendientes / resumen
//   • Lanzar la búsqueda autónoma con IA para el perfil activo
//   • Alertas automáticas de plazos (cron diario)
// ================================================================

const TelegramBot = require('node-telegram-bot-api')
const cron = require('node-cron')
const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk')

// ── Configuración ──────────────────────────────────────────────
const {
  TELEGRAM_BOT_TOKEN,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ANTHROPIC_API_KEY,
  NEXT_PUBLIC_APP_URL,
} = process.env

if (!TELEGRAM_BOT_TOKEN) { console.error('Falta TELEGRAM_BOT_TOKEN'); process.exit(1) }
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'); process.exit(1)
}

const APP_URL = NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Cliente admin (service role) — salta RLS, así que SIEMPRE filtramos por user_id.
const sb = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ai = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })

// ── Metadatos de estado (espejo de lib/types.ts) ───────────────
const STATUS_META = {
  pendiente:         { label: 'Pendiente',   icon: '⏳' },
  revisada:          { label: 'Revisada',    icon: '👁' },
  en_proceso:        { label: 'En proceso',  icon: '⚙️' },
  presentada:        { label: 'Presentada',  icon: '✅' },
  resuelta_positiva: { label: 'Concedida',   icon: '🏆' },
  resuelta_negativa: { label: 'Denegada',    icon: '❌' },
  descartada:        { label: 'Descartada',  icon: '✗' },
}
const ACTIVE_STATUSES = ['pendiente', 'revisada', 'en_proceso', 'presentada']

// ── Utilidades ─────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function daysLeft(d) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function deadlineLabel(d) {
  const days = daysLeft(d)
  if (days === null) return 'Sin plazo'
  if (days < 0) return '⛔ Vencida'
  if (days === 0) return '🔴 ¡Hoy!'
  const date = new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const emoji = days <= 7 ? '🔴' : days <= 21 ? '🟠' : '🟢'
  return `${emoji} ${days}d (${date})`
}

function send(chatId, text, extra = {}) {
  return bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true, ...extra })
}

// Busca el usuario web vinculado a este chat de Telegram
async function getUser(chatId) {
  const { data } = await sb.from('users').select('*').eq('telegram_id', chatId).maybeSingle()
  return data || null
}

function grantLine(g) {
  const sm = STATUS_META[g.status] || STATUS_META.pendiente
  const parts = [`<b>${esc(g.titulo)}</b>`]
  const meta = []
  if (g.organismo) meta.push(esc(g.organismo))
  meta.push(`${sm.icon} ${sm.label}`)
  parts.push(meta.join(' · '))
  const foot = []
  if (g.importe_max) foot.push(`💰 ${esc(g.importe_max)}`)
  foot.push(deadlineLabel(g.plazo_solicitud))
  parts.push(foot.join('   '))
  return parts.join('\n')
}

function grantsMessage(title, grants) {
  if (!grants.length) return `${title}\n\nNo hay convocatorias que mostrar.`
  return `${title}\n\n` + grants.map(grantLine).join('\n\n')
}

// ── Comandos ───────────────────────────────────────────────────
const HELP = [
  '<b>📑 Gestor de Convocatorias</b>',
  '',
  'Comandos disponibles:',
  '/vincular <i>tu@email.com</i> — vincula este chat con tu cuenta',
  '/desvincular — desvincula este chat',
  '/hoy — convocatorias urgentes (≤ 14 días)',
  '/pendientes — convocatorias activas (pendiente/en proceso…)',
  '/resumen — estadísticas de tu cuenta',
  '/buscar — búsqueda autónoma con IA para tu perfil activo',
  '/ayuda — muestra esta ayuda',
].join('\n')

bot.onText(/^\/(start|ayuda|help)\b/, async (msg) => {
  const chatId = msg.chat.id
  const user = await getUser(chatId)
  let head = HELP
  if (user) {
    head = `👋 ¡Hola${user.full_name ? ', ' + esc(user.full_name) : ''}! Tu cuenta está vinculada.\n\n` + HELP
  } else {
    head = '👋 ¡Bienvenido!\n\nPara empezar, vincula este chat con tu cuenta web:\n<code>/vincular tu@email.com</code>\n\n' + HELP
  }
  send(chatId, head)
})

bot.onText(/^\/vincular(?:@\w+)?\s+(.+)$/i, async (msg, match) => {
  const chatId = msg.chat.id
  const email = (match[1] || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return send(chatId, '✋ Email no válido. Uso: <code>/vincular tu@email.com</code>')
  }
  // Buscar la cuenta por email
  const { data: account } = await sb.from('users').select('*').eq('email', email).maybeSingle()
  if (!account) {
    return send(chatId, `No encontré ninguna cuenta con el email <b>${esc(email)}</b>.\n\nRegístrate primero en ${esc(APP_URL)}/auth`)
  }
  // ¿Ya vinculada a otro chat?
  if (account.telegram_id && Number(account.telegram_id) !== chatId) {
    return send(chatId, 'Esta cuenta ya está vinculada a otro chat de Telegram. Usa /desvincular allí primero.')
  }
  const { error } = await sb.from('users')
    .update({ telegram_id: chatId, telegram_linked_at: new Date().toISOString() })
    .eq('id', account.id)
  if (error) return send(chatId, '❌ Error al vincular. Inténtalo de nuevo más tarde.')
  send(chatId, `✅ Cuenta <b>${esc(email)}</b> vinculada correctamente.\n\nYa puedes usar /hoy, /pendientes, /resumen y /buscar.`)
})

bot.onText(/^\/vincular(?:@\w+)?\s*$/i, (msg) => {
  send(msg.chat.id, 'Uso: <code>/vincular tu@email.com</code>')
})

bot.onText(/^\/desvincular\b/, async (msg) => {
  const chatId = msg.chat.id
  const user = await getUser(chatId)
  if (!user) return send(chatId, 'Este chat no está vinculado a ninguna cuenta.')
  await sb.from('users').update({ telegram_id: null, telegram_linked_at: null }).eq('id', user.id)
  send(chatId, '🔌 Cuenta desvinculada. Usa /vincular para volver a conectarla.')
})

async function requireUser(chatId) {
  const user = await getUser(chatId)
  if (!user) {
    send(chatId, 'Primero vincula tu cuenta: <code>/vincular tu@email.com</code>')
    return null
  }
  return user
}

bot.onText(/^\/hoy\b/, async (msg) => {
  const chatId = msg.chat.id
  const user = await requireUser(chatId)
  if (!user) return
  const { data } = await sb.from('grants').select('*')
    .eq('user_id', user.id).not('plazo_solicitud', 'is', null)
    .order('plazo_solicitud', { ascending: true })
  const urgent = (data || []).filter(g => {
    const d = daysLeft(g.plazo_solicitud)
    return d !== null && d >= 0 && d <= 14 && g.status !== 'descartada'
  })
  send(chatId, grantsMessage(`🔥 <b>Urgentes (≤ 14 días)</b> — ${urgent.length}`, urgent))
})

bot.onText(/^\/pendientes\b/, async (msg) => {
  const chatId = msg.chat.id
  const user = await requireUser(chatId)
  if (!user) return
  const { data } = await sb.from('grants').select('*')
    .eq('user_id', user.id).in('status', ACTIVE_STATUSES)
    .order('plazo_solicitud', { ascending: true, nullsFirst: false })
  send(chatId, grantsMessage(`📋 <b>Convocatorias activas</b> — ${(data || []).length}`, data || []))
})

bot.onText(/^\/resumen\b/, async (msg) => {
  const chatId = msg.chat.id
  const user = await requireUser(chatId)
  if (!user) return
  const { data } = await sb.from('grants').select('status,plazo_solicitud').eq('user_id', user.id)
  const grants = data || []
  const by = {}
  for (const g of grants) by[g.status] = (by[g.status] || 0) + 1
  const urgent = grants.filter(g => {
    const d = daysLeft(g.plazo_solicitud)
    return d !== null && d >= 0 && d <= 14 && g.status !== 'descartada'
  }).length
  const lines = [`📊 <b>Resumen</b> — ${grants.length} convocatorias`, '']
  for (const [k, sm] of Object.entries(STATUS_META)) {
    if (by[k]) lines.push(`${sm.icon} ${sm.label}: <b>${by[k]}</b>`)
  }
  lines.push('', `🔥 Urgentes (≤14d): <b>${urgent}</b>`)
  send(chatId, lines.join('\n'))
})

bot.onText(/^\/buscar\b/, async (msg) => {
  const chatId = msg.chat.id
  const user = await requireUser(chatId)
  if (!user) return
  if (!ai) return send(chatId, 'La búsqueda con IA no está configurada (falta ANTHROPIC_API_KEY).')

  const { data: orgs } = await sb.from('organizations').select('*')
    .eq('user_id', user.id).eq('is_archived', false)
    .order('is_default', { ascending: false }).order('created_at')
  const org = (orgs || [])[0]
  if (!org) return send(chatId, `No tienes ningún perfil de empresa. Crea uno en ${esc(APP_URL)}/organizations`)

  send(chatId, `🤖 Buscando convocatorias para <b>${esc(org.name)}</b>… (15-30s)`)
  try {
    const { data: existing } = await sb.from('grants').select('titulo').eq('user_id', user.id).eq('org_id', org.id)
    const existingTitles = (existing || []).map(g => g.titulo)
    const results = await searchGrantsForProfile(org, existingTitles)
    if (!results.length) return send(chatId, '🤷 No encontré convocatorias abiertas que encajen ahora mismo.')

    let saved = 0
    for (const r of results.slice(0, 8)) {
      const { error } = await sb.from('grants').insert({
        user_id: user.id, org_id: org.id,
        titulo: r.titulo, organismo: r.organismo, tipo: r.tipo || 'publica',
        ambito: r.ambito || 'nacional', importe_max: r.importe_max,
        plazo_solicitud: r.plazo_solicitud || null, resumen: r.resumen,
        requisitos: Array.isArray(r.requisitos) ? r.requisitos.join('\n') : (r.requisitos || ''),
        url: r.url || '', elegibilidad: r.elegibilidad, status: 'pendiente',
        notas: `Encontrada por el bot. ${r.matchReason || ''}`.trim(),
        auto_found: true, match_score: r.matchScore, match_reason: r.matchReason, source: 'bot',
      })
      if (!error) saved++
    }
    const top = results.slice(0, 5).map(r =>
      `<b>${esc(r.titulo)}</b>\n${esc(r.organismo || '')} · match ${r.matchScore || '?'}\n${deadlineLabel(r.plazo_solicitud)}`
    ).join('\n\n')
    send(chatId, `✨ <b>${results.length} encontradas</b> (${saved} guardadas en tu cuenta):\n\n${top}\n\nRevísalas en ${esc(APP_URL)}/dashboard`)
  } catch (e) {
    console.error('[/buscar]', e)
    send(chatId, '❌ Error al buscar. Inténtalo de nuevo más tarde.')
  }
})

// ── Búsqueda con IA (espejo de lib/ai.ts) ──────────────────────
function extractJSON(text, bracket) {
  const end = bracket === '{' ? '}' : ']'
  const s = text.indexOf(bracket), e = text.lastIndexOf(end)
  if (s === -1) throw new Error('No JSON')
  return JSON.parse(text.slice(s, e + 1))
}

async function searchGrantsForProfile(org, existingTitles) {
  const sys = `Experto en subvenciones españolas. Busca convocatorias REALES y ACTUALES.
Consulta BDNS (infosubvenciones.es), BOE, boletines autonómicos y fondos europeos.
Devuelve SOLO array JSON sin backticks, máximo 8 resultados:
[{"titulo":"","organismo":"","tipo":"publica|concurso|privada|europeo","ambito":"nacional","importe_max":"","plazo_solicitud":"YYYY-MM-DD o null","resumen":"","requisitos":["r1","r2"],"url":"url real","elegibilidad":"","matchScore":85,"matchReason":"Por qué encaja con este perfil"}]
Solo convocatorias abiertas o próximas a abrir.`
  const user = `Perfil:
- Entidad: ${org.tipo_entidad} "${org.name}"
- CCAA: ${org.ccaa}${org.municipio ? ` (${org.municipio})` : ''}
- CNAE: ${org.cnae || 'no especificado'}${org.cnae_desc ? ` — ${org.cnae_desc}` : ''}
- IAE: ${org.iae || 'no especificado'}${org.iae_desc ? ` — ${org.iae_desc}` : ''}
- Actividad: ${org.actividad || 'no especificada'}
- Empleados: ${org.empleados || 'no especificado'}
- Keywords: ${org.keywords || 'ninguna'}

Ya registradas (no duplicar): ${(existingTitles || []).slice(0, 20).join(', ') || 'ninguna'}

Busca en BDNS, BOE, boletín de ${org.ccaa} y fondos europeos relevantes.`

  const r = await ai.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1500, system: sys,
    messages: [{ role: 'user', content: user }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  })
  const text = r.content.map(b => (b.type === 'text' ? b.text : '')).join('\n')
  try { return extractJSON(text.replace(/```json|```/g, '').trim(), '[') }
  catch { return [] }
}

// ── Alertas de plazos (cron diario, 9:00 Europe/Madrid) ────────
async function runDeadlineAlerts() {
  console.log('[cron] Comprobando plazos…', new Date().toISOString())
  const { data: users } = await sb.from('users').select('*').not('telegram_id', 'is', null)
  for (const user of users || []) {
    const alertDays = (user.alert_days && user.alert_days.length) ? user.alert_days : [7, 3, 1]
    const { data: grants } = await sb.from('grants').select('*')
      .eq('user_id', user.id).not('plazo_solicitud', 'is', null)
      .not('status', 'in', '(descartada,resuelta_positiva,resuelta_negativa)')
    for (const g of grants || []) {
      const d = daysLeft(g.plazo_solicitud)
      if (d === null || d < 0) continue
      if (!alertDays.includes(d)) continue
      // ¿Ya avisado para este grant + nº de días?
      const { data: already } = await sb.from('alerts_sent').select('id')
        .eq('grant_id', g.id).eq('user_id', user.id)
        .eq('channel', 'telegram').eq('days_before', d).maybeSingle()
      if (already) continue
      try {
        await send(user.telegram_id,
          `⏰ <b>Aviso de plazo</b> — quedan <b>${d} día${d === 1 ? '' : 's'}</b>\n\n${grantLine(g)}` +
          (g.url ? `\n\n🔗 ${esc(g.url)}` : ''))
        await sb.from('alerts_sent').insert({
          grant_id: g.id, user_id: user.id, channel: 'telegram', days_before: d,
        })
      } catch (e) {
        console.error('[cron] No pude enviar alerta a', user.telegram_id, e.message)
      }
    }
  }
}

cron.schedule('0 9 * * *', runDeadlineAlerts, { timezone: 'Europe/Madrid' })

// ── Arranque ───────────────────────────────────────────────────
bot.on('polling_error', (e) => console.error('[polling_error]', e.code, e.message))
console.log('🤖 Bot de Convocatorias en marcha. Alertas diarias a las 09:00 Europe/Madrid.')
