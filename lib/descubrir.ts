// ================================================================
//  Descubrimiento IA de privados: para cada perfil (deduplicado por
//  sector + CCAA), busca premios/concursos/ayudas privadas en la web
//  y los vuelca al catálogo (fuente='privada'). Se marcan con el sector
//  del perfil para que el matching los muestre en "Para tu sector".
// ================================================================
import { discoverPrivateGrants } from './ai'
import type { Organization } from './types'

function slug(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64)
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

export async function syncDescubrimiento(sb: any, opts: { max?: number } = {}): Promise<{ sectores: number; anadidas: number }> {
  const max = opts.max ?? 6
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
    for (const it of (items || [])) {
      if (!it || !it.url || !it.nombre) continue
      rows.push({
        codigo_bdns: 'priv-' + slug(String(it.url || it.nombre)),
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
