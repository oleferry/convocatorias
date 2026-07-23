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
const { matchGrant, formatEuro, tituloCorto } = require('./matching')

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
  const { data, error } = await sb.from('users').select('*').eq('telegram_id', chatId).maybeSingle()
  if (error) console.error('[getUser] Supabase error:', error.message)
  return data || null
}

// Canjea un token de vinculación generado en el dashboard (/start <token>)
async function linkByToken(chatId, token) {
  const { data: row, error } = await sb.from('telegram_link_tokens').select('*').eq('token', token).maybeSingle()
  if (error) console.error('[linkByToken] Supabase error (revisa SUPABASE_SERVICE_ROLE_KEY/URL en Railway):', error.message)
  if (!row) console.warn('[linkByToken] Token no encontrado en BD:', token)
  else if (row.used_at) console.warn('[linkByToken] Token ya usado:', token)
  else if (new Date(row.expires_at) < new Date()) console.warn('[linkByToken] Token caducado:', token, row.expires_at)
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    return send(chatId, '⌛ Ese enlace ya no vale (caducan a los 15 min). Genera uno nuevo desde tu panel → <b>"Conectar Telegram"</b>.')
  }
  // Libera este chat de cualquier otra cuenta y vincúlalo a la correcta
  await sb.from('users').update({ telegram_id: null, telegram_linked_at: null }).eq('telegram_id', chatId).neq('id', row.user_id)
  await sb.from('users').update({ telegram_id: chatId, telegram_linked_at: new Date().toISOString() }).eq('id', row.user_id)
  await sb.from('telegram_link_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)

  const { data: u } = await sb.from('users').select('full_name').eq('id', row.user_id).maybeSingle()
  send(chatId, `✅ ¡Conectado${u && u.full_name ? ', ' + esc(u.full_name) : ''}! Ya soy tu perro. 🐾\n\nPrueba /hoy, o pégame el link de un concurso y te lo guardo en la carpeta.`)
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
  if (!grants.length) return `${title}\n\nDe momento, nada por aquí. Mejor eso que ir con prisas. 🌴`
  return `${title}\n\n` + grants.map(grantLine).join('\n\n')
}

// ── Comandos ───────────────────────────────────────────────────
const HELP = [
  '<b>🐾 DamePerrasPerro</b> — el perro que encuentra las perras.',
  '',
  'Esto es lo que sé hacer:',
  '/sugerencias — lo que tengo ya olfateado para ti (al instante)',
  '/hoy — lo que cierra pronto (no te despistes)',
  '/pendientes — lo que tienes entre manos',
  '/resumen — cómo vas, en números',
  '/buscar — salgo a olfatear ayudas nuevas por internet (más lento)',
  '/perfil — si llevas varias empresas, elige a cuál mando lo que encuentre',
  '/desvincular — si te quieres ir (tú verás)',
  '',
  '🔒 ¿Aún no estás conectado? Hazlo desde tu panel → <b>"Conectar Telegram"</b>.',
  '🦴 ¿Has visto un concurso, beca o premio por ahí? <b>Pégame el link</b> y te lo guardo en la carpeta.',
].join('\n')

bot.onText(/^\/(start|ayuda|help)(?:@\w+)?(?:\s+(\S+))?/i, async (msg, match) => {
  const chatId = msg.chat.id
  const cmd = (match[1] || '').toLowerCase()
  const payload = match[2]
  if (cmd === 'start' && payload) return linkByToken(chatId, payload)  // /start <token>

  const user = await getUser(chatId)
  let head = HELP
  if (user) {
    head = `👋 Cuánto tiempo${user.full_name ? ', ' + esc(user.full_name) : ''}. Tu cuenta está conectada y yo, vigilando plazos por ti.\n\n` + HELP
  } else {
    head = '👋 Encantado.\n\nMe dedico a una sola cosa: que no se te escape ni una perra.\n\nPara empezar, conéctame desde tu panel de DamePerrasPerro → botón <b>"Conectar Telegram"</b>. Es un clic.\n\n' + HELP
  }
  send(chatId, head)
})

