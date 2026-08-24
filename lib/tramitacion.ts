// ================================================================
//  "Te lo tramito": solicitud de tramitación desde cualquier canal
//  (web, email del digest, bot de Telegram) + la documentación que
//  se suele pedir, para que el interesado la vaya preparando.
//  Lista FIJA (sin IA): adaptada solo por tipo de entidad, coste 0.
// ================================================================
import crypto from 'crypto'

// ── Documentación habitual ──────────────────────────────────────
const DOC_COMUNES = [
  'DNI/NIE del solicitante o del representante legal',
  'Certificado de estar al corriente con la Agencia Tributaria',
  'Certificado de estar al corriente con la Seguridad Social',
  'Certificado de titularidad de la cuenta bancaria',
  'Alta en el IAE (modelo 036 o 037)',
  'Presupuesto o facturas proforma de lo que quieres financiar',
]
const DOC_AUTONOMO = [
  'Alta en el RETA (resolución o informe de vida laboral)',
]
const DOC_SOCIEDAD = [
  'Escrituras de constitución y estatutos de la sociedad',
  'CIF de la sociedad',
  'Poder de representación de quien firma la solicitud',
]

/** Documentación que se suele pedir, según el tipo de entidad. */
export function documentacionHabitual(tipoEntidad?: string | null): string[] {
  const especificos = tipoEntidad === 'autonomo' ? DOC_AUTONOMO : DOC_SOCIEDAD
  return [...especificos, ...DOC_COMUNES]
}

export const DOC_AVISO = 'Es la documentación habitual: la definitiva depende de cada convocatoria y te la confirmamos al contactarte.'

// ── Enlace firmado para el botón del email ──────────────────────
// El email no lleva sesión, así que el enlace va firmado (HMAC) para
// que nadie pueda crear solicitudes en nombre de otra persona.
// Se firma con la service_role key, que solo existe en el servidor.
function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(`tramitar:${payload}`).digest('hex').slice(0, 32)
}

export function tramitarUrl(appUrl: string, userId: string, codigoBdns: string): string {
  const payload = `${userId}|${codigoBdns}`
  const qs = new URLSearchParams({ u: userId, c: codigoBdns, s: sign(payload) })
  return `${appUrl}/api/tramitar?${qs.toString()}`
}

export function verifyTramitar(userId: string, codigoBdns: string, sig: string): boolean {
  if (!secret() || !userId || !codigoBdns || !sig) return false
  const esperado = sign(`${userId}|${codigoBdns}`)
  // Comparación en tiempo constante para no filtrar la firma por temporización.
  const a = Buffer.from(esperado); const b = Buffer.from(sig)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
