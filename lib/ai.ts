import Anthropic from '@anthropic-ai/sdk'
import type { Organization } from './types'

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function extractJSON(text: string, bracket: '{'|'[') {
  const end = bracket === '{' ? '}' : ']'
  const s = text.indexOf(bracket), e = text.lastIndexOf(end)
  if (s === -1) throw new Error('No JSON')
  return JSON.parse(text.slice(s, e + 1))
}

async function callAI(system: string, user: string, search = false) {
  const body: any = { model:'claude-sonnet-4-6', max_tokens:1500, system, messages:[{role:'user',content:user}] }
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