bot.onText(/^\/vincular\b/i, (msg) => {
  send(msg.chat.id, '🔒 Para conectarte de forma segura, entra en tu panel de DamePerrasPerro → botón <b>"Conectar Telegram"</b> y pulsa el enlace. Así nadie puede suplantarte.')
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
    send(chatId, 'Eh, eh. Antes conéctame desde tu panel de DamePerrasPerro → <b>"Conectar Telegram"</b>. 🙂')
    return null
  }
  return user
}

// ── Perfil activo del bot (para cuentas con varias empresas) ───
// Si el usuario ha elegido perfil con /perfil, se usa ese (mientras siga
// existiendo y no esté archivado). Si no, cae al de siempre: el por
// defecto o el más antiguo.
async function userOrgs(userId) {
  const { data } = await sb.from('organizations').select('*')
    .eq('user_id', userId).eq('is_archived', false)
    .order('is_default', { ascending: false }).order('created_at')
  return data || []
}

async function activeOrgFor(user) {
  const orgs = await userOrgs(user.id)
  if (user.bot_active_org_id) {
    const chosen = orgs.find(o => o.id === user.bot_active_org_id)
    if (chosen) return chosen
  }
  return orgs[0] || null
}

bot.onText(/^\/perfil\b\s*(.*)/i, async (msg, match) => {
  const chatId = msg.chat.id
  const user = await requireUser(chatId)
  if (!user) return
  const orgs = await userOrgs(user.id)
  if (!orgs.length) return send(chatId, `Aún no tienes ningún perfil de empresa. Créate uno aquí: ${esc(APP_URL)}/organizations`)

  const query = (match[1] || '').trim()
  if (!query) {
    const active = await activeOrgFor(user)
    const lines = orgs.map(o => `${o.id === active?.id ? '👉' : '•'} ${esc(o.name)}`)
    return send(chatId, `<b>Tus perfiles:</b>\n\n${lines.join('\n')}\n\nActivo ahora: <b>${esc(active?.name || '—')}</b>.\nCambia con <code>/perfil nombre</code>.`)
  }

  const q = query.toLowerCase()
  const hits = orgs.filter(o => o.name.toLowerCase().includes(q))
  if (hits.length === 0) {
    return send(chatId, `No encuentro ningún perfil que se parezca a "${esc(query)}". Tienes: ${orgs.map(o => esc(o.name)).join(', ')}.`)
  }
  if (hits.length > 1) {
    return send(chatId, `Hay varios que coinciden: ${hits.map(o => esc(o.name)).join(', ')}. Sé más concreto.`)
  }
  await sb.from('users').update({ bot_active_org_id: hits[0].id }).eq('id', user.id)
  send(chatId, `✅ Vale, lo siguiente que me mandes (links, /sugerencias, /buscar) va a la carpeta de <b>${esc(hits[0].name)}</b>.`)
})

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
  send(chatId, grantsMessage(`🔥 <b>Esto corre prisa</b> (≤ 14 días) — ${urgent.length}`, urgent))
})

bot.onText(/^\/pendientes\b/, async (msg) => {
  const chatId = msg.chat.id
  const user = await requireUser(chatId)
  if (!user) return
  const { data } = await sb.from('grants').select('*')
    .eq('user_id', user.id).in('status', ACTIVE_STATUSES)
    .order('plazo_solicitud', { ascending: true, nullsFirst: false })
  send(chatId, grantsMessage(`📋 <b>Lo que tienes entre manos</b> — ${(data || []).length}`, data || []))
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
  const lines = [`📊 <b>Así vas</b> — ${grants.length} convocatorias`, '']
  for (const [k, sm] of Object.entries(STATUS_META)) {
    if (by[k]) lines.push(`${sm.icon} ${sm.label}: <b>${by[k]}</b>`)
  }
  lines.push('', `🔥 Urgentes (≤14d): <b>${urgent}</b>`)
  send(chatId, lines.join('\n'))
})

