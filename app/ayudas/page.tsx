import type { Metadata } from 'next'
import Link from 'next/link'
import { CCAA } from '@/lib/types'
import { ccaaSlug } from '@/lib/geo'
import { fetchOpenGrantsSummary } from '@/lib/public-grants'
import { T, FONT_DISPLAY } from '@/lib/theme'
import { PageShell, RegisterCta } from './ui'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Ayudas y subvenciones abiertas por comunidad autónoma',
  description: 'Convocatorias de ayudas, subvenciones y fondos europeos abiertas ahora mismo, organizadas por comunidad autónoma. Datos de la BDNS actualizados a diario.',
}

export default async function AyudasIndexPage() {
  const rows = await fetchOpenGrantsSummary()
  const estatalCount = rows.filter(r => (r.nivel1 || '').toUpperCase() === 'ESTATAL').length
  const counts = new Map<string, number>()
  for (const r of rows) if (r.ccaa) counts.set(r.ccaa, (counts.get(r.ccaa) || 0) + 1)

  return (
    <PageShell>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
        Ayudas y subvenciones abiertas, por comunidad autónoma
      </h1>
      <p style={{ fontSize: 15, color: T.inkLight, maxWidth: 620, lineHeight: 1.6, marginBottom: 8 }}>
        {estatalCount} convocatorias estatales abiertas ahora mismo, más las de cada comunidad. Datos de la BDNS y de fondos europeos, actualizados a diario.
      </p>

      <RegisterCta text="Guarda las convocatorias que te interesan y recibe un aviso automático antes de que cierre el plazo." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 24 }}>
        {CCAA.map(name => {
          const total = estatalCount + (counts.get(name) || 0)
          return (
            <Link key={name} href={`/ayudas/${ccaaSlug(name)}`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
              background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10,
              padding: '14px 16px', textDecoration: 'none', color: T.ink,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
              <span style={{ fontSize: 12.5, color: T.gold, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{total}</span>
            </Link>
          )
        })}
      </div>
    </PageShell>
  )
}
