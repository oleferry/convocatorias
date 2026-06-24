import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gestor de Convocatorias',
  description: 'Subvenciones y ayudas con IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        margin: 0,
        fontFamily: "'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
        background: '#F7F5F0',
        minHeight: '100vh',
        color: '#111827',
      }}>
        {children}
      </body>
    </html>
  )
}
