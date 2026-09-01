import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { syncResumenCatalogo } from '@/lib/resumen-catalogo'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// GET /api/cron/resumen-catalogo → genera el resumen periodístico + importe
// real por beneficiario de las convocatorias BDNS abiertas que aún no lo
// tienen. La ingesta diaria ya llama a esto por su cuenta; este endpoint es
// para dar empujones a mano (?key=CRON_SECRET&max=N) cuando hay atasco.
// Devuelve cuántas quedan, para poder llamarlo varias veces seguidas.
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
    const max = Number(req.nextUrl.searchParams.get('max') || 40)
    const result = await syncResumenCatalogo(createAdminSupabase(), { max })
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[cron/resumen-catalogo]', e)
    return NextResponse.json({ error: e?.message || 'Error generando resúmenes' }, { status: 500 })
  }
}