// Catálogo ya poblado (BDNS + radar privado/europeo) — instantáneo y gratis,
// a diferencia de /buscar que llama a la IA con búsqueda web en vivo.
bot.onText(/^\/sugerencias\b/, async (msg) => {
  const chatId = msg.chat.id
  const user = await requireUser(chatId)
  if (!user) return

  const org = await activeOrgFor(user)
  if (!org) return send(chatId, `Aún no me has dicho a qué te dedicas. Créate un perfil aquí y sabré qué buscarte: ${esc(APP_URL)}/organizations`)

  const today = new Date().toISOString().slice(0, 10)
  const [{ data: bdns }, { data: radar }, { data: saved }] = await Promise.all([
    sb.from('convocatorias_publicas').select('*')
      .not('fecha_fin', 'is', null).gte('fecha_fin', today)
      .or(`nivel1.eq.ESTATAL,ccaa.eq.${org.ccaa}`).limit(400),
    sb.from('convocatorias_publicas').select('*').neq('fuente', 'bdns').limit(150),
    sb.from('grants').select('codigo_bdns').eq('user_id', user.id).not('codigo_bdns', 'is', null),
  ])
  const savedSet = new Set((saved || []).map(g => g.codigo_bdns))
  const pool = [...(bdns || []), ...(radar || [])].filter(c => !savedSet.has(c.codigo_bdns))
  const hits = pool.map(c => ({ c, m: matchGrant(c, org, today) })).filter(x => x.m.match)
    .sort((a, b) => (a.m.tier === 'sector' ? 0 : 1) - (b.m.tier === 'sector' ? 0 : 1) || b.m.score - a.m.score)

  if (!hits.length) return send(chatId, `🔍 Sin sugerencias por ahora para <b>${esc(org.name)}</b>. En cuanto huela algo, te aviso. Prueba /buscar para que salga a olfatear por internet.`)

  const fmt = (x) => {
    const c = x.c
    const plazo = c.fecha_fin ? deadlineLabel(c.fecha_fin) : '🔁 consulta el plazo en la web'
    return `<b>${esc(tituloCorto(c.titulo))}</b>\n${c.presupuesto_total != null ? `💰 ${esc(formatEuro(c.presupuesto_total))}   ` : ''}${plazo}${c.bases_url ? `\n🔗 ${esc(c.bases_url)}` : ''}`
  }
  const sector = hits.filter(x => x.m.tier === 'sector').slice(0, 5)
  const elegibles = hits.filter(x => x.m.tier === 'elegible').slice(0, 3)
  const parts = [`🐾 He olfateado <b>${hits.length}</b> para <b>${esc(org.name)}</b>:`]
  if (sector.length) parts.push(`\n🎯 <b>Para tu sector</b>\n\n` + sector.map(fmt).join('\n\n'))
  if (elegibles.length) parts.push(`\n🤝 <b>También podrías optar</b>\n\n` + elegibles.map(fmt).join('\n\n'))
  parts.push(`\n👉 Ver y guardar: ${esc(APP_URL)}/dashboard`)
  send(chatId, parts.join('\n'))
})

