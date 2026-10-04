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
  opts: { sinceDays?: number; maxDetails?: number; desde?: Date; hasta?: Date; backfill?: boolean; offset?: number; hastaMs?: number } = {},
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
  let limit = Math.min(candidates.length, offset + maxDetails)
  for (let i = offset; i < limit; i++) {
    // Tope de tiempo opcional: si se acaba, se para aquí y se guarda lo hecho
    // (siguienteOffset dice por dónde seguir), en vez de que la función muera
    // a los 300 s sin guardar nada.
    if (opts.hastaMs && Date.now() > opts.hastaMs) { limit = i; break }
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
    // Cortado = quedaron candidatas sin mirar, por número o por tiempo. Antes
    // exigía además haber leído alguna fila: si no se leía ninguna, daba la
    // ingesta por terminada y saltaba hasta hoy, perdiendo todo lo pendiente.
    const capped = limit < candidates.length
    let last = !capped ? ymd(today) : (rows[rows.length - 1]?.fecha_recepcion || ymd(since))
    // Avance garantizado. Si la pasada no llega a terminar ni el día por el que
    // iba, el puntero volvía a ese mismo día y la siguiente empezaba otra vez
    // por sus primeras convocatorias: no salía nunca de él. Pasó desde mediados
    // de septiembre de 2026, con días de más de 300 convocatorias (el 30 de
    // septiembre, 317) y un tope de 300 por pasada: el catálogo dejó de recibir
    // nada nuevo. Ahora, si no se ha pasado del primer día, se salta al
    // siguiente; lo que quede de ese día lo recoge el repaso de bdns-backfill.
    if (capped && last <= ymd(since)) {
      const siguiente = new Date(since)
      siguiente.setUTCDate(siguiente.getUTCDate() + 1)
      console.warn('[bdns-sync] el día', ymd(since), 'no cabe en una pasada; se sigue por', ymd(siguiente))
      last = ymd(siguiente)
    }
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

// Repaso automático. La ingesta diaria solo mira hacia delante, así que lo que
// se descartó al ingerirlo no vuelve a mirarse nunca. Pasó con todas las
// convocatorias sin fecha de fin en la BDNS (el plazo iba solo en texto: ver
// `fechaFinDeTexto` en lib/bdns.ts), que se tiraron durante meses.
//
// El cron llama cada día a /api/cron/bdns-repaso, que revisa POR_PASADA días de
// publicaciones de los últimos REPASO_DIAS, avanzando un tramo cada día: en
// REPASO_DIAS / POR_PASADA días (90) ha recorrido la ventana entera y vuelve a
// empezar. Dos días son unas 550 convocatorias, y el detalle se pide de una en
// una (la BDNS corta con 429 si se hace en paralelo) desde una función que
// corre en EE. UU.: por eso además lleva tope de tiempo.
export const REPASO_DIAS = 180
export const POR_PASADA = 2

export function ventanaDeRepaso(hoy: Date): { desde: Date; hasta: Date } {
  const dia = Math.floor(hoy.getTime() / 86_400_000)
  const tramo = dia % (REPASO_DIAS / POR_PASADA)
  const hasta = new Date(hoy)
  // Retrocede POR_PASADA + 1 por tramo y no POR_PASADA: mientras el repaso va
  // hacia atrás, «hoy» avanza un día. Con POR_PASADA a secas cada vuelta solo
  // cubría la mitad de la ventana (comprobado simulando 90 días seguidos).
  hasta.setUTCDate(hasta.getUTCDate() - 1 - tramo * (POR_PASADA + 1))
  const desde = new Date(hasta)
  desde.setUTCDate(desde.getUTCDate() - (POR_PASADA - 1))
  return { desde, hasta }
}
