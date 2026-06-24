import { NextRequest, NextResponse } from 'next/server'
import { searchGrantsForProfile } from '@/lib/ai'
import type { Organization } from '@/lib/types'

// La búsqueda autónoma consulta varias fuentes vía web_search: puede tardar.
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { org, existingTitles } = (await req.json()) as {
      org?: Organization
      existingTitles?: string[]
    }
    if (!org || !org.name) {
      return NextResponse.json({ error: 'Falta el perfil de empresa.', results: [] }, { status: 400 })
    }
    const results = await searchGrantsForProfile(org, Array.isArray(existingTitles) ? existingTitles : [])
    return NextResponse.json({ results })
  } catch (e: any) {
    console.error('[api/search]', e)
    return NextResponse.json({ error: e?.message || 'Error en la búsqueda autónoma.', results: [] }, { status: 500 })
  }
}
