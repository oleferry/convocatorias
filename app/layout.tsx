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
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        margin: 0,
        fontFamily: "'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
        background: '#F8F4EC',
        minHeight: '100vh',
        color: '#121212',
      }}>
        {children}
      </body>
    </html>
  )
}
