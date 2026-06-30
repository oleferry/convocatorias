import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { syncBdns } from '@/lib/bdns-sync'
import { syncRadar } from '@/lib/radar-sync'
import { syncDescubrimiento } from '@/lib/descubrir'

export const runtime = 'nodejs'
export const maxDuration = 300

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
  try {
    const sb = createAdminSupabase()
    const max = Number(req.nextUrl.searchParams.get('max') || 120)
    const result = await syncBdns(sb, { maxDetails: max })
    // De paso, refrescamos el radar (privados + europeos) — barato e idempotente
    let radar: any = null
    try { radar = await syncRadar(sb) } catch (e: any) { console.warn('[cron/ingest] radar:', e?.message) }
    // Descubrimiento IA de privados: solo los lunes (semanal), acotado para no
    // exceder el tiempo de la función. El resto de días sale barato.
    let descubrir: any = null
    if (new Date().getDay() === 1 && process.env.ANTHROPIC_API_KEY) {
      try { descubrir = await syncDescubrimiento(sb, { max: 3 }) } catch (e: any) { console.warn('[cron/ingest] descubrir:', e?.message) }
    }
    return NextResponse.json({ ok: true, ...result, radar, descubrir })
  } catch (e: any) {
    console.error('[cron/ingest]', e)
    return NextResponse.json({ error: e?.message || 'Error en la ingesta' }, { status: 500 })
  }
}
