import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { syncBdns } from '@/lib/bdns-sync'
import { matchGrant, tituloCorto, type PublicGrantRow } from '@/lib/matching'
import type { Organization } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Prueba de ingesta de LOCALES + matching. BORRAR luego.
export async function GET() {
  const sb = createAdminSupabase()
  const { data: stateBefore } = await sb.from('bdns_sync_state').select('*').eq('id', 1).maybeSingle()
  // Forzamos ventana amplia para la prueba (el cursor incremental ya está en "hoy").
  const back = new Date(); back.setDate(back.getDate() - 20)
  const upd = await sb.from('bdns_sync_state').upsert({ id: 1, last_fecha_recepcion: back.toISOString().slice(0, 10) })
  const sync = await syncBdns(sb, { maxDetails: 200 })

  const { data: local } = await sb.from('convocatorias_publicas').select('titulo,nivel1,ccaa,provincia,organo,fecha_fin').eq('nivel1', 'LOCAL').limit(30)

  const today = new Date().toISOString().slice(0, 10)
  const { data: org } = await sb.from('organizations').select('*').limit(1).single()
  const o = org as Organization
  const matches = (local || []).map((c: any) => {
    const m = matchGrant(c as PublicGrantRow, o, today)
    return { titulo: tituloCorto(c.titulo), provincia: c.provincia, organo: c.organo, match: m.match, reasons: m.reasons }
  })

  return NextResponse.json({ stateBefore, updErr: upd.error?.message, sync, totalLocal: (local || []).length, org: { ccaa: o.ccaa, prov: o.provincia, muni: o.municipio }, matches })
}
