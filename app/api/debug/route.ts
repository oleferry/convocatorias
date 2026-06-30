import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

// Debug del descubrimiento IA: muestra la respuesta cruda. BORRAR luego.
export async function GET() {
  const sb = createAdminSupabase()
  const { data: org } = await sb.from('organizations').select('*').limit(1).single()
  const o: any = org
  const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const sys = `Eres un experto en ayudas, premios y concursos PRIVADOS en España: fundaciones, bancos, Cámaras de Comercio, grandes empresas y asociaciones sectoriales.
Busca en la web programas PRIVADOS (NO públicos) REALES y ACTUALES para el perfil. Incluye comercio y pyme tradicional, no solo startups.
Devuelve SOLO un array JSON sin backticks, máximo 6:
[{"nombre":"","entidad":"","finalidad":"","beneficiarios":["..."],"ambito":"nacional|autonómico","url":"https://..."}]`
  const user = `Perfil: ${o.tipo_entidad} "${o.name}", CCAA ${o.ccaa}, CNAE ${o.cnae} (${o.cnae_desc}), actividad ${o.actividad}.`
  let raw = '', types: string[] = [], err: string | null = null
  try {
    const r = await ai.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1500, system: sys, messages: [{ role: 'user', content: user }], tools: [{ type: 'web_search_20250305', name: 'web_search' } as any] })
    types = (r.content as any[]).map(b => b.type)
    raw = (r.content as any[]).map(b => b.type === 'text' ? b.text : '').join('\n')
  } catch (e: any) { err = e?.message || String(e) }
  return NextResponse.json({ err, types, rawLen: raw.length, raw: raw.slice(0, 2500) })
}
