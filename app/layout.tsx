import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/react'
import { APP_URL } from '@/lib/site'
import { JsonLd } from '@/lib/json-ld'

const SITE_NAME = 'DamePerrasPerro'
const TITLE = `${SITE_NAME} — El perro que encuentra las perras`
const DESCRIPTION = 'La IA que rastrea ayudas, subvenciones y convocatorias antes de que se te escapen.'

// Quién es el sitio, en datos estructurados, para buscadores y asistentes de IA.
//
// Solo lleva lo que el propio sitio ya dice de sí mismo: el nombre, la URL, el
// logo que sirve como icono y la descripción de los metadatos. Nada de
// `aggregateRating`, número de usuarios ni cifras: no hay reseñas que marcar. Y
// tampoco email, razón social ni NIF, porque no hay página legal que los declare;
// cuando la haya, se añaden desde ahí.
//
// Los `@id` enlazan WebSite con su Organization sin repetirla; las migas y los
// listados de /ayudas van en sus propias páginas, no aquí.
const ORG_ID = `${APP_URL}/#organization`
const SITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: SITE_NAME,
      url: APP_URL,
      logo: `${APP_URL}/logo.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${APP_URL}/#website`,
      url: APP_URL,
      name: SITE_NAME,
      description: DESCRIPTION,
      inLanguage: 'es-ES',
      publisher: { '@id': ORG_ID },
    },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: TITLE, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  icons: { icon: '/logo.png', apple: '/logo.png' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: APP_URL,
    siteName: SITE_NAME,
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#12312A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <JsonLd data={SITE_JSON_LD} />
      </head>
      <body style={{
        margin: 0,
        fontFamily: "'Barlow', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
        background: '#12312A',
        minHeight: '100vh',
        color: '#F1EFE6',
      }}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
