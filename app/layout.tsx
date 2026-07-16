import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/react'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.dameperrasperro.es'
const TITLE = 'DamePerrasPerro — El perro que encuentra las perras'
const DESCRIPTION = 'La IA que rastrea ayudas, subvenciones y convocatorias antes de que se te escapen.'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: TITLE, template: '%s · DamePerrasPerro' },
  description: DESCRIPTION,
  icons: { icon: '/logo.png', apple: '/logo.png' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: APP_URL,
    siteName: 'DamePerrasPerro',
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
