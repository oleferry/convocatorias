import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Diagnóstico CON la sesión del usuario (abrir en el navegador logueado).
// Dice si la sesión es válida y si se leen orgs/catálogo. BORRAR luego.
export async function GET() {
  const sb = createServerSupabase()
  const { data: { user }, error: authErr } = await sb.auth.getUser()

  const out: any = {
    loggedIn: !!user,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    authError: authErr?.message ?? null,
  }

  if (user) {
    const orgs = await sb.from('organizations').select('id,name,ccaa,cnae').eq('user_id', user.id)
    out.orgs = { count: (orgs.data || []).length, error: orgs.error?.message, list: orgs.data }
    const cat = await sb.from('convocatorias_publicas').select('*', { count: 'exact', head: true })
    out.catalogoLeido = { count: cat.count, error: cat.error?.message }
  }
  return NextResponse.json(out)
}
