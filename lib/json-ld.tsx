// Un bloque `<script type="application/ld+json">`, escrito en un solo sitio.
//
// Antes vivía dentro de Breadcrumb; ahora lo usan también el layout (Organization
// y WebSite) y los listados de /ayudas (ItemList). Tres copias del mismo
// `dangerouslySetInnerHTML` son tres sitios donde olvidarse del escape.
//
// `<` escapado: una etiqueta de cierre dentro del JSON cerraría el script antes
// de tiempo. En los listados los títulos vienen de la BDNS, que no es nuestra, así
// que aquí ya no es una suposición sobre el futuro: es la defensa.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
