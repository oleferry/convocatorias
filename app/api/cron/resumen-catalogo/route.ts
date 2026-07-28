import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { generateResumenCatalogo } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 300

// GET /api/cron/resumen-catalogo → backfill puntual: genera el resumen
// periodístico + importe real por beneficiario para convocatorias BDNS ya
// abiertas que aún no lo tienen. Se llama a mano (?key=CRON_SECRET), no está
// en vercel.json — no es un cron automático, es un empujón de una vez.
// Devuelve cuántas quedan para poder llamarla varias veces seguidas.
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
    const max = Number(req.nextUrl.searchParams.get('max') || 40)
    const today = new Date().toISOString().slice(0, 10)

    const { data: pending, error } = await sb.from('convocatorias_publicas')
      .select('codigo_bdns,titulo,organo,finalidad,beneficiarios,anuncio_texto,presupuesto_total')
      .or('fuente.is.null,fuente.eq.bdns')
      .gte('fecha_fin', today)
      .is('resumen_periodista', null)
      .limit(max)
    if (error) throw new Error(error.message)

    let done = 0
    for (const row of (pending || [])) {
      try {
        const { resumen, importeBeneficiario } = await generateResumenCatalogo(row)
        if (resumen) {
          await sb.from('convocatorias_publicas').update({
            resumen_periodista: resumen, importe_beneficiario: importeBeneficiario,
            resumen_generado_at: new Date().toISOString(),
          }).eq('codigo_bdns', row.codigo_bdns)
          done++
        }
      } catch (e: any) { console.warn('[resumen-catalogo]', row.codigo_bdns, e?.message) }
    }

    const { count: remaining } = await sb.from('convocatorias_publicas')
      .select('codigo_bdns', { count: 'exact', head: true })
      .or('fuente.is.null,fuente.eq.bdns').gte('fecha_fin', today).is('resumen_periodista', null)

    return NextResponse.json({ ok: true, procesadas: done, candidatas: (pending || []).length, restantes: remaining ?? 0 })
  } catch (e: any) {
    console.error('[cron/resumen-catalogo]', e)
    return NextResponse.json({ error: e?.message || 'Error generando resúmenes' }, { status: 500 })
  }
}
