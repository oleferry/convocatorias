// ================================================================
//  Worker de ingesta BDNS → catálogo público (Supabase)
//
//  Modos:
//   node ingest-bdns.js            ← una pasada (para cron externo)
//   node ingest-bdns.js --watch    ← se autoprograma (cron diario 06:00)
//   node ingest-bdns.js --dry-run  ← sin BD: trae y normaliza, imprime
//
//  Estrategia: sync incremental por fecha de recepción. Solo se piden
//  los DETALLES de convocatorias estatales o de las CCAA que algún
//  perfil de usuario tiene configuradas (ahorra miles de llamadas).
//
//  Deploy: Railway (Root Directory: worker, Start: npm start) o como
//  cron job que ejecute `node ingest-bdns.js`.
// ================================================================

const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api'
const VPD = 'GE'

const DRY = process.argv.includes('--dry-run')
const WATCH = process.argv.includes('--watch')

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env

let sb = null
function initDb() {
  if (sb || DRY) return sb
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (usa --dry-run para probar sin BD)')
    process.exit(1)
  }
  const { createClient } = require('@supabase/supabase-js')
  sb = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return sb
}

// Límite de detalles por pasada (protección ante ventanas grandes)
const MAX_DETAILS = Number(process.env.BDNS_MAX_DETAILS || 1500)
const DETAIL_DELAY_MS = Number(process.env.BDNS_DETAIL_DELAY_MS || 120)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── API BDNS ───────────────────────────────────────────────────
function toBdnsDate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

async function bdnsGet(path, params) {
  const qs = new URLSearchParams({ vpd: VPD })
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const url = `${BDNS_BASE}${path}?${qs.toString()}`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (res.status === 429 || res.status >= 500) { await sleep(800 * (attempt + 1)); continue }
      if (!res.ok) throw new Error(`BDNS ${path} → ${res.status}`)
      return res.json()
    } catch (e) {
      if (attempt === 2) throw e
      await sleep(800 * (attempt + 1))
    }
  }
}

async function searchPage(fechaDesde, fechaHasta, page, pageSize) {
  return bdnsGet('/convocatorias/busqueda', {
    page, pageSize, order: 'fechaRecepcion', direccion: 'asc',
    fechaDesde: toBdnsDate(fechaDesde), fechaHasta: toBdnsDate(fechaHasta),
  })
}

async function getDetail(numConv) {
  return bdnsGet('/convocatorias', { numConv })
}

// ── Normalización (espejo de lib/bdns.ts) ──────────────────────
const CCAA_MATCHERS = [
  [/asturias/, 'Asturias'], [/cantabr/, 'Cantabria'], [/madrid/, 'Madrid'],
  [/andaluc/, 'Andalucía'], [/castilla.?la.?mancha/, 'Castilla-La Mancha'],
  [/castilla y le|castilla.?leon/, 'Castilla y León'], [/catal|cataluny/, 'Cataluña'],
  [/valencia|valencian/, 'Valencia'], [/galicia/, 'Galicia'], [/vasco|euskadi/, 'País Vasco'],
  [/navarra/, 'Navarra'], [/murcia/, 'Murcia'], [/balear/, 'Baleares'], [/canaria/, 'Canarias'],
  [/extremadura/, 'Extremadura'], [/rioja/, 'La Rioja'], [/aragon/, 'Aragón'],
  [/melilla/, 'Melilla'], [/ceuta/, 'Ceuta'],
]

function normalizeCcaa(nivel1, nivel2) {
  if (!nivel2) return null
  if ((nivel1 || '').toUpperCase() === 'ESTATAL') return null
  const norm = nivel2.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [re, name] of CCAA_MATCHERS) if (re.test(norm)) return name
  return null
}

function normalizeDetail(d) {
  const nivel1 = (d.organo && d.organo.nivel1) || null
  const ccaaRaw = (d.organo && d.organo.nivel2) || null
  return {
    codigo_bdns: d.codigoBDNS || String(d.id),
    id_bdns: d.id != null ? d.id : null,
    titulo: d.descripcion || '(sin título)',
    tipo_convocatoria: d.tipoConvocatoria || null,
    nivel1,
    ccaa_raw: ccaaRaw,
    ccaa: normalizeCcaa(nivel1, ccaaRaw),
    organo: (d.organo && d.organo.nivel3) || null,
    presupuesto_total: typeof d.presupuestoTotal === 'number' ? d.presupuestoTotal : null,
    finalidad: d.descripcionFinalidad || null,
    beneficiarios: (d.tiposBeneficiarios || []).map(b => b.descripcion).filter(Boolean),
    sectores: (d.sectores || []).map(s => ({ codigo: s.codigo, descripcion: s.descripcion })),
    regiones: (d.regiones || []).map(r => r.descripcion).filter(Boolean),
    bases_desc: d.descripcionBasesReguladoras || null,
    bases_url: d.urlBasesReguladoras || null,
    sede_url: d.sedeElectronica || null,
    es_ayuda_estado: !!d.ayudaEstado,
    mrr: !!d.mrr,
    abierto: !!d.abierto,
    fecha_inicio: d.fechaInicioSolicitud || null,
    fecha_fin: d.fechaFinSolicitud || null,
    fecha_recepcion: d.fechaRecepcion || null,
  }
}

