import Anthropic from '@anthropic-ai/sdk'
import type { Organization, Grant } from './types'

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function extractJSON(text: string, bracket: '{'|'[') {
  const end = bracket === '{' ? '}' : ']'
  const s = text.indexOf(bracket), e = text.lastIndexOf(end)
  if (s === -1) throw new Error('No JSON')
  return JSON.parse(text.slice(s, e + 1))
}

async function callAI(system: string, user: string, search = false, maxTokens = 1500) {
  const body: any = { model:'claude-sonnet-4-6', max_tokens:maxTokens, system, messages:[{role:'user',content:user}] }
  if (search) body.tools = [{ type:'web_search_20250305', name:'web_search' }]
  const r = await ai.messages.create(body)
  return (r.content as any[]).map(b => b.type==='text' ? b.text : '').join('\n')
}

export async function analyzeGrant(input: string) {
  const sys = `Experto en subvenciones españolas. Devuelve SOLO JSON sin backticks:
{"titulo":"","organismo":"","tipo":"publica|concurso|privada|europeo","ambito":"local|autonómico|nacional|europeo|internacional","importe_max":"","importe_min":"","cofinanciacion":"","plazo_solicitud":"YYYY-MM-DD o null","plazo_ejecucion":"YYYY-MM-DD o null","fecha_publicacion":"YYYY-MM-DD o null","resumen":"2-3 frases","requisitos":"uno por línea","documentacion":"documentos requeridos, uno por línea","url":"url o null","url_bases":"url bases reguladoras o null","elegibilidad":""}`
  const text = await callAI(sys, `Analiza esta convocatoria:\n${input}`, true)
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

Busca en BDNS, BOE, boletín de ${org.ccaa} y fondos europeos relevantes.`, true)

  try { return extractJSON(text.replace(/```json|```/g,'').trim(), '[') }
  catch { return [] }
}

// ─── DESCUBRIMIENTO DE PRIVADOS (radar IA) ────────────────────────────────────
// Busca en la web premios/concursos/ayudas PRIVADAS reales para el sector del
// perfil. Devuelve un array para volcar al catálogo (fuente='privada').
export async function discoverPrivateGrants(org: Organization): Promise<any[]> {
  const sys = `Eres un experto en ayudas, premios y concursos PRIVADOS en España: fundaciones (la Caixa, BBVA, Repsol, Botín…), bancos, Cámaras de Comercio, grandes empresas y asociaciones sectoriales/patronales.
Busca en la web programas PRIVADOS (NO públicos del BOE/BDNS) REALES y ACTUALES que encajen con el perfil. Incluye premios y ayudas para COMERCIO y pyme tradicional y para el sector concreto del perfil, no solo startups tecnológicas.
Devuelve SOLO un array JSON sin backticks ni texto alrededor, máximo 6, con programas reales y su web oficial:
[{"nombre":"","entidad":"","finalidad":"1 frase breve (máx 180 caracteres) con palabras clave del sector","beneficiarios":["máx 3, breves"],"ambito":"nacional|autonómico","url":"https://web-oficial-real"}]
No inventes programas ni URLs. Si no encuentras suficientes reales, devuelve menos.`
  const user = `Perfil de la empresa:
- Entidad: ${org.tipo_entidad} "${org.name}"
- CCAA: ${org.ccaa}${org.municipio ? ` (${org.municipio})` : ''}
- CNAE: ${org.cnae || '—'}${org.cnae_desc ? ` — ${org.cnae_desc}` : ''}
- IAE: ${org.iae || '—'}${org.iae_desc ? ` — ${org.iae_desc}` : ''}
- Actividad: ${org.actividad || '—'}
- Keywords: ${org.keywords || '—'}

Busca premios, concursos y ayudas PRIVADAS relevantes para este negocio.`
  const text = await callAI(sys, user, true, 4000)
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

  const r = await ai.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 3000, system: sys,
    messages: [{ role: 'user', content: u }],
  })
  return (r.content as any[]).map(b => (b.type === 'text' ? b.text : '')).join('\n').trim()
}
