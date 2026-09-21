import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CCAA } from '@/lib/types'
import { ccaaSlug, ccaaFromSlug } from '@/lib/geo'
import { fetchSectorGrantsForCcaa, MIN_PROPIAS_PARA_INDEXAR } from '@/lib/public-grants'
import { SECTORES, sectorBySlug, type Sector } from '@/lib/sectores'
import { T, FONT_DISPLAY } from '@/lib/theme'
import { PageShell, Breadcrumb, RegisterCta, GrantList, EmptyState } from '../../ui'

export const revalidate = 3600

// La misma consulta la piden generateMetadata (para decidir el noindex) y la
// página: con cache() se hace una vez por render.
const datosDeSector = cache((ccaa: string, sector: Sector) => fetchSectorGrantsForCcaa(ccaa, sector))

export function generateStaticParams() {
  const params: { ccaa: string; sector: string }[] = []
  for (const name of CCAA) for (const s of SECTORES) params.push({ ccaa: ccaaSlug(name), sector: s.slug })
  return params
}

export async function generateMetadata({ params }: { params: { ccaa: string; sector: string } }): Promise<Metadata> {
  const name = ccaaFromSlug(params.ccaa, CCAA)
  const sector = sectorBySlug(params.sector)
  if (!name || !sector) return {}
  const { propias } = await datosDeSector(name, sector)
  return {
    title: `Ayudas para ${sector.label} en ${name}`,
    description: `Convocatorias abiertas para empresas de ${sector.label} en ${name}: importe, plazo y quién puede solicitarlas. Actualizado a diario desde la BDNS.`,
    alternates: { canonical: `/ayudas/${params.ccaa}/${params.sector}` },
    // Con pocas convocatorias propias la página es, a ojos de Google, casi la
    // misma que la de la comunidad. Sigue sirviendo a quien llega, pero no se
    // ofrece al índice (y tampoco sale en el sitemap, ver app/sitemap.ts).
    ...(propias.length < MIN_PROPIAS_PARA_INDEXAR && { robots: { index: false, follow: true } }),
  }
}

export default async function CcaaSectorPage({ params }: { params: { ccaa: string; sector: string } }) {
  const name = ccaaFromSlug(params.ccaa, CCAA)
  const sector = sectorBySlug(params.sector)
  if (!name || !sector) notFound()

  const { propias, generales } = await datosDeSector(name, sector)
  const heading = `Ayudas para ${sector.label} en ${name}`
  const s = (n: number) => (n !== 1 ? 's' : '')

  return (
    <PageShell>
      <Breadcrumb items={[
        { label: 'Ayudas', href: '/ayudas' },
        { label: name, href: `/ayudas/${params.ccaa}` },
        { label: sector.labelPlural },
      ]} />
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        {heading}
      </h1>
      <p style={{ fontSize: 15, color: T.inkLight, maxWidth: 620, lineHeight: 1.6, marginBottom: 12 }}>
        {propias.length} convocatoria{s(propias.length)} abierta{s(propias.length)} dirigida{s(propias.length)} expresamente a empresas de {sector.label} en {name}, entre estatales, autonómicas y fondos europeos.
      </p>
      {generales > 0 && (
        <p style={{ fontSize: 14.5, color: T.inkLight, maxWidth: 620, lineHeight: 1.6, marginBottom: 24 }}>
          Además hay {generales} convocatoria{s(generales)} abierta{s(generales)} a cualquier sector que también te pueden valer.{' '}
          <Link href={`/ayudas/${params.ccaa}`} style={{ color: T.gold, fontWeight: 700, textDecoration: 'none' }}>
            Verlas todas en {name} →
          </Link>
        </p>
      )}

      <RegisterCta text={`Guarda estas convocatorias y te avisamos antes de que cierre el plazo.`} />

      {propias.length === 0 ? (
        <EmptyState message={`No hay convocatorias específicas de ${sector.label} abiertas en ${name} ahora mismo.`} backHref={`/ayudas/${params.ccaa}`} backLabel={`Ver todas las ayudas en ${name}`} />
      ) : (
        <GrantList name={heading} grants={propias} />
      )}
    </PageShell>
  )
}
