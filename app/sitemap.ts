import type { MetadataRoute } from 'next'
import { CCAA } from '@/lib/types'
import { ccaaSlug } from '@/lib/geo'
import { SECTORES } from '@/lib/sectores'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dameperrasperro.es'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const entries: MetadataRoute.Sitemap = [
    { url: APP_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${APP_URL}/auth`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
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