bot.onText(/^\/buscar\b/, async (msg) => {
  const chatId = msg.chat.id
  const user = await requireUser(chatId)
  if (!user) return
  if (!ai) return send(chatId, 'La búsqueda con IA no está configurada (falta ANTHROPIC_API_KEY).')

  const org = await activeOrgFor(user)
  if (!org) return send(chatId, `Aún no me has dicho a qué te dedicas. Créate un perfil aquí y sabré qué buscarte: ${esc(APP_URL)}/organizations`)

  send(chatId, `🔎 Me voy a peinar la BDNS buscando algo para <b>${esc(org.name)}</b>. Dame 15-30s…`)
  try {
    const { data: existing } = await sb.from('grants').select('titulo').eq('user_id', user.id).eq('org_id', org.id)
    const existingTitles = (existing || []).map(g => g.titulo)
    const results = await searchGrantsForProfile(org, existingTitles)
    if (!results.length) return send(chatId, '🤷 Hoy no hay pesca: nada nuevo que te encaje ahora mismo. Volveré a intentarlo.')

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
    send(chatId, `✨ ¡Mira lo que te traigo! <b>${results.length}</b>, y ya te he guardado ${saved} en el panel:\n\n${top}\n\nLas tienes en ${esc(APP_URL)}/dashboard`)
  } catch (e) {
    console.error('[/buscar]', e)
    send(chatId, '❌ Se me ha atascado la búsqueda. Prueba otra vez en un rato.')
  }
})

// ── Búsqueda con IA (espejo de lib/ai.ts) ──────────────────────
function extractJSON(text, bracket) {
  const end = bracket === '{' ? '}' : ']'
  const s = text.indexOf(bracket), e = text.lastIndexOf(end)
  if (s === -1) throw new Error('No JSON')
  return JSON.parse(text.slice(s, e + 1))
}

// Registra el coste real de la llamada (espejo de lib/costs.ts) — best-effort.
const PRICING = { 'claude-sonnet-4-6': { in: 3, out: 15 } }
async function logApiUsage(feature, model, usage, userId, orgId) {
  try {
    const p = PRICING[model] || PRICING['claude-sonnet-4-6']
    const inTok = (usage && usage.input_tokens) || 0
    const outTok = (usage && usage.output_tokens) || 0
    const cacheTok = ((usage && usage.cache_creation_input_tokens) || 0) + ((usage && usage.cache_read_input_tokens) || 0)
    const cost = ((inTok + cacheTok) * p.in + outTok * p.out) / 1_000_000
    await sb.from('api_usage_log').insert({
      provider: 'anthropic', feature, source: 'bot', model,
      input_tokens: inTok, output_tokens: outTok, cache_creation_tokens: usage?.cache_creation_input_tokens || 0,
      cache_read_tokens: usage?.cache_read_input_tokens || 0, cost_usd: cost,
      user_id: userId || null, org_id: orgId || null,
    })
  } catch (e) { console.warn('[logApiUsage]', e.message) }
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
  logApiUsage('search_web', 'claude-sonnet-4-6', r.usage, org.user_id, org.id).catch(() => {})
  const text = r.content.map(b => (b.type === 'text' ? b.text : '')).join('\n')
  try { return extractJSON(text.replace(/```json|```/g, '').trim(), '[') }
  catch { return [] }
}

// Analiza un link/texto suelto (concurso, beca, premio…) → objeto convocatoria
async function analyzeGrant(input, userId) {
  const sys = `Experto en subvenciones, concursos, premios y becas en España. Devuelve SOLO JSON sin backticks:
{"titulo":"","organismo":"","tipo":"publica|concurso|privada|europeo","ambito":"local|autonómico|nacional|europeo|internacional","importe_max":"","plazo_solicitud":"YYYY-MM-DD o null","resumen":"2-3 frases","requisitos":"uno por línea","url":"url o null","elegibilidad":""}`
  const r = await ai.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1500, system: sys,
    messages: [{ role: 'user', content: `Analiza esto y extrae la convocatoria:\n${input}` }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  })
  logApiUsage('analyze', 'claude-sonnet-4-6', r.usage, userId, null).catch(() => {})
  const text = r.content.map(b => (b.type === 'text' ? b.text : '')).join('\n')
  return extractJSON(text.replace(/```json|```/g, '').trim(), '{')
}

// ── Tragar links: concursos/becas/premios que no están en la BDNS ──
const TIPOS_VALIDOS = ['publica', 'concurso', 'privada', 'europeo']
const URL_RE = /https?:\/\/[^\s]+/i

