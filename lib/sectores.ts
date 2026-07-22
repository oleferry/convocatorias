// ================================================================
//  Sectores curados para las páginas públicas /ayudas/[ccaa]/[sector].
//  Cada sector agrupa una o varias letras de sección CNAE (ver
//  sectionLetter en lib/matching.ts) en una categoría reconocible
//  para alguien que no conoce la nomenclatura CNAE.
// ================================================================

export interface Sector {
  slug: string
  label: string        // singular, para "Ayudas de [label] en Madrid"
  labelPlural: string   // para listados/menús
  letters: string[]     // letras de sección CNAE que agrupa
}

export const SECTORES: Sector[] = [
  { slug: 'comercio', label: 'comercio', labelPlural: 'Comercio', letters: ['G'] },
  { slug: 'hosteleria-turismo', label: 'hostelería y turismo', labelPlural: 'Hostelería y turismo', letters: ['I'] },
  { slug: 'construccion', label: 'construcción', labelPlural: 'Construcción', letters: ['F'] },
  { slug: 'industria', label: 'industria', labelPlural: 'Industria manufacturera', letters: ['C'] },
  { slug: 'agricultura-ganaderia', label: 'agricultura y ganadería', labelPlural: 'Agricultura y ganadería', letters: ['A'] },
  { slug: 'transporte-logistica', label: 'transporte y logística', labelPlural: 'Transporte y logística', letters: ['H'] },
  { slug: 'tecnologia', label: 'tecnología', labelPlural: 'Tecnología y comunicaciones', letters: ['J'] },
  { slug: 'servicios-profesionales', label: 'servicios profesionales', labelPlural: 'Servicios profesionales y consultoría', letters: ['M'] },
  { slug: 'administracion-auxiliares', label: 'actividades administrativas y auxiliares', labelPlural: 'Actividades administrativas y auxiliares', letters: ['N'] },
  { slug: 'educacion', label: 'educación', labelPlural: 'Educación', letters: ['P'] },
  { slug: 'sanidad-social', label: 'sanidad y servicios sociales', labelPlural: 'Sanidad y servicios sociales', letters: ['Q'] },
  { slug: 'arte-ocio', label: 'arte, cultura y ocio', labelPlural: 'Arte, cultura y ocio', letters: ['R'] },
  { slug: 'otros-servicios', label: 'otros servicios', labelPlural: 'Otros servicios', letters: ['S'] },
  { slug: 'energia-agua', label: 'energía y agua', labelPlural: 'Energía y agua', letters: ['D', 'E'] },
  { slug: 'finanzas-seguros', label: 'finanzas y seguros', labelPlural: 'Finanzas y seguros', letters: ['K'] },
  { slug: 'inmobiliario', label: 'actividades inmobiliarias', labelPlural: 'Inmobiliario', letters: ['L'] },
]

export function sectorBySlug(slug: string): Sector | null {
  return SECTORES.find(s => s.slug === slug) || null
}
