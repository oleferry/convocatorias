// ================================================================
//  Registro de coste de llamadas a la API de Claude. Best-effort:
//  si falla el registro, nunca debe romper la función que llamó a la IA.
// ================================================================
import { createAdminSupabase } from './supabase-server'

// $ por 1M tokens. Ver skill claude-api para precios actualizados.
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
}

export interface AnthropicUsage {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export function computeCostUsd(model: string, usage: AnthropicUsage): number {
  const p = PRICING[model] || PRICING['claude-sonnet-4-6']
  const inTok = usage.input_tokens || 0
  const outTok = usage.output_tokens || 0
  // Cache write/read se cobra sobre el precio de entrada (aprox 1.25x / 0.1x);
  // aquí los tratamos al precio base de entrada para no infravalorar el coste.
  const cacheTok = (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0)
  return ((inTok + cacheTok) * p.in + outTok * p.out) / 1_000_000
}

export async function logApiUsage(opts: {
  feature: string
  source?: 'web' | 'bot' | 'cron'
  model: string
  usage: AnthropicUsage
  userId?: string | null
  orgId?: string | null
}) {
  try {
    const sb = createAdminSupabase()
    const cost = computeCostUsd(opts.model, opts.usage)
    await sb.from('api_usage_log').insert({
      provider: 'anthropic',
      feature: opts.feature,
      source: opts.source || 'web',
      model: opts.model,
      input_tokens: opts.usage.input_tokens || 0,
      output_tokens: opts.usage.output_tokens || 0,
      cache_creation_tokens: opts.usage.cache_creation_input_tokens || 0,
      cache_read_tokens: opts.usage.cache_read_input_tokens || 0,
      cost_usd: cost,
      user_id: opts.userId || null,
      org_id: opts.orgId || null,
    })
  } catch (e: any) {
    console.warn('[logApiUsage]', e?.message)
  }
}
