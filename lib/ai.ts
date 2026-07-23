import Anthropic from '@anthropic-ai/sdk'
import type { Organization, Grant } from './types'
import { logApiUsage } from './costs'

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Escanea desde el primer '{'/'[' llevando la cuenta de profundidad (e
// ignorando llaves dentro de strings) hasta encontrar su cierre real. Con
// web_search activado, Claude a veces añade una frase antes o después del
// JSON — coger "primer { hasta último }" del texto entero se rompe si esa
// frase trae cualquier llave suelta (p.ej. una URL con parámetros).
function extractJSON(text: string, bracket: '{'|'[') {
  const close = bracket === '{' ? '}' : ']'
  const start = text.indexOf(bracket)
  if (start === -1) throw new Error('No JSON')
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === bracket) depth++
    else if (ch === close) { depth--; if (depth === 0) return JSON.parse(text.slice(start, i + 1)) }
  }
  throw new Error('JSON sin cerrar')
}

// Llama a Claude y registra el coste real (tokens de la respuesta) en
// api_usage_log — best-effort, nunca bloquea ni rompe la llamada.
async function callAI(system: string, user: string, search = false, maxTokens = 1500, feature = 'unknown', ctx: { userId?: string | null; orgId?: string | null } = {}) {
  const model = 'claude-sonnet-4-6'
  const body: any = { model, max_tokens:maxTokens, system, messages:[{role:'user',content:user}] }
  if (search) body.tools = [{ type:'web_search_20250305', name:'web_search' }]
  const r = await ai.messages.create(body)
  logApiUsage({ feature, model, usage: r.usage as any, userId: ctx.userId, orgId: ctx.orgId }).catch(() => {})
  return (r.content as any[]).map(b => b.type==='text' ? b.text : '').join('\n')
}

export async function analyzeGrant(input: string) {
  const sys = `Experto en subvenciones españolas. Devuelve SOLO JSON sin backticks:
{"titulo":"","organismo":"","tipo":"publica|concurso|privada|europeo","ambito":"local|autonómico|nacional|europeo|internacional","importe_max":"","importe_min":"","cofinanciacion":"","plazo_solicitud":"YYYY-MM-DD o null","plazo_ejecucion":"YYYY-MM-DD o null","fecha_publicacion":"YYYY-MM-DD o null","resumen":"2-3 frases","requisitos":"uno por línea","documentacion":"documentos requeridos, uno por línea","url":"url o null","url_bases":"url bases reguladoras o null","elegibilidad":""}`
  const text = await callAI(sys, `Analiza esta convocatoria:\n${input}`, true, 1500, 'analyze')
  return extractJSON(text.replace(/```json|```/g,'').trim(), '{')
}

export async function searchGrantsForProfile(org: Organization, existingTitles: string[]) {
  const sys = `Experto en subvenciones españolas. Busca convocatorias REALES y ACTUALES.
Consulta BDNS (infosubvenciones.es), BOE, boletines autonómicos y fondos europeos.
Devuelve SOLO array JSON sin backticks, máximo 8 resultados:
[{"titulo":"","organismo":"","tipo":"publica|concurso|privada|europeo","ambito":"nacional","importe_max":"","plazo_solicitud":"YYYY-MM-DD o null","resumen":"","requisitos":["r1","r2"],"url":"url real","elegibilidad":"","matchScore":85,"matchReason":"Por qué encaja con este perfil"}]
Solo convocatorias abiertas o próximas a abrir.`

  const text = await callAI(sys, `Perfil:
- Entidad: ${org.tipo_entidad} "${org.name}"
- CCAA: ${org.ccaa}${org.municipio ? ` (${org.municipio})` : ''}
- CNAE: ${org.cnae || 'no especificado'}${org.cnae_desc ? ` — ${org.cnae_desc}` : ''}
- IAE: ${org.iae || 'no especificado'}${org.iae_desc ? ` — ${org.iae_desc}` : ''}
- Actividad: ${org.actividad || 'no especificada'}
- Empleados: ${org.empleados || 'no especificado'}
- Keywords: ${org.keywords || 'ninguna'}

Ya registradas (no duplicar): ${existingTitles.slice(0,20).join(', ') || 'ninguna'}

Busca en BDNS, BOE, boletín de ${org.ccaa} y fondos europeos relevantes.`, true, 1500, 'search_web', { userId: (org as any).user_id, orgId: (org as any).id })

  try { return extractJSON(text.replace(/```json|```/g,'').trim(), '[') }
  catch { return [] }
}

