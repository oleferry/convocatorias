import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dameperrasperro.es'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/organizations', '/admin', '/api', '/auth/callback'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
