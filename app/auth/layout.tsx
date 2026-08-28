import type { Metadata } from 'next'

// `app/auth/page.tsx` es un componente de cliente y no puede exportar
// `metadata`, así que la declaración va aquí.
//
// Una pantalla de acceso no resuelve ninguna búsqueda: quien llega buscando
// ayudas no quiere un formulario de entrada. Fuera del índice, y fuera también
// del sitemap — estaba en los dos sitios a la vez.
//
// `follow` se deja puesto: los enlaces de dentro siguen contando.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