// ─── DESCUBRIMIENTO DE PRIVADOS (radar IA) ────────────────────────────────────
// Busca en la web premios/concursos/ayudas PRIVADAS reales para el sector del
// perfil. Devuelve un array para volcar al catálogo (fuente='privada').
export async function discoverPrivateGrants(org: Organization): Promise<any[]> {
  const sys = `Eres un experto en ayudas, premios y concursos PRIVADOS en España: fundaciones (la Caixa, BBVA, Repsol, Botín…), bancos, Cámaras de Comercio, grandes empresas y asociaciones sectoriales/patronales.
Busca en la web programas PRIVADOS (NO públicos, NO del BOE/BDNS, NO sanitarios ni prestaciones de la administración) REALES y ACTUALES que encajen con el perfil. Incluye premios y ayudas para COMERCIO y pyme tradicional y para el sector concreto del perfil, no solo startups tecnológicas.
Reglas de relevancia (estrictas):
- Cada resultado debe estar dirigido específicamente a empresas del sector/actividad indicados, no solo "pymes en general" ni resultados de otro sector que hayas encontrado de paso.
- Si buscas y no encuentras premios/ayudas realmente específicos para este sector y actividad, devuelve un array vacío []. Es preferible devolver menos (o ninguno) que rellenar con resultados de otro sector o de un colectivo profesional distinto.
- Descarta cualquier programa público, sanitario, asistencial o de la administración (aunque no esté en el BOE/BDNS): solo cuentan iniciativas de entidades privadas (empresas, fundaciones, bancos, patronales, colegios profesionales del MISMO sector).
Devuelve SOLO un array JSON sin backticks ni texto alrededor, máximo 6, con programas reales y su web oficial:
[{"nombre":"","entidad":"","finalidad":"1 frase breve (máx 180 caracteres) con palabras clave del sector","beneficiarios":["máx 3, breves"],"ambito":"nacional|autonómico","url":"https://web-oficial-real"}]
No inventes programas ni URLs.`
  const user = `Perfil de la empresa:
- Entidad: ${org.tipo_entidad} "${org.name}"
- CCAA: ${org.ccaa}${org.municipio ? ` (${org.municipio})` : ''}
- CNAE: ${org.cnae || '—'}${org.cnae_desc ? ` — ${org.cnae_desc}` : ''}
- IAE: ${org.iae || '—'}${org.iae_desc ? ` — ${org.iae_desc}` : ''}
- Actividad: ${org.actividad || '—'}
- Keywords: ${org.keywords || '—'}

Busca premios, concursos y ayudas PRIVADAS relevantes para este negocio.`
  const text = await callAI(sys, user, true, 4000, 'descubrir_privados', { userId: (org as any).user_id, orgId: (org as any).id })
  const clean = text.replace(/```json|```/g, '').trim()
  try { return extractJSON(clean, '[') } catch { /* puede venir truncado */ }
  // Recuperación: rescata los objetos {...} completos aunque falte cerrar el array.
  try {
    const s = clean.indexOf('[')
    const body = s === -1 ? clean : clean.slice(s + 1)
    const objs = body.match(/\{[^{}]*\}/g) || []
    return objs.map(o => { try { return JSON.parse(o) } catch { return null } }).filter(Boolean)
  } catch { return [] }
}

