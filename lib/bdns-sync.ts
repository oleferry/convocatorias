// ================================================================
//  Sincronización BDNS → catálogo (usable desde un endpoint de Vercel)
//  Versión acotada para caber en el límite de tiempo de una función
//  serverless. Ingiere toda España; acotar por usuario es cosa del
//  matching, no de la ingesta.
// ================================================================
import { searchConvocatorias, getConvocatoriaDetail, normalizeDetail } from './bdns'
import { esConcesionDirecta } from './matching'

function ymd(d: Date) { return d.toISOString().slice(0, 10) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export interface SyncResult {
  candidates: number; ingested: number; from: string; to: string
  detalles?: number; guardadas?: number; siguienteOffset?: number | null
}

export async function syncBdns(
  sb: any,
  opts: { sinceDays?: number; maxDetails?: number; desde?: Date; hasta?: Date; backfill?: boolean; offset?: number } = {},
): Promise<SyncResult> {
  const maxDetails = opts.maxDetails ?? 120
  const today = opts.hasta ?? new Date()

  // Punto de partida. En modo backfill la ventana viene dada (barrido
  // histórico por tramos) y NO se toca el puntero incremental, para no
  // romper la ingesta diaria.
  let since: Date
  if (opts.desde) {
    since = opts.desde
  } else {
    const { data: state } = await sb.from('bdns_sync_state').select('last_fecha_recepcion').eq('id', 1).maybeSingle()
    if (state?.last_fecha_recepcion) since = new Date(state.last_fecha_recepcion)
    else { since = new Date(); since.setDate(since.getDate() - (opts.sinceDays ?? 7)) }
  }

  // 1) Recolectar resúmenes de la ventana — de TODA España.
  //
  // Antes esto se acotaba a las CCAA de los perfiles existentes, y era una
  // pescadilla que se mordía la cola: como todos los usuarios eran de Castilla
  // y León, solo se ingerían ayudas de Castilla y León; las 16 páginas
  // públicas del resto de comunidades se quedaban sin nada regional que
  // enseñar y mostraban las mismas 198 estatales y europeas — 16 duplicados
  // que Google descarta. Sin ayudas de Aragón no llegan usuarios de Aragón, y
  // sin usuarios de Aragón no se ingerían ayudas de Aragón.
  //
  // Ingerir de más no ensucia a nadie: el filtro por capas de matching.ts ya
  // descarta por ubicación antes de enseñar nada a un usuario. El ritmo queda
  // acotado por `maxDetails` en cada pasada.
  const candidates: any[] = []
  let page = 0, totalPages = 1
  do {
    const res = await searchConvocatorias({ page, pageSize: 500, fechaDesde: since, fechaHasta: today, order: 'fechaRecepcion', direccion: 'asc' })
    totalPages = res.totalPages || 1
    for (const it of res.content || []) candidates.push(it)
    page++
  } while (page < totalPages && page < 20)

  // 2) Detalle + normalización (acotado para no exceder el timeout).
  // El barrido histórico recorre los candidatos por tramos con `offset`: en
  // orden cronológico ascendente los primeros son los más antiguos (plazo ya
  // cerrado), así que sin paginar solo se veía la parte inútil de la ventana.
  const offset = opts.offset ?? 0
  const rows: any[] = []
  const limit = Math.min(candidates.length, offset + maxDetails)
  for (let i = offset; i < limit; i++) {
    try { rows.push(normalizeDetail(await getConvocatoriaDetail(candidates[i].numeroConvocatoria))) }
    catch { /* salta los que fallen */ }
    await sleep(20)
  }

  // 3) Upsert — solo lo que tiene plazo de solicitud futuro (lo demás no aporta)
  // y no es concesión directa (adjudicada ya por nombre a una entidad concreta:
  // no la puede solicitar nadie más, ni merece la pena resumirla ni guardarla).
  const tISO = ymd(today)
  const useful = rows.filter(r => r.fecha_fin && r.fecha_fin >= tISO && !esConcesionDirecta(r.tipo_convocatoria))

  // Los resúmenes con IA ya NO se generan aquí. Cada uno tarda segundos, y al
  // ingerir toda España (~124 convocatorias nuevas al día, en vez de las pocas
  // de una sola comunidad) este bucle se comía el límite de 300 s de la
  // función. Ahora los hace syncResumenCatalogo, que el cron llama justo
  // después: busca las abiertas que no tengan resumen, sean de hoy o de otro
  // día, así que ninguna se queda sin él — solo tarda alguna pasada más.

  for (let i = 0; i < useful.length; i += 200) {
    const { error } = await sb.from('convocatorias_publicas').upsert(useful.slice(i, i + 200), { onConflict: 'codigo_bdns' })
    if (error) throw new Error('upsert: ' + error.message)
  }

  // 4) Avanzar el puntero. Si nos quedamos cortos (cap), continuamos donde
  //    lo dejamos la próxima vez; si no, hasta hoy.
  // En backfill NO se toca: su ventana la marca quien lo llama, y mover el
  // puntero hacia atrás haría que la ingesta diaria reprocesara meses.
  if (!opts.backfill) {
    const capped = limit < candidates.length && rows.length > 0
    const last = capped ? (rows[rows.length - 1].fecha_recepcion || ymd(today)) : ymd(today)
    await sb.from('bdns_sync_state').update({
      last_fecha_recepcion: last, last_run_at: new Date().toISOString(), last_count: rows.length,
    }).eq('id', 1)
  }

  return {
    candidates: candidates.length,
    ingested: rows.length,
    detalles: rows.length,          // detalles pedidos en esta pasada
    guardadas: useful.length,       // de esos, los que estaban abiertos y valían
    siguienteOffset: limit < candidates.length ? limit : null,
    from: ymd(since), to: ymd(today),
  }
}
