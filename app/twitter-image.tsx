import { ogSize, renderOgImage } from '@/lib/og-image'

export const runtime = 'edge'
export const alt = 'DamePerrasPerro — el perro que encuentra las perras'
export const size = ogSize
export const contentType = 'image/png'

export default function Image() {
  return renderOgImage()
}
