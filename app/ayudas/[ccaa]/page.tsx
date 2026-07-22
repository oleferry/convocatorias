import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CCAA } from '@/lib/types'
import { ccaaSlug, ccaaFromSlug } from '@/lib/geo'
import { fetchOpenGrantsForCcaa } from '@/lib/public-grants'
import { SECTORES } from '@/lib/sectores'
import { T, FONT_DISPLAY } from '@/lib/theme'
import { PageShell, Breadcrumb, RegisterCta, GrantCard, EmptyState } from '../ui'

export const revalidate = 3600

export function generateStaticParams() {
  return CCAA.map(name => ({ ccaa: ccaaSlug(name) }))
}

function resolveCcaa(slug: string): string | null {
  return ccaaFromSlug(slug, CCAA)
}

export async function generateMetadata({ params }: { params: { ccaa: string } }): Promise<Metadata> {
  const name = resolveCcaa(params.ccaa)
  if (!name) return {}
  return {
    title: `Ayudas y subvenciones abiertas en ${name}`,
    description: `Convocatorias estatales y de ${name} abiertas ahora mismo: importe, plazo y quién puede solicitarlas. Actualizado a diario desde la BDNS.`,
  }
}

export default async function CcaaPage({ params }: { params: { ccaa: string } }) {
  const name = resolveCcaa(params.ccaa)
  if (!name) notFound()

  const grants = await fetchOpenGrantsForCcaa(name)

  return (
    <PageShell>
      <Breadcrumb items={[{ label: 'Ayudas', href: '/ayudas' }, { label: name }]} />
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Ayudas y subvenciones abiertas en {name}
      </h1>
      <p style={{ fontSize: 15, color: T.inkLight, maxWidth: 620, lineHeight: 1.6, marginBottom: 20 }}>
        {grants.length} convocatoria{grants.length !== 1 ? 's' : ''} abierta{grants.length !== 1 ? 's' : ''} ahora mismo: estatales y de {name}. Incluye BDNS, fondos europeos y premios privados.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {SECTORES.map(s => (
          <Link key={s.slug} href={`/ayudas/${params.ccaa}/${s.slug}`} style={{
            fontSize: 12.5, padding: '6px 12px', borderRadius: 100, textDecoration: 'none',
            background: T.bgCard, border: `1px solid ${T.border}`, color: T.inkLight,
          }}>{s.labelPlural}</Link>
        ))}
      </div>

      <RegisterCta text={`Crea tu perfil de empresa y te avisamos por Telegram o email cuando salga una ayuda nueva en ${name}.`} />

      {grants.length === 0 ? (
        <EmptyState message={`No hay convocatorias abiertas en ${name} ahora mismo. Vuelve pronto o revisa el listado completo.`} backHref="/ayudas" backLabel="Ver todas las comunidades" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          {grants.map(g => <GrantCard key={g.codigo_bdns} grant={g} />)}
        </div>
      )}
    </PageShell>
  )
}
