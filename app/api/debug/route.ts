import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Muestreo temporal para afinar el matching. BORRAR luego.
export async function GET() {
  const sb = createAdminSupabase()
  const { data: org } = await sb.from('organizations')
    .select('name,ccaa,cnae,cnae_desc,cnaes,iae,iae_desc,keywords,actividad,tipo_entidad').limit(1).single()

  const sample = async (f: string) => {
    const { data } = await sb.from('convocatorias_publicas')
      .select('titulo,nivel1,ccaa,beneficiarios,sectores,fuente').eq('fuente', f).limit(4)
    return data
  }
  // cuántas BDNS tienen sectores / beneficiarios no vacíos
  const { data: bdnsAll } = await sb.from('convocatorias_publicas')
    .select('beneficiarios,sectores').eq('fuente', 'bdns').limit(500)
  const conSect = (bdnsAll || []).filter((r: any) => r.sectores && r.sectores.length).length
  const conBenef = (bdnsAll || []).filter((r: any) => r.beneficiarios && r.beneficiarios.length).length

  return NextResponse.json({
    org,
    bdnsStats: { total: (bdnsAll || []).length, conSectores: conSect, conBeneficiarios: conBenef },
    bdns: await sample('bdns'),
    privada: await sample('privada'),
    europea: await sample('europea'),
  })
}
