import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { syncRadar } from '@/lib/radar-sync'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET /api/cron/radar → vuelca el radar (privados + europeos curados + EU portal).
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
    return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }
  try {
    const result = await syncRadar(createAdminSupabase())
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[cron/radar]', e)
    return NextResponse.json({ error: e?.message || 'Error en el radar' }, { status: 500 })
  }
}
