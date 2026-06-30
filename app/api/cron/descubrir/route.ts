import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { syncDescubrimiento } from '@/lib/descubrir'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// GET /api/cron/descubrir → descubrimiento IA de ayudas/concursos privados.
// Protegido por CRON_SECRET (o abierto si no está configurado). ?max=N sectores.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const key = req.nextUrl.searchParams.get('key')
    if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Falta ANTHROPIC_API_KEY' }, { status: 500 })
  try {
    const sb = createAdminSupabase()
    const max = Number(req.nextUrl.searchParams.get('max') || 6)
    const reset = req.nextUrl.searchParams.get('reset') === '1'
    const r = await syncDescubrimiento(sb, { max, reset })
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error en el descubrimiento' }, { status: 500 })
  }
}
