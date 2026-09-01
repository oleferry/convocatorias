// ================================================================
//  Resúmenes de catálogo: convocatorias abiertas de la BDNS que aún no
//  tienen resumen periodístico ni importe real por beneficiario.
//
//  Vive aparte de la ingesta a propósito. Pedir el detalle a la BDNS cuesta
//  ~0,3 s, pero generar un resumen con IA cuesta segundos: si se hicieran
//  dentro del bucle de ingesta, subir el número de convocatorias diarias
//  reventaría el límite de 300 s de la función. Separado, la ingesta va
//  rápida y los resúmenes se van poniendo al día en pasadas sucesivas —
//  esta consulta encuentra siempre las que falten, sean de hoy o de ayer.
// ================================================================
import { generateResumenCatalogo } from './ai'

export interface ResumenResult {
  procesadas: number; candidatas: number; restantes: number
  fallos: { codigo_bdns: string; error: string }[]; total_fallos: number
}

export async function syncResumenCatalogo(sb: any, opts: { max?: number } = {}): Promise<ResumenResult> {
  const max = opts.max ?? 40
  const today = new Date().toISOString().slice(0, 10)

  const { data: pending, error } = await sb.from('convocatorias_publicas')
    .select('codigo_bdns,titulo,organo,finalidad,beneficiarios,anuncio_texto,presupuesto_total,ccaa,provincia,nivel1')
    .or('fuente.is.null,fuente.eq.bdns')
    .gte('fecha_fin', today)
    .is('resumen_periodista', null)
    .limit(max)
  if (error) throw new Error(error.message)

  let done = 0
  const fallos: { codigo_bdns: string; error: string }[] = []
  for (const row of (pending || [])) {
    try {
      const { resumen, importeBeneficiario } = await generateResumenCatalogo(row)
      if (!resumen) { fallos.push({ codigo_bdns: row.codigo_bdns, error: 'sin resumen (IA no devolvió texto)' }); continue }
      const { error: updErr, data: updData } = await sb.from('convocatorias_publicas').update({
        resumen_periodista: resumen, importe_beneficiario: importeBeneficiario,
        resumen_generado_at: new Date().toISOString(),
      }).eq('codigo_bdns', row.codigo_bdns).select('codigo_bdns')
      if (updErr) { fallos.push({ codigo_bdns: row.codigo_bdns, error: updErr.message }); continue }
      if (!updData || !updData.length) { fallos.push({ codigo_bdns: row.codigo_bdns, error: 'update afectó 0 filas' }); continue }
      done++
    } catch (e: any) {
      // El tope de coste diario llega como excepción: no es un fallo de datos,
      // es el freno haciendo su trabajo. Se corta y se sigue mañana.
      const msg = e?.message || 'error'
      fallos.push({ codigo_bdns: row.codigo_bdns, error: msg })
      if (/tope|límite|limite/i.test(msg)) break
    }
  }

  // .neq con un valor que nunca existe de verdad: no cambia qué filas cuenta,
  // solo evita que una caché externa (delante de la API de Supabase) devuelva
  // esta cuenta cacheada por tener siempre la misma URL exacta — ya nos pasó
  // en el backfill real: "restantes" se quedó pegado varias vueltas seguidas.
  const { count: remaining } = await sb.from('convocatorias_publicas')
    .select('codigo_bdns', { count: 'exact', head: true })
    .or('fuente.is.null,fuente.eq.bdns').gte('fecha_fin', today).is('resumen_periodista', null)
    .neq('codigo_bdns', `__cache_bust_${Date.now()}`)

  return {
    procesadas: done, candidatas: (pending || []).length, restantes: remaining ?? 0,
    fallos: fallos.slice(0, 5), total_fallos: fallos.length,
  }
}