// ─── RESUMEN DE LA CONVOCATORIA (bases) ────────────────────────────────────────
// Resumen BREVE y barato (pocos tokens, sin adornos) de la convocatoria en sí:
// plazos, importe, quién puede pedirlo, condiciones, para qué es. Se dispara
// solo a petición del usuario (nunca automático) para controlar el coste.
export async function generateResumenConvocatoria(grant: Grant): Promise<string> {
  const sys = `Resumes convocatorias de ayudas, subvenciones, premios y concursos españoles para que un empresario entienda en 30 segundos si le interesa.
Devuelve SOLO Markdown, MUY breve (máximo 120 palabras en total), con exactamente estas secciones (usa estos títulos y emojis tal cual):
## 📅 Plazo
## 💰 Importe
## 👥 Quién puede solicitarlo
## ✅ Condiciones principales
## 🎯 Para qué es
Cada sección: 1-2 frases cortas o una lista de 2-3 puntos, nunca párrafos largos. Si un dato no está disponible ni lo puedes confirmar, escribe "No especificado" — no inventes cifras ni fechas.`

  const u = `Resume esta convocatoria:
- Título: ${grant.titulo}
- Organismo: ${grant.organismo || '—'}
- Importe máximo: ${grant.importe_max || '—'}
- Plazo de solicitud: ${grant.plazo_solicitud || '—'}
- Finalidad/resumen conocido: ${grant.resumen || '—'}
- Elegibilidad conocida: ${grant.elegibilidad || '—'}
- Requisitos conocidos: ${grant.requisitos || '—'}
- URL de las bases: ${grant.url_bases || grant.url || 'no disponible'}

Si la URL de las bases está disponible y los datos anteriores son insuficientes, consúltala para confirmar fechas e importes reales. No inventes nada que no puedas confirmar.`

  const text = await callAI(sys, u, true, 700, 'resumen', { userId: (grant as any).user_id, orgId: (grant as any).org_id })
  return text.trim()
}

// ─── MEMORIA v1 ───────────────────────────────────────────────────────────────
// Borrador de memoria técnica/descriptiva para solicitar la ayuda. Tono PROFESIONAL
// (es un documento oficial, no la voz de marca). Devuelve Markdown.
export async function generateMemoria(grant: Grant, org: Organization | null) {
  const sys = `Eres un consultor experto en la redacción de memorias técnicas y descriptivas para solicitudes de subvenciones, ayudas, concursos y premios en España.
Redacta un BORRADOR de memoria en español, claro, profesional y bien estructurado en Markdown, listo para que el solicitante lo revise, complete y ajuste.
Reglas:
- No inventes cifras económicas, fechas internas ni datos de la entidad que no te den. Donde falte información usa marcadores entre corchetes, p.ej. [completar: presupuesto detallado].
- Adapta el contenido a la convocatoria concreta y al perfil de la entidad.
- Sé concreto y útil; evita relleno y frases vacías.
- No incluyas comentarios tuyos fuera de la memoria.`

  const u = `Redacta el borrador de memoria para esta convocatoria y esta entidad.

## Convocatoria
- Título: ${grant.titulo}
- Organismo: ${grant.organismo || '—'}
- Tipo: ${grant.tipo}
- Importe máximo: ${grant.importe_max || '—'}
- Plazo de solicitud: ${grant.plazo_solicitud || '—'}
- Objeto / resumen: ${grant.resumen || '—'}
- Elegibilidad: ${grant.elegibilidad || '—'}
- Requisitos: ${grant.requisitos || '—'}

## Entidad solicitante
- Nombre: ${org?.name || '[completar: nombre de la entidad]'}
- Tipo de entidad: ${org?.tipo_entidad || '—'}
- Ubicación: ${org?.ccaa || '—'}${org?.municipio ? ` (${org.municipio})` : ''}
- CNAE: ${org?.cnae || '—'}${org?.cnae_desc ? ` — ${org.cnae_desc}` : ''}
- Actividad: ${org?.actividad || '—'}
- Empleados: ${org?.empleados ?? '—'}
- Palabras clave: ${org?.keywords || '—'}

Estructura:
1. Título del proyecto
2. Resumen ejecutivo (objeto de la solicitud)
3. Entidad solicitante
4. Descripción del proyecto / actuación
5. Objetivos
6. Encaje con la convocatoria (cómo cumple requisitos y criterios de elegibilidad)
7. Presupuesto orientativo (con marcadores)
8. Cronograma estimado
9. Impacto y resultados esperados

Devuelve SOLO la memoria en Markdown.`

  const model = 'claude-sonnet-4-6'
  const r = await ai.messages.create({
    model, max_tokens: 3000, system: sys,
    messages: [{ role: 'user', content: u }],
  })
  logApiUsage({ feature: 'memoria', model, usage: r.usage as any, userId: (grant as any).user_id, orgId: (grant as any).org_id }).catch(() => {})
  return (r.content as any[]).map(b => (b.type === 'text' ? b.text : '')).join('\n').trim()
}