bot.on('message', async (msg) => {
  const text = (msg.text || '').trim()
  if (!text || text.startsWith('/')) return       // los comandos los gestiona onText
  const m = text.match(URL_RE)
  if (!m) return                                   // solo nos interesan mensajes con link
  const chatId = msg.chat.id

  const user = await getUser(chatId)
  if (!user) return send(chatId, '🐾 Huele bien… pero antes conéctame desde tu panel → <b>"Conectar Telegram"</b>.')
  if (!ai) return send(chatId, 'Necesito la IA configurada para oler links (falta ANTHROPIC_API_KEY).')

  send(chatId, '🐾 Déjame oler esto…')
  try {
    const p = await analyzeGrant(text, user.id)
    const org = await activeOrgFor(user)

    const { data, error } = await sb.from('grants').insert({
      user_id: user.id, org_id: org?.id || null,
      titulo: p.titulo || 'Convocatoria sin título', organismo: p.organismo || '',
      tipo: TIPOS_VALIDOS.includes(p.tipo) ? p.tipo : 'privada',
      ambito: p.ambito || 'nacional',
      importe_max: p.importe_max || null, plazo_solicitud: p.plazo_solicitud || null,
      resumen: p.resumen || '',
      requisitos: Array.isArray(p.requisitos) ? p.requisitos.join('\n') : (p.requisitos || ''),
      url: p.url || m[0], elegibilidad: p.elegibilidad || '', status: 'pendiente',
      notas: 'Te la traje yo desde un link de Telegram. 🐾', auto_found: true, source: 'bot',
    }).select().single()
    if (error) throw error

    const folder = org ? ` (carpeta de <b>${esc(org.name)}</b>)` : ''
    send(chatId, `🦴 ¡Toma! Ya la tienes en tu carpeta${folder}:\n\n${grantLine(data)}\n\nLa ves en ${esc(APP_URL)}/dashboard`)
  } catch (e) {
    console.error('[link]', e)
    send(chatId, '😕 Este link se me ha atragantado. Pégalo en la web (+ Nueva → Analizar con IA) y lo guardo seguro.')
  }
})

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
          `⏰ Que se te echa el tiempo encima: quedan <b>${d} día${d === 1 ? '' : 's'}</b>.\n\n${grantLine(g)}` +
          (g.url ? `\n\n🔗 ${esc(g.url)}` : '') +
          `\n\nLuego no digas que nadie te avisó. 😏`)
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

// Menú de comandos (botón "/" en Telegram) — guía a la gente paso a paso.
bot.setMyCommands([
  { command: 'start', description: '🐾 Empezar / conectar tu cuenta' },
  { command: 'sugerencias', description: '✨ Ayudas ya olfateadas para ti (al instante)' },
  { command: 'hoy', description: '🔥 Lo que cierra pronto (≤14 días)' },
  { command: 'pendientes', description: '📋 Lo que tienes entre manos' },
  { command: 'resumen', description: '📊 Cómo vas, en números' },
  { command: 'buscar', description: '🔎 Salgo a olfatear ayudas nuevas por internet' },
  { command: 'perfil', description: '🏷️ Elegir a qué empresa mando lo que encuentre' },
  { command: 'ayuda', description: '❓ Qué sé hacer' },
  { command: 'desvincular', description: '🔌 Desconectar tu cuenta' },
]).catch((e) => console.error('[setMyCommands]', e.message))

// Ping de arranque: confirma que la clave de Supabase es la correcta (service_role,
// no anon) — si es la anon, RLS bloquea las lecturas en silencio y todo "parece"
// caducado/vacío aunque los datos existan.
sb.from('telegram_link_tokens').select('token', { count: 'exact', head: true }).then(({ count, error }) => {
  if (error) console.error('❌ Supabase no responde bien (revisa SUPABASE_SERVICE_ROLE_KEY/URL):', error.message)
  else console.log(`✅ Supabase OK. Tokens de vinculación pendientes: ${count ?? 0}`)
})
