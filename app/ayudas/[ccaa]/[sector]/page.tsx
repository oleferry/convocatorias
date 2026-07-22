import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CCAA } from '@/lib/types'
import { ccaaSlug, ccaaFromSlug } from '@/lib/geo'
import { fetchOpenGrantsForCcaa } from '@/lib/public-grants'
import { SECTORES, sectorBySlug } from '@/lib/sectores'
import { T, FONT_DISPLAY } from '@/lib/theme'
import { PageShell, Breadcrumb, RegisterCta, GrantCard, EmptyState } from '../../ui'

export const revalidate = 3600

export function generateStaticParams() {
  const params: { ccaa: string; sector: string }[] = []
  for (const name of CCAA) for (const s of SECTORES) params.push({ ccaa: ccaaSlug(name), sector: s.slug })
  return params
}

export async function generateMetadata({ params }: { params: { ccaa: string; sector: string } }): Promise<Metadata> {
  const name = ccaaFromSlug(params.ccaa, CCAA)
  const sector = sectorBySlug(params.sector)
  if (!name || !sector) return {}
  return {
    title: `Ayudas para ${sector.label} en ${name}`,
    description: `Convocatorias abiertas para empresas de ${sector.label} en ${name}: importe, plazo y quién puede solicitarlas. Actualizado a diario desde la BDNS.`,
  }
}

export default async function CcaaSectorPage({ params }: { params: { ccaa: string; sector: string } }) {
  const name = ccaaFromSlug(params.ccaa, CCAA)
  const sector = sectorBySlug(params.sector)
  if (!name || !sector) notFound()

  const grants = await fetchOpenGrantsForCcaa(name, sector)

  return (
    <PageShell>
      <Breadcrumb items={[
        { label: 'Ayudas', href: '/ayudas' },
        { label: name, href: `/ayudas/${params.ccaa}` },
        { label: sector.labelPlural },
      ]} />
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Ayudas para {sector.label} en {name}
      </h1>
      <p style={{ fontSize: 15, color: T.inkLight, maxWidth: 620, lineHeight: 1.6, marginBottom: 24 }}>
        {grants.length} convocatoria{grants.length !== 1 ? 's' : ''} abierta{grants.length !== 1 ? 's' : ''} para empresas de {sector.label} en {name}, entre estatales, autonómicas y fondos europeos.
      </p>

      <RegisterCta text={`Guarda estas convocatorias y te avisamos antes de que cierre el plazo.`} />

      {grants.length === 0 ? (
        <EmptyState message={`No hay convocatorias específicas de ${sector.label} abiertas en ${name} ahora mismo.`} backHref={`/ayudas/${params.ccaa}`} backLabel={`Ver todas las ayudas en ${name}`} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          {grants.map(g => <GrantCard key={g.codigo_bdns} grant={g} />)}
        </div>
      )}
    </PageShell>
  )
}
