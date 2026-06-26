// ================================================================
//  Radar sync: vuelca al catálogo los programas curados (privados +
//  europeos umbrella) y las convocatorias europeas reales (EU portal).
//  Reutilizable por /api/cron/radar y por el cron diario de ingesta.
// ================================================================
import { RADAR_PROGRAMS } from './radar-data'
import { fetchEuCalls } from './eu-funding'

export async function syncRadar(sb: any): Promise<{ curados: number; europeas: number }> {
  const rows = RADAR_PROGRAMS.map(p => ({
    codigo_bdns: `radar-${p.id}`,
    titulo: p.nombre,
    organo: p.entidad,
    nivel1: 'ESTATAL',
    ccaa: null,
    tipo_convocatoria: p.fuente === 'europea' ? 'Fondo europeo' : 'Premio / programa privado',
    finalidad: p.finalidad,
    beneficiarios: p.beneficiarios,
    sectores: [],
    regiones: [],
    bases_url: p.url,
    abierto: true,
    fecha_inicio: null,
    fecha_fin: null,
    fecha_recepcion: null,
    presupuesto_total: null,
    fuente: p.fuente,
  }))
  const { error } = await sb.from('convocatorias_publicas').upsert(rows, { onConflict: 'codigo_bdns' })
  if (error) throw new Error(error.message)

  let europeas = 0
  try {
    const euRows = await fetchEuCalls(150)
    for (let i = 0; i < euRows.length; i += 200) {
      const { error: euErr } = await sb.from('convocatorias_publicas').upsert(euRows.slice(i, i + 200), { onConflict: 'codigo_bdns' })
      if (euErr) throw new Error(euErr.message)
    }
    europeas = euRows.length
  } catch (e: any) {
    console.warn('[radar] EU calls falló:', e?.message)
  }
  return { curados: rows.length, europeas }
}
