import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Muestreo ubicación. BORRAR luego.
export async function GET() {
  const sb = createAdminSupabase()
  const { data: org } = await sb.from('organizations')
    .select('name,ccaa,provincia,municipio').limit(1).single()

  const { data: all } = await sb.from('convocatorias_publicas')
    .select('nivel1,ccaa,organo,regiones,fuente,titulo').limit(1000)
  const byNivel: any = {}
  for (const r of (all || [])) { const k = (r.nivel1 || '∅') + '|' + (r.fuente || ''); byNivel[k] = (byNivel[k] || 0) + 1 }

  const locales = (all || []).filter((r: any) => (r.nivel1 || '').toUpperCase() === 'LOCAL').slice(0, 6)
    .map((r: any) => ({ ccaa: r.ccaa, organo: r.organo, regiones: r.regiones, titulo: (r.titulo || '').slice(0, 60) }))
  const autonom = (all || []).filter((r: any) => (r.nivel1 || '').toUpperCase() === 'AUTONOMICA').slice(0, 3)
    .map((r: any) => ({ ccaa: r.ccaa, organo: r.organo, regiones: r.regiones }))

  return NextResponse.json({ org, byNivel, locales, autonom })
}
