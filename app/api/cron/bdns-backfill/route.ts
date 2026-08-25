import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { syncBdns } from '@/lib/bdns-sync'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// GET /api/cron/bdns-backfill?key=...&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&max=120
//
// Barrido HISTÓRICO de la BDNS. La ingesta diaria solo avanza hacia adelante
// desde su último punto, así que toda convocatoria publicada antes de que
// arrancara —con plazo aún abierto— nunca entró al catálogo. Esto lo repara.
//
// Se llama por tramos (un mes por ejecución va bien) para caber en el límite
// de tiempo de la función. NO toca el puntero de la ingesta diaria.
// Solo trae convocatorias con plazo de solicitud futuro, así que es seguro
// repetirlo: lo que ya esté se actualiza (upsert por codigo_bdns).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const key = req.nextUrl.searchParams.get('key')
    if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })

  const qDesde = req.nextUrl.searchParams.get('desde')
  const qHasta = req.nextUrl.searchParams.get('hasta')
  if (!qDesde || !qHasta) {
    return NextResponse.json({ error: 'Faltan desde/hasta (YYYY-MM-DD)' }, { status: 400 })
  }
  const desde = new Date(qDesde), hasta = new Date(qHasta)
  if (isNaN(desde.getTime()) || isNaN(hasta.getTime()) || desde > hasta) {
    return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
  }

  try {
    const sb = createAdminSupabase()
    const max = Number(req.nextUrl.searchParams.get('max') || 120)
    const offset = Number(req.nextUrl.searchParams.get('offset') || 0)
    const r = await syncBdns(sb, { desde, hasta, maxDetails: max, offset, backfill: true })

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
