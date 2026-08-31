import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { EVENTOS } from '@/lib/eventos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// POST /api/track → registra un evento de producto.
// Nunca devuelve error al cliente: medir no puede romper la app. Si algo falla
// se pierde el evento y se anota en el log del servidor, y ya está.
export async function POST(req: NextRequest) {
  try {
    const { nombre, props } = await req.json().catch(() => ({} as any))

    // Lista blanca: evita que un evento mal escrito ensucie el embudo y que
    // nadie use este endpoint abierto como vertedero.
    if (!EVENTOS.includes(nombre)) return NextResponse.json({ ok: false })

    const { data: { user } } = await createServerSupabase().auth.getUser()

    // Solo se guardan props planas y cortas; nada de datos personales.
    const limpio: Record<string, string | number | boolean> = {}
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined) continue
      if (typeof v === 'object') continue
      limpio[k.slice(0, 40)] = typeof v === 'string' ? v.slice(0, 120) : (v as number | boolean)
    }

    await createAdminSupabase().from('eventos').insert({
      user_id: user?.id || null, nombre, props: limpio,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.warn('[track]', e?.message)
    return NextResponse.json({ ok: false })
  }
}
