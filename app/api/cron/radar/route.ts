import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { RADAR_PROGRAMS } from '@/lib/radar-data'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET /api/cron/radar → vuelca el catálogo curado (privadas + europeas) a
// convocatorias_publicas. nivel1='ESTATAL' para que encaje con cualquier CCAA;
// sin fecha_fin (el plazo se consulta en la web oficial). Idempotente (upsert).
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

  const rows = RADAR_PROGRAMS.map(p => ({
    codigo_bdns: `radar-${p.id}`,
    titulo: p.nombre,
    organo: p.entidad,
    nivel1: 'ESTATAL',
    ccaa: null,
    tipo_convocatoria: p.fuente === 'europea' ? 'Fondo europeo' : 'Premio / programa privado',
    finalidad: p.finalidad,
    beneficiarios: p.beneficiarios,
    sectores: [],
    regiones: [],
    bases_url: p.url,
    abierto: true,
    fecha_inicio: null,
    fecha_fin: null,
    fecha_recepcion: null,
    presupuesto_total: null,
    fuente: p.fuente,
  }))

  try {
    const sb = createAdminSupabase()
    const { error } = await sb.from('convocatorias_publicas').upsert(rows, { onConflict: 'codigo_bdns' })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, ingested: rows.length })
  } catch (e: any) {
    console.error('[cron/radar]', e)
    return NextResponse.json({ error: e?.message || 'Error en el radar' }, { status: 500 })
  }
}
