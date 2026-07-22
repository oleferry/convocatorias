// ================================================================
//  Descubrimiento IA de privados: para cada perfil (deduplicado por
//  sector + CCAA), busca premios/concursos/ayudas privadas en la web
//  y los vuelca al catálogo (fuente='privada'). Se marcan con el sector
//  del perfil para que el matching los muestre en "Para tu sector".
// ================================================================
import { discoverPrivateGrants } from './ai'
import { strip, tokens, STOP_TOKENS } from './matching'
import type { Organization } from './types'

// Red de seguridad: aunque el prompt pida resultados específicos del sector,
// la IA a veces devuelve programas de otro sector (o públicos/sanitarios) para
// rellenar. Antes de estampar el sector del perfil sobre el resultado (lo que
// lo haría aparecer como "tu sector encaja" para CUALQUIER negocio con ese
// mismo CNAE), exigimos que el propio texto del resultado comparta al menos
// una palabra significativa con el perfil que lo buscó.
function esRelevante(item: any, org: any): boolean {
  const profileTokens = new Set([...tokens(org.keywords), ...tokens(org.actividad), ...tokens(org.cnae_desc), ...tokens(org.iae_desc)])
  for (const t of STOP_TOKENS) profileTokens.delete(t)
  if (!profileTokens.size) return true // sin datos de perfil que comparar: no bloqueamos
  const hay = strip([item.nombre, item.finalidad, ...(Array.isArray(item.beneficiarios) ? item.beneficiarios : [])].join(' '))
  for (const t of profileTokens) if (hay.includes(t)) return true
  return false
}

function slug(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64)
}

// Clave ESTABLE por nombre normalizado: quita "(NOA)", años, ediciones y palabras
// vacías, y se queda con las primeras palabras significativas. Así el mismo
// programa colapsa aunque la IA varíe la URL o el sufijo entre ejecuciones.
function progKey(nombre: string): string {
  const base = (nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(19|20)\d{2}([\/-](19|20)?\d{2})?\b/g, ' ')
    .replace(/\b([ivxlcdm]+|edici[oó]n|programa|premios?|linea|ayudas?|beca|becas|convocatoria|de|del|la|el|los|las|para|por|y|en|a|the)\b/gi, ' ')
  return slug(base).split('-').filter(Boolean).slice(0, 6).join('-') || slug(nombre)
}

// Estampa el sector del perfil (división CNAE) para que la convocatoria privada
// encaje en "Para tu sector" de ese tipo de negocio.
function sectoresOf(org: any): { codigo: string; descripcion: string }[] {
  const out: { codigo: string; descripcion: string }[] = []
  const seen = new Set<string>()
  const add = (v: any) => { const d = String(v).replace(/\D/g, '').slice(0, 2); if (d && !seen.has(d)) { seen.add(d); out.push({ codigo: d, descripcion: org.cnae_desc || 'Sector del perfil' }) } }
  for (const c of (org.cnaes || [])) add(c)
  if (org.cnae) add(org.cnae)
  return out
}

export async function syncDescubrimiento(sb: any, opts: { max?: number; reset?: boolean } = {}): Promise<{ sectores: number; anadidas: number }> {
  const max = opts.max ?? 6
  // Limpieza opcional de los privados descubiertos previos (para regenerar sin duplicados).
  if (opts.reset) await sb.from('convocatorias_publicas').delete().like('codigo_bdns', 'priv-%')
  const { data: orgs } = await sb.from('organizations').select('*').eq('is_archived', false)

  // Deduplicar trabajo por sector + CCAA (no repetimos búsqueda por cada usuario).
  const seen = new Set<string>(); const targets: any[] = []
  for (const o of (orgs || [])) {
    const key = (o.cnae || o.actividad || o.name || '') + '|' + (o.ccaa || '')
    if (seen.has(key)) continue
    seen.add(key); targets.push(o)
    if (targets.length >= max) break
  }

  let anadidas = 0
  for (const o of targets) {
    let items: any[] = []
    try { items = await discoverPrivateGrants(o as Organization) } catch (e: any) { console.warn('[descubrir]', e?.message); continue }
    const sect = sectoresOf(o)
    const rows: any[] = []
    const seenKeys = new Set<string>()
    for (const it of (items || [])) {
      if (!it || !it.url || !it.nombre) continue
      if (!esRelevante(it, o)) { console.warn('[descubrir] descartado por baja relevancia:', it.nombre); continue }
      const key = progKey(String(it.nombre))
      if (seenKeys.has(key)) continue // dedup dentro del mismo lote
      seenKeys.add(key)
      rows.push({
        codigo_bdns: 'priv-' + key,
        titulo: String(it.nombre).slice(0, 300),
        organo: it.entidad || null,
        nivel1: it.ambito === 'autonómico' ? 'AUTONOMICA' : 'ESTATAL',
        ccaa: it.ambito === 'autonómico' ? o.ccaa : null,
        tipo_convocatoria: 'Premio / programa privado (IA)',
        finalidad: it.finalidad || null,
        beneficiarios: Array.isArray(it.beneficiarios) ? it.beneficiarios.map(String) : [],
        sectores: sect,
        regiones: [],
        bases_url: it.url,
        abierto: true, fecha_inicio: null, fecha_fin: null, fecha_recepcion: null, presupuesto_total: null,
        fuente: 'privada',
      })
    }
    if (rows.length) {
      const { error } = await sb.from('convocatorias_publicas').upsert(rows, { onConflict: 'codigo_bdns' })
      if (error) console.warn('[descubrir upsert]', error.message); else anadidas += rows.length
    }
  }
  return { sectores: targets.length, anadidas }
}
