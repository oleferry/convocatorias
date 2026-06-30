import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export async function GET() {
  const sb = createAdminSupabase()
  const { data } = await sb.from('convocatorias_publicas').select('codigo_bdns,titulo,organo,bases_url').like('codigo_bdns', 'priv-%')
  return NextResponse.json({ total: (data || []).length, lista: (data || []).map((c: any) => ({ codigo: c.codigo_bdns, titulo: c.titulo, entidad: c.organo })) })
}
