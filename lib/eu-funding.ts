// ================================================================
//  EU Funding & Tenders Portal (SEDIA) — convocatorias europeas reales
//  API pública: devuelve calls for proposals (grants) ABIERTAS con su
//  plazo real. Las normalizamos al catálogo con fuente='europea'.
// ================================================================

const EU_SEARCH = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=***'
const STATUS_OPEN = '31094502'   // Open (Forthcoming = 31094501, Closed = 31094503)
const TYPE_GRANTS = '1'          // Calls for proposals (subvenciones)

function firstStr(v: any): string { return Array.isArray(v) ? (v[0] ?? '') : (v ?? '') }
function ymd(s: any): string | null {
  const v = firstStr(s); if (!v) return null
  const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

export async function fetchEuCalls(max = 150): Promise<any[]> {
  const today = new Date().toISOString().slice(0, 10)
  const byCode = new Map<string, any>()

  for (let page = 1; page <= 3 && byCode.size < max; page++) {
    const url = `${EU_SEARCH}&pageSize=100&pageNumber=${page}`
    const fd = new FormData()
    fd.append('query', new Blob([JSON.stringify({
      bool: { must: [{ terms: { type: [TYPE_GRANTS] } }, { terms: { status: [STATUS_OPEN] } }] },
    })], { type: 'application/json' }))
    fd.append('languages', new Blob([JSON.stringify(['en'])], { type: 'application/json' }))
    fd.append('sort', new Blob([JSON.stringify({ field: 'deadlineDate', order: 'ASC' })], { type: 'application/json' }))

    let res: Response
    try { res = await fetch(url, { method: 'POST', body: fd }) } catch { break }
    if (!res.ok) break
    const json: any = await res.json()
    const results: any[] = json.results || []
    if (!results.length) break

    for (const r of results) {
      const m = r.metadata || {}
      const ident = firstStr(m.identifier) || firstStr(m.callIdentifier)
      if (!ident) continue
      const fecha_fin = ymd(m.deadlineDate)
      if (!fecha_fin || fecha_fin < today) continue   // solo abiertas con plazo futuro
      const code = `eu-${ident}`
      if (byCode.has(code)) continue
      byCode.set(code, {
        codigo_bdns: code,
        titulo: firstStr(m.title) || ident,
        organo: firstStr(m.frameworkProgramme) || 'Comisión Europea',
        nivel1: 'ESTATAL',
        ccaa: null,
        tipo_convocatoria: 'Convocatoria europea',
        finalidad: (firstStr(m.callTitle) || stripHtml(firstStr(m.descriptionByte))).slice(0, 220) || null,
        beneficiarios: [],
        sectores: [],
        regiones: [],
        bases_url: r.url || `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${ident}`,
        abierto: true,
        fecha_inicio: ymd(m.startDate),
        fecha_fin,
        fecha_recepcion: null,
        presupuesto_total: null,
        fuente: 'europea',
      })
      if (byCode.size >= max) break
    }
  }
  return [...byCode.values()]
}
