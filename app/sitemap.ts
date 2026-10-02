import type { MetadataRoute } from 'next'
import { CCAA } from '@/lib/types'
import { ccaaSlug } from '@/lib/geo'
import { SECTORES } from '@/lib/sectores'
import { APP_URL } from '@/lib/site'
import { fetchSectorCounts, fetchIndexableGrantCodes, grantPath, MIN_PROPIAS_PARA_INDEXAR } from '@/lib/public-grants'

// Se recalcula cada hora, como las páginas: qué página de sector entra depende
// de cuántas convocatorias propias tiene hoy.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = [
    // La portada no lleva lastModified: no cambia cada día, y decirle a Google
    // que sí es la forma de que deje de hacer caso a la fecha en todo el sitio.
    { url: APP_URL, changeFrequency: 'weekly', priority: 1 },
    // /auth no entra: una pantalla de acceso no resuelve ninguna busqueda, y
    // ademas se declara noindex en app/auth/layout.tsx. Pedir que se indexe y
    // prohibirlo a la vez es lo que acaba haciendo que Google decida solo.
    // Los listados sí cambian a diario: el cron ingiere convocatorias nuevas y
    // cierra las que vencen.
    { url: `${APP_URL}/ayudas`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
  ]

  // Las páginas de sector solo entran si tienen convocatorias propias
  // suficientes; las demás llevan noindex (app/ayudas/[ccaa]/[sector]/page.tsx)
  // y ofrecerlas aquí sería pedir que se indexe algo que se prohíbe indexar.
  // Si la consulta falla (null), se ofrecen todas: mejor un aviso pasajero en
  // Search Console que sacar del sitemap páginas buenas por un error de red.
  const cuentas = await fetchSectorCounts(CCAA, SECTORES, ccaaSlug)

  for (const name of CCAA) {
    entries.push({ url: `${APP_URL}/ayudas/${ccaaSlug(name)}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 })
    for (const s of SECTORES) {
      const clave = `${ccaaSlug(name)}/${s.slug}`
      if (cuentas && (cuentas.get(clave) ?? 0) < MIN_PROPIAS_PARA_INDEXAR) continue
      entries.push({ url: `${APP_URL}/ayudas/${clave}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 })
    }
  }

  // Una ficha por convocatoria abierta con texto propio suficiente. Las cerradas,
  // las de concesión directa y las que apenas traen texto llevan noindex en
  // app/ayuda/[codigo]/page.tsx y no se ofrecen aquí.
  for (const { codigo, desde } of (await fetchIndexableGrantCodes()) ?? []) {
    entries.push({
      url: `${APP_URL}${grantPath(codigo)}`,
      ...(desde ? { lastModified: new Date(desde) } : {}),
      changeFrequency: 'weekly',
      priority: 0.7,
    })
  }
  return entries
}
