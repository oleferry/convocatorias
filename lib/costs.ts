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

// ── Límites de coste ────────────────────────────────────────────
// Cinturón de seguridad global + tope diario por usuario y función, para
// que ni un fallo ni un usuario (de pago o no) puedan disparar el gasto.
const DAILY_GLOBAL_CAP_EUR = 1
const FX_USD_PER_EUR = 1 / 0.92 // mismo tipo de cambio aproximado que /admin/costs
const DAILY_GLOBAL_CAP_USD = DAILY_GLOBAL_CAP_EUR * FX_USD_PER_EUR

// Sub-tope para el descubrimiento IA de privados: es con diferencia lo más
// caro (búsqueda web + respuesta larga, ~0,39€ por llamada) y corre solo los
// lunes. Sin este freno, 3 llamadas se comían el presupuesto entero del día y
// dejaban sin servicio a todo lo demás — incluidos los resúmenes de catálogo,
// que cuestan ~0,005€ (80 veces menos) y son los que mantienen el producto al
// día. Ocurrió de verdad: 1,17€ en 3 llamadas.
const DISCOVERY_SHARE = 0.4 // como mucho el 40% del tope diario
const DISCOVERY_CAP_USD = DAILY_GLOBAL_CAP_USD * DISCOVERY_SHARE
const DISCOVERY_FEATURES = new Set(['descubrir_privados', 'search_web'])

// Funciones baratas que mantienen el catálogo al día. No las bloquea el tope
// general (aunque sí el suyo propio) para que un trabajo caro no pueda dejar
// el catálogo desactualizado; su coste unitario es marginal.
const MANTENIMIENTO_FEATURES = new Set(['resumen_catalogo'])
const MANTENIMIENTO_CAP_USD = DAILY_GLOBAL_CAP_USD * 0.5

// Solo se aplican a funciones disparadas por un clic de un usuario concreto;
// las funciones de catálogo (descubrimiento, resumen de catálogo) no tienen
// tope por usuario porque no las dispara un usuario, ya están acotadas por
// el ?max= del cron.
export const PER_USER_DAILY_LIMITS: Record<string, number> = {
  memoria: 20,
  resumen: 20,
  analyze: 15,
  search_web: 5,
}

function startOfTodayIso(): string {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

async function globalCostTodayUsd(): Promise<number> {
  const sb = createAdminSupabase()
  const { data } = await sb.from('api_usage_log').select('cost_usd').gte('created_at', startOfTodayIso())
  return (data || []).reduce((sum: number, r: any) => sum + (r.cost_usd || 0), 0)
}

/** Gasto de hoy solo en un grupo de funciones (para los sub-topes). */
async function costTodayUsdFor(features: Set<string>): Promise<number> {
  const sb = createAdminSupabase()
  const { data } = await sb.from('api_usage_log').select('cost_usd')
    .in('feature', Array.from(features)).gte('created_at', startOfTodayIso())
  return (data || []).reduce((sum: number, r: any) => sum + (r.cost_usd || 0), 0)
}

async function userFeatureCountToday(userId: string, feature: string): Promise<number> {
  const sb = createAdminSupabase()
  const { count } = await sb.from('api_usage_log').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('feature', feature).gte('created_at', startOfTodayIso())
  return count || 0
}

async function userIsPro(userId: string): Promise<boolean> {
  const sb = createAdminSupabase()
  const { data } = await sb.from('users').select('plan').eq('id', userId).maybeSingle()
  return data?.plan === 'pro' || data?.plan === 'team'
}

export interface RateLimitResult { allowed: boolean; reason?: string }

// Best-effort: si falla la comprobación (p.ej. Supabase caído), dejamos pasar
// la llamada — un fallo de lectura no debe bloquear todo el producto.
export async function checkRateLimit(feature: string, userId?: string | null): Promise<RateLimitResult> {
  try {
    // Mantenimiento del catálogo: tiene su propio tope y no lo frena el
    // general, para que un trabajo caro no pueda dejar el catálogo obsoleto.
    if (MANTENIMIENTO_FEATURES.has(feature)) {
      const gastado = await costTodayUsdFor(MANTENIMIENTO_FEATURES)
      if (gastado >= MANTENIMIENTO_CAP_USD) {
        return { allowed: false, reason: 'Alcanzado el tope diario de mantenimiento del catálogo. Continúa mañana.' }
      }
      return { allowed: true }
    }

    // Descubrimiento IA: lo más caro del sistema, con su propio sub-tope para
    // que no pueda agotar el presupuesto del día él solo.
    if (DISCOVERY_FEATURES.has(feature)) {
      const gastado = await costTodayUsdFor(DISCOVERY_FEATURES)
      if (gastado >= DISCOVERY_CAP_USD) {
        return { allowed: false, reason: 'Alcanzado el tope diario de búsqueda con IA. Vuelve a intentarlo mañana.' }
      }
    }

    const globalCost = await globalCostTodayUsd()
    if (globalCost >= DAILY_GLOBAL_CAP_USD) {
      // Por encima del tope diario gratuito: solo usuarios de pago siguen.
      const isPro = userId ? await userIsPro(userId) : false
      if (!isPro) {
        return { allowed: false, reason: `Hoy ya se ha alcanzado el límite de uso gratuito de la plataforma (${DAILY_GLOBAL_CAP_EUR}€/día). Hazte Pro para seguir usando esta función hoy, o vuelve mañana.` }
      }
    }
    const perUserLimit = PER_USER_DAILY_LIMITS[feature]
    if (perUserLimit && userId) {
      const count = await userFeatureCountToday(userId, feature)
      if (count >= perUserLimit) {
        return { allowed: false, reason: `Has alcanzado el límite diario de esta función (${perUserLimit}/día). Vuelve a intentarlo mañana.` }
      }
    }
    return { allowed: true }
  } catch (e: any) {
    console.warn('[checkRateLimit]', e?.message)
    return { allowed: true }
  }
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
