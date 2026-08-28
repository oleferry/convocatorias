import type { MetadataRoute } from 'next'
import { CCAA } from '@/lib/types'
import { ccaaSlug } from '@/lib/geo'
import { SECTORES } from '@/lib/sectores'
import { APP_URL } from '@/lib/site'


export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    // /auth no entra: una pantalla de acceso no resuelve ninguna busqueda, y
    // ademas se declara noindex en app/auth/layout.tsx. Pedir que se indexe y
    // prohibirlo a la vez es lo que acaba haciendo que Google decida solo.
    { url: `${APP_URL}/ayudas`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
  ]
  for (const name of CCAA) {
    entries.push({ url: `${APP_URL}/ayudas/${ccaaSlug(name)}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 })
    for (const s of SECTORES) {
      entries.push({ url: `${APP_URL}/ayudas/${ccaaSlug(name)}/${s.slug}`, lastModified: now, changeFrequency: 'daily', priority: 0.6 })
    }
  }
  return entries
}
