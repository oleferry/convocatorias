import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { syncBdns } from '@/lib/bdns-sync'
import { syncRadar } from '@/lib/radar-sync'
import { syncDescubrimiento } from '@/lib/descubrir'
import { syncResumenCatalogo } from '@/lib/resumen-catalogo'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// GET /api/cron/ingest  → ingesta acotada de la BDNS al catálogo.
// Lo llama el cron de Vercel (Authorization: Bearer CRON_SECRET) o tú a mano
// con ?key=CRON_SECRET. Si no hay CRON_SECRET configurado, queda abierto.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const key = req.nextUrl.searchParams.get('key')
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el entorno' }, { status: 500 })
  }
  const inicio = Date.now()
  try {
    const sb = createAdminSupabase()
    // La BDNS publica ya 250-320 convocatorias al día en toda España (medido en
    // septiembre-octubre de 2026). El tope por número se queda alto y lo que
    // manda es el tiempo: 200 s para pedir detalles, uno a uno (en paralelo la
    // BDNS devuelve 429). Al llegar al tope se guarda lo hecho y el puntero
    // avanza; ver el «avance garantizado» de syncBdns.
    const max = Number(req.nextUrl.searchParams.get('max') || 1500)
    const result = await syncBdns(sb, { maxDetails: max, hastaMs: inicio + 200_000 })
    // De paso, refrescamos el radar (privados + europeos) — barato e idempotente
    let radar: any = null
    try { radar = await syncRadar(sb) } catch (e: any) { console.warn('[cron/ingest] radar:', e?.message) }
    // Resúmenes de las que aún no lo tengan. Acotado: es lo único caro de esta
    // función, tanto en segundos como en euros, y su propio tope de coste lo
    // corta si se dispara. Lo que no entre hoy entra mañana.
    let resumenes: any = null
    if (process.env.ANTHROPIC_API_KEY) {
      const maxRes = Number(req.nextUrl.searchParams.get('maxResumenes') || 40)
      // Con lo que quede hasta los 270 s; el resto del límite, para responder.
      try { resumenes = await syncResumenCatalogo(sb, { max: maxRes, hastaMs: inicio + 270_000 }) } catch (e: any) { console.warn('[cron/ingest] resumenes:', e?.message) }
    }
    // Descubrimiento IA de privados: UNA VEZ AL MES (día 1). Era semanal, pero
    // se llevaba el 73% de todo el gasto de la API — con diferencia la función
    // más cara — y lo que encuentra son programas recurrentes (premios anuales,
    // aceleradoras), que no cambian de una semana a otra. Mensual basta.
    let descubrir: any = null
    if (new Date().getDate() === 1 && process.env.ANTHROPIC_API_KEY) {
      try { descubrir = await syncDescubrimiento(sb, { max: 2 }) } catch (e: any) { console.warn('[cron/ingest] descubrir:', e?.message) }
    }
    return NextResponse.json({ ok: true, ...result, radar, resumenes, descubrir })
  } catch (e: any) {
    console.error('[cron/ingest]', e)
    return NextResponse.json({ error: e?.message || 'Error en la ingesta' }, { status: 500 })
  }
}
