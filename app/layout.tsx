import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DamePerrasPerro — El perro que encuentra las perras',
  description: 'La IA que rastrea ayudas, subvenciones y convocatorias antes de que se te escapen.',
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
      </body>
    </html>
  )
}
