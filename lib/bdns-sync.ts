// ================================================================
//  Sincronización BDNS → catálogo (usable desde un endpoint de Vercel)
//  Versión acotada para caber en el límite de tiempo de una función
//  serverless. Pre-filtra por las CCAA de los perfiles de usuario.
// ================================================================
import { searchConvocatorias, getConvocatoriaDetail, normalizeDetail, normalizeCcaa } from './bdns'

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export interface SyncResult { candidates: number; ingested: number; from: string; to: string }

export async function syncBdns(sb: any, opts: { sinceDays?: number; maxDetails?: number } = {}): Promise<SyncResult> {
  const maxDetails = opts.maxDetails ?? 120
  const today = new Date()

  // Punto de partida (sync incremental)
  let since: Date
  const { data: state } = await sb.from('bdns_sync_state').select('last_fecha_recepcion').eq('id', 1).maybeSingle()
  if (state?.last_fecha_recepcion) since = new Date(state.last_fecha_recepcion)
  else { since = new Date(); since.setDate(since.getDate() - (opts.sinceDays ?? 7)) }

  // CCAA activas (de los perfiles) → solo pedimos detalle de lo relevante
  const { data: orgs } = await sb.from('organizations').select('ccaa').eq('is_archived', false)
  const ccaaSet = new Set((orgs || []).map((o: any) => o.ccaa).filter(Boolean))
  const hasFilter = ccaaSet.size > 0

  // 1) Recolectar resúmenes de la ventana
  const candidates: any[] = []
  let page = 0, totalPages = 1
  do {
    const res = await searchConvocatorias({ page, pageSize: 500, fechaDesde: since, fechaHasta: today, order: 'fechaRecepcion', direccion: 'asc' })
    totalPages = res.totalPages || 1
    for (const it of res.content || []) {
      if (!hasFilter) { candidates.push(it); continue }
      if ((it.nivel1 || '').toUpperCase() === 'ESTATAL') { candidates.push(it); continue }
      const ccaa = normalizeCcaa(it.nivel1, it.nivel2)
      if (ccaa && ccaaSet.has(ccaa)) candidates.push(it)
    }
    page++
  } while (page < totalPages && page < 20)

  // 2) Detalle + normalización (acotado para no exceder el timeout)
  const rows: any[] = []
  const limit = Math.min(candidates.length, maxDetails)
  for (let i = 0; i < limit; i++) {
    try { rows.push(normalizeDetail(await getConvocatoriaDetail(candidates[i].numeroConvocatoria))) }
    catch { /* salta los que fallen */ }
    await sleep(20)
  }

  // 3) Upsert — solo lo que tiene plazo de solicitud futuro (lo demás no aporta)
  const tISO = ymd(today)
  const useful = rows.filter(r => r.fecha_fin && r.fecha_fin >= tISO)
  for (let i = 0; i < useful.length; i += 200) {
    const { error } = await sb.from('convocatorias_publicas').upsert(useful.slice(i, i + 200), { onConflict: 'codigo_bdns' })
    if (error) throw new Error('upsert: ' + error.message)
  }

  // 4) Avanzar el puntero. Si nos quedamos cortos (cap), continuamos donde
  //    lo dejamos la próxima vez; si no, hasta hoy.
  const capped = limit < candidates.length && rows.length > 0
  const last = capped ? (rows[rows.length - 1].fecha_recepcion || ymd(today)) : ymd(today)
  await sb.from('bdns_sync_state').update({
    last_fecha_recepcion: last, last_run_at: new Date().toISOString(), last_count: rows.length,
  }).eq('id', 1)

  return { candidates: candidates.length, ingested: rows.length, from: ymd(since), to: ymd(today) }
}
