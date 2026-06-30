import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { matchGrant, type PublicGrantRow } from '@/lib/matching'
import type { Organization } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Inspecciona convocatorias de "creación de empresas" / ICECYL. BORRAR luego.
export async function GET() {
  const sb = createAdminSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const { data: org } = await sb.from('organizations').select('*').limit(1).single()
  const o = org as Organization

  const { data } = await sb.from('convocatorias_publicas').select('*')
    .or('titulo.ilike.%creaci%empresa%,titulo.ilike.%ICECYL%,organo.ilike.%ICECYL%').limit(20)

  const rows = (data || []).map((c: any) => {
    const m = matchGrant(c as PublicGrantRow, o, today)
    return {
      titulo: (c.titulo || '').slice(0, 80),
      nivel1: c.nivel1, ccaa: c.ccaa, fecha_fin: c.fecha_fin,
      beneficiarios: c.beneficiarios,
      sectores: (c.sectores || []).map((s: any) => s.codigo),
      match: m.match, tier: m.tier, score: m.score, reasons: m.reasons,
    }
  })
  return NextResponse.json({ org: { ccaa: o.ccaa, prov: o.provincia, muni: o.municipio, cnae: o.cnae }, n: rows.length, rows })
}
