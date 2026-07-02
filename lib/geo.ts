// ================================================================
//  Geo: resuelve provincia/CCAA a partir de los datos de ubicación
//  que trae la BDNS para convocatorias LOCALES (nivel2 = municipio o
//  "Diputación de X"; regiones = NUTS3 tipo "ES114 - Pontevedra").
//  Reutiliza los catálogos oficiales de /public/data.
// ================================================================
import provinciasData from '../public/data/provincias.json'
import municipiosData from '../public/data/municipios.json'

interface ProvinciaItem { id: string; n: string; ccaa: string }
interface MunicipioItem { id: string; p: string; n: string }

const provincias = provinciasData as ProvinciaItem[]
const municipios = municipiosData as MunicipioItem[]

// Clave de comparación insensible a acentos, mayúsculas y orden de palabras
// (para que "A Coruña" y "Coruña, A" —o "Illes Balears" y "Balears, Illes"— casen).
function normKey(s: string): string {
  const stripped = (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return stripped.split(' ').filter(Boolean).sort().join('-')
}

const PROVINCIA_BY_KEY = new Map<string, ProvinciaItem>()
for (const p of provincias) PROVINCIA_BY_KEY.set(normKey(p.n), p)

const PROVINCIA_ID_TO_ITEM = new Map<string, ProvinciaItem>()
for (const p of provincias) PROVINCIA_ID_TO_ITEM.set(p.id, p)

const MUNICIPIO_BY_KEY = new Map<string, string[]>() // normKey(nombre) -> [provinciaId, ...]
for (const m of municipios) {
  const k = normKey(m.n)
  const arr = MUNICIPIO_BY_KEY.get(k)
  if (arr) arr.push(m.p); else MUNICIPIO_BY_KEY.set(k, [m.p])
}

export interface GeoResult { provincia: string; ccaa: string }

function provinciaFromMunicipioName(name: string): GeoResult | null {
  const ids = MUNICIPIO_BY_KEY.get(normKey(name))
  if (!ids || !ids.length) return null
  const p = PROVINCIA_ID_TO_ITEM.get(ids[0])
  return p ? { provincia: p.n, ccaa: p.ccaa } : null
}

function provinciaFromName(name: string): GeoResult | null {
  const p = PROVINCIA_BY_KEY.get(normKey(name))
  return p ? { provincia: p.n, ccaa: p.ccaa } : null
}

// "DIPUTACIÓN PROV. DE CÁDIZ" / "CABILDO DE GRAN CANARIA" / "CONSELL INSULAR DE MALLORCA" → nombre de provincia
const DIP_RE = /\b(diputaci[oó]n|cabildo|consell insular)\b.*?\bde\b\s+(.+)/i

/**
 * Resuelve provincia/CCAA para una convocatoria LOCAL a partir de las pistas
 * disponibles, de la más a la menos fiable:
 *  1) `regiones` (NUTS3, ej. "ES114 - Pontevedra") — solo en el detalle.
 *  2) nivel2 tipo "Diputación de X" / "Cabildo de X".
 *  3) nivel2 como nombre de municipio (caso más común: ayuntamientos).
 */
export function resolveLocalGeo(nivel2?: string | null, nivel3?: string | null, regiones?: (string | null | undefined)[]): GeoResult | null {
  for (const r of (regiones || [])) {
    const m = /^ES\d{3}\s*-\s*(.+)$/i.exec((r || '').trim())
    if (m) { const g = provinciaFromName(m[1]); if (g) return g }
  }
  const n2 = (nivel2 || '').trim()
  const dip = DIP_RE.exec(n2) || DIP_RE.exec(nivel3 || '')
  if (dip) { const g = provinciaFromName(dip[2]); if (g) return g }
  if (n2) { const g = provinciaFromMunicipioName(n2); if (g) return g }
  return null
}
