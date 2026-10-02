import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { syncBdns } from '@/lib/bdns-sync'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// GET /api/cron/bdns-backfill?key=...&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&max=120
// GET /api/cron/bdns-backfill?repaso=1   (cron diario, ver `ventanaDeRepaso`)
//
// Barrido HISTÓRICO de la BDNS. La ingesta diaria solo avanza hacia adelante
// desde su último punto, así que toda convocatoria publicada antes de que
// arrancara —con plazo aún abierto— nunca entró al catálogo. Esto lo repara.
//
// Se llama por tramos (un mes por ejecución va bien) para caber en el límite
// de tiempo de la función. NO toca el puntero de la ingesta diaria.
// Solo trae convocatorias con plazo de solicitud futuro, así que es seguro
// repetirlo: lo que ya esté se actualiza (upsert por codigo_bdns).
// Repaso automático. La ingesta diaria solo mira hacia delante, así que lo que
// se descartó al ingerirlo no vuelve a mirarse nunca. Pasó con todas las
// convocatorias sin fecha de fin en la BDNS (el plazo iba solo en texto: ver
// `fechaFinDeTexto` en lib/bdns.ts), que se tiraron durante meses.
//
// El cron llama cada día con ?repaso=1 y revisa POR_PASADA días de
// publicaciones de los últimos REPASO_DIAS, avanzando un tramo cada día: en
// REPASO_DIAS / POR_PASADA días (90) ha recorrido la ventana entera y vuelve a
// empezar. Dos días son unas 550 convocatorias, y el detalle se pide de una en
// una (la BDNS corta con 429 si se hace en paralelo) desde una función que
// corre en EE. UU.: por eso además lleva tope de tiempo.
const REPASO_DIAS = 180
const POR_PASADA = 2

function ventanaDeRepaso(hoy: Date): { desde: Date; hasta: Date } {
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

export async function GET(req: NextRequest) {
  const inicio = Date.now()
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const key = req.nextUrl.searchParams.get('key')
    if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })

  const repaso = req.nextUrl.searchParams.get('repaso') === '1'
  const qDesde = req.nextUrl.searchParams.get('desde')
  const qHasta = req.nextUrl.searchParams.get('hasta')
  if (!repaso && (!qDesde || !qHasta)) {
    return NextResponse.json({ error: 'Faltan desde/hasta (YYYY-MM-DD), o ?repaso=1' }, { status: 400 })
  }
  const { desde, hasta } = repaso ? ventanaDeRepaso(new Date()) : { desde: new Date(qDesde!), hasta: new Date(qHasta!) }
  if (isNaN(desde.getTime()) || isNaN(hasta.getTime()) || desde > hasta) {
    return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
  }

  try {
    const sb = createAdminSupabase()
    const max = Number(req.nextUrl.searchParams.get('max') || (repaso ? 1000 : 120))
    const offset = Number(req.nextUrl.searchParams.get('offset') || 0)
    // 240 s para pedir detalles; el resto del límite de 300 s queda para guardar.
    const r = await syncBdns(sb, { desde, hasta, maxDetails: max, offset, backfill: true, hastaMs: inicio + 240_000 })
    if (repaso) console.log('[cron/bdns-backfill] repaso', r.from, '→', r.to, `${r.guardadas}/${r.candidates}`, r.siguienteOffset ? `(quedan desde ${r.siguienteOffset})` : '')

    const { count: abiertas } = await sb.from('convocatorias_publicas')
      .select('codigo_bdns', { count: 'exact', head: true })
      .or('fuente.is.null,fuente.eq.bdns')
      .gte('fecha_fin', new Date().toISOString().slice(0, 10))
      .neq('codigo_bdns', `__nocache_${Date.now()}`)

    return NextResponse.json({ ok: true, ...r, bdns_abiertas_total: abiertas ?? 0 })
  } catch (e: any) {
    console.error('[cron/bdns-backfill]', e)
    return NextResponse.json({ error: e?.message || 'Error en el barrido' }, { status: 500 })
  }
}
