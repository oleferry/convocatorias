import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { generateResumenConvocatoria } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/resumen  { grantId }  → genera (y guarda) un resumen breve de la
// convocatoria: plazo, importe, quién puede pedirlo, condiciones, para qué es.
// Se dispara solo a petición del usuario — nunca automático (control de coste).
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { grantId } = await req.json()
  if (!grantId) return NextResponse.json({ error: 'Falta grantId' }, { status: 400 })

  const { data: grant } = await supabase
    .from('grants').select('*').eq('id', grantId).eq('user_id', user.id).single()
  if (!grant) return NextResponse.json({ error: 'Convocatoria no encontrada' }, { status: 404 })

  try {
    const resumen = await generateResumenConvocatoria(grant)
    await supabase.from('grants')
      .update({ resumen_ia: resumen, resumen_ia_updated_at: new Date().toISOString() })
      .eq('id', grantId).eq('user_id', user.id)
    return NextResponse.json({ resumen })
  } catch (e: any) {
    console.error('[api/resumen]', e)
    return NextResponse.json({ error: e?.message || 'No se pudo generar el resumen.' }, { status: 500 })
  }
}
