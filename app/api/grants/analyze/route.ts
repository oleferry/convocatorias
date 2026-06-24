import { NextRequest, NextResponse } from 'next/server'
import { analyzeGrant } from '@/lib/ai'

// La llamada a Claude con web_search puede tardar; ampliamos el límite.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json()
    if (!input || typeof input !== 'string' || !input.trim()) {
      return NextResponse.json({ error: 'Falta el texto o la URL de la convocatoria.' }, { status: 400 })
    }
    const data = await analyzeGrant(input)
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('[api/grants/analyze]', e)
    return NextResponse.json({ error: e?.message || 'No se pudo analizar la convocatoria.' }, { status: 500 })
  }
}