// ── Sincronización ─────────────────────────────────────────────
function ymd(d) { return d.toISOString().slice(0, 10) }

async function getActiveCcaaSet() {
  if (DRY || !sb) return null // null = sin pre-filtro
  const { data } = await sb.from('organizations').select('ccaa').eq('is_archived', false)
  const set = new Set((data || []).map(o => o.ccaa).filter(Boolean))
  return set.size ? set : null
}

async function getSyncSince() {
  const fallback = new Date(); fallback.setDate(fallback.getDate() - 7)
  if (DRY || !sb) return fallback
  const { data } = await sb.from('bdns_sync_state').select('last_fecha_recepcion').eq('id', 1).maybeSingle()
  if (data && data.last_fecha_recepcion) return new Date(data.last_fecha_recepcion)
  return fallback
}

function keepByCcaa(item, ccaaSet) {
  if (!ccaaSet) return true // sin perfiles → ingerir todo
  if ((item.nivel1 || '').toUpperCase() === 'ESTATAL') return true
  const ccaa = normalizeCcaa(item.nivel1, item.nivel2)
  return ccaa ? ccaaSet.has(ccaa) : false
}

async function runOnce() {
  const started = Date.now()
  initDb()
  const since = await getSyncSince()
  const today = new Date()
  const ccaaSet = await getActiveCcaaSet()
  console.log(`[bdns] sync ${ymd(since)} → ${ymd(today)}  pre-filtro CCAA: ${ccaaSet ? [...ccaaSet].join(', ') : '(ninguno: todo)'}`)

  // 1) Recolectar resúmenes paginando la ventana de fechas
  const pageSize = 500
  let page = 0, totalPages = 1
  const candidates = []
  do {
    const res = await searchPage(since, today, page, pageSize)
    totalPages = res.totalPages || 1
    for (const it of (res.content || [])) if (keepByCcaa(it, ccaaSet)) candidates.push(it)
    page++
  } while (page < totalPages && page < 60)

  console.log(`[bdns] candidatas tras pre-filtro: ${candidates.length} (de ${totalPages} páginas)`)

  // 2) Detalle + normalización (con tope y throttle)
  const rows = []
  const limit = Math.min(candidates.length, MAX_DETAILS)
  for (let i = 0; i < limit; i++) {
    try {
      const d = await getDetail(candidates[i].numeroConvocatoria)
      rows.push(normalizeDetail(d))
    } catch (e) {
      console.warn('[bdns] detalle falló', candidates[i].numeroConvocatoria, e.message)
    }
    if (DETAIL_DELAY_MS) await sleep(DETAIL_DELAY_MS)
    if ((i + 1) % 100 === 0) console.log(`[bdns]  …${i + 1}/${limit} detalles`)
  }

  // 3) Persistir (upsert)
  if (DRY || !sb) {
    console.log(`[bdns] DRY-RUN: ${rows.length} filas normalizadas. Muestra:`)
    console.dir(rows.slice(0, 2), { depth: null })
  } else {
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200)
      const { error } = await sb.from('convocatorias_publicas').upsert(batch, { onConflict: 'codigo_bdns' })
      if (error) console.error('[bdns] upsert error', error.message)
    }
    await sb.from('bdns_sync_state').update({
      last_fecha_recepcion: ymd(today), last_run_at: new Date().toISOString(), last_count: rows.length,
    }).eq('id', 1)
  }

  console.log(`[bdns] hecho: ${rows.length} convocatorias en ${((Date.now() - started) / 1000).toFixed(1)}s`)
  return rows.length
}

// ── Arranque (solo si se ejecuta directamente) ─────────────────
if (require.main === module) {
  if (WATCH) {
    const cron = require('node-cron')
    console.log('🗂️  Worker BDNS en marcha. Ingesta diaria 06:00 Europe/Madrid.')
    cron.schedule('0 6 * * *', () => runOnce().catch(e => console.error('[bdns] run error', e)), { timezone: 'Europe/Madrid' })
    runOnce().catch(e => console.error('[bdns] run error', e)) // primera pasada al arrancar
  } else {
    runOnce().then(() => process.exit(0)).catch(e => { console.error('[bdns] run error', e); process.exit(1) })
  }
}

module.exports = { runOnce }
