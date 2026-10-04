import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { syncBdns, ventanaDeRepaso } from '@/lib/bdns-sync'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// GET /api/cron/bdns-repaso → repaso diario de lo que la ingesta ya no mira.
// Ver `ventanaDeRepaso` en lib/bdns-sync.ts.
//
// Ruta propia y sin parámetros a propósito: antes era
// /api/cron/bdns-backfill?repaso=1, y las dos primeras noches no recuperó
// nada. Sin registros que lo confirmen (el plan Hobby los guarda una hora),
// una ruta sin query string quita una duda de en medio.
export async function GET(req: NextRequest) {
  const inicio = Date.now()
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const key = req.nextUrl.searchParams.get('key')
    if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })

  try {
    const { desde, hasta } = ventanaDeRepaso(new Date())
    const r = await syncBdns(createAdminSupabase(), { desde, hasta, maxDetails: 1500, backfill: true, hastaMs: inicio + 240_000 })
    console.log('[cron/bdns-repaso]', r.from, '→', r.to, `guardadas ${r.guardadas} de ${r.candidates}`, r.siguienteOffset ? `(cortado en ${r.siguienteOffset})` : '')
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    console.error('[cron/bdns-repaso]', e)
    return NextResponse.json({ error: e?.message || 'Error en el repaso' }, { status: 500 })
  }
}
