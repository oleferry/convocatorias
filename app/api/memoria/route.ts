import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { generateMemoria } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/memoria  { grantId }  → genera (y guarda) un borrador de memoria
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { grantId } = await req.json()
  if (!grantId) return NextResponse.json({ error: 'Falta grantId' }, { status: 400 })

  const { data: grant } = await supabase
    .from('grants').select('*').eq('id', grantId).eq('user_id', user.id).single()
  if (!grant) return NextResponse.json({ error: 'Convocatoria no encontrada' }, { status: 404 })

  let org = null
  if (grant.org_id) {
    const { data } = await supabase.from('organizations').select('*').eq('id', grant.org_id).single()
    org = data
  }

  try {
    const memoria = await generateMemoria(grant, org)
    // Guardado best-effort (requiere la migración 004; si no está, se ignora).
    await supabase.from('grants')
      .update({ memoria, memoria_updated_at: new Date().toISOString() })
      .eq('id', grantId).eq('user_id', user.id)
    return NextResponse.json({ memoria })
  } catch (e: any) {
    console.error('[api/memoria]', e)
    return NextResponse.json({ error: e?.message || 'No se pudo generar la memoria.' }, { status: 500 })
  }
}
