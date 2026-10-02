import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchGrantByCode, grantPath } from '@/lib/public-grants'
import { ccaaSlug } from '@/lib/geo'
import { T, FONT_DISPLAY, daysLeft } from '@/lib/theme'
import { PageShell, Breadcrumb, RegisterCta } from '../../ayudas/ui'
import { documentacionHabitual } from '@/lib/tramitacion'
import SolicitudForm from './SolicitudForm'

// Ficha pública de una convocatoria.
//
// Hasta ahora las convocatorias solo existían dentro de listados que enlazaban
// fuera, a las bases oficiales. Quien buscaba una ayuda concreta por su nombre
// no podía llegar aquí, y un asistente de IA no tenía una página que citar.
// Esta es esa página: una por convocatoria, con lo que dice la BDNS y nada más.
//
// Solo se indexan las abiertas, que no son de concesión directa y que tienen
// texto propio suficiente (ver `esIndexable` en lib/public-grants.ts). Las demás
// se pueden abrir desde un listado, con noindex.

export const revalidate = 3600

function decode(codigo: string): string {
  try { return decodeURIComponent(codigo) } catch { return codigo }
}

export async function generateMetadata({ params }: { params: { codigo: string } }): Promise<Metadata> {
  const g = await fetchGrantByCode(decode(params.codigo))
  if (!g) return {}
  const donde = g.nivel1 === 'ESTATAL' ? 'toda España' : g.ccaa || 'España'
  const plazo = g.fechaFin ? ` Plazo hasta el ${fechaLarga(g.fechaFin)}.` : ''
  return {
    title: g.titulo,
    description: `${g.organo ? `${g.organo}. ` : ''}Para ${donde}.${g.importe ? ` ${g.importeEsTotal ? 'Presupuesto' : 'Hasta'} ${g.importe}.` : ''}${plazo} Requisitos, quién puede pedirla y enlace a las bases oficiales.`.slice(0, 300),
    alternates: { canonical: grantPath(g.codigo_bdns) },
    ...(g.indexable ? {} : { robots: { index: false, follow: true } }),
  }
}

function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' })
}

export default async function FichaAyuda({ params }: { params: { codigo: string } }) {
  const g = await fetchGrantByCode(decode(params.codigo))
  if (!g) notFound()

  const dias = daysLeft(g.fechaFin)
  const ambito = g.nivel1 === 'ESTATAL' ? 'Estatal' : g.nivel1 === 'LOCAL' ? 'Local' : g.ccaa ? `Autonómica · ${g.ccaa}` : null
  const migas = g.nivel1 !== 'ESTATAL' && g.ccaa
    ? [{ label: 'Ayudas', href: '/ayudas' }, { label: g.ccaa, href: `/ayudas/${ccaaSlug(g.ccaa)}` }, { label: g.titulo }]
    : [{ label: 'Ayudas', href: '/ayudas' }, { label: g.titulo }]

  const datos: { label: string; valor: string }[] = [
    ...(g.organo ? [{ label: 'Convoca', valor: g.organo }] : []),
    ...(ambito ? [{ label: 'Ámbito', valor: ambito }] : []),
    ...(g.importe ? [{ label: g.importeEsTotal ? 'Presupuesto total' : 'Importe por beneficiario', valor: g.importeEsTotal ? g.importe : `Hasta ${g.importe}` }] : []),
    ...(g.fechaInicio ? [{ label: 'Abre', valor: fechaLarga(g.fechaInicio) }] : []),
    { label: 'Cierra', valor: g.fechaFin ? fechaLarga(g.fechaFin) : 'Sin plazo fijo: consulta las bases' },
    ...(g.beneficiarios.length ? [{ label: 'Pueden pedirla', valor: g.beneficiarios.join(' · ') }] : []),
    ...(g.sectorLabels.length ? [{ label: 'Sectores', valor: g.sectorLabels.join(' · ') }] : []),
  ]

  return (
    <PageShell>
      <Breadcrumb items={migas} />

      {!g.abierta && (
        <p style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 14, color: T.inkMid, marginBottom: 18 }}>
          <strong>Plazo cerrado.</strong> Esta convocatoria ya no admite solicitudes. Si se vuelve a convocar, suele salir con otro código en la BDNS.
        </p>
      )}

      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.01em', lineHeight: 1.25 }}>
        {g.titulo}
      </h1>
      {g.tituloCompleto !== g.titulo && (
        <p style={{ fontSize: 13.5, color: T.inkLight, lineHeight: 1.55, margin: '0 0 18px' }}>{g.tituloCompleto}</p>
      )}

      {g.abierta && dias !== null && dias >= 0 && (
        <p style={{ fontSize: 15, fontWeight: 800, color: dias <= 7 ? T.red : T.gold, margin: '0 0 18px' }}>
          {dias === 0 ? 'Cierra hoy' : `Quedan ${dias} día${dias === 1 ? '' : 's'} para pedirla`}
        </p>
      )}

      {g.finalidad && (
        <section style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>Para qué es</h2>
          <p style={{ fontSize: 15, color: T.inkMid, lineHeight: 1.65, margin: 0 }}>{g.finalidad}</p>
        </section>
      )}

      <section style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>Los datos</h2>
        <dl style={{ margin: 0, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: '6px 18px' }}>
          {datos.map((d) => (
            <div key={d.label} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
              <dt style={{ fontSize: 13, color: T.inkMuted, minWidth: 170 }}>{d.label}</dt>
              <dd style={{ margin: 0, fontSize: 14, color: T.ink, flex: 1, minWidth: 200 }}>{d.valor}</dd>
            </div>
          ))}
        </dl>
        <p style={{ fontSize: 12.5, color: T.inkMuted, marginTop: 8 }}>
          Datos de la Base de Datos Nacional de Subvenciones. Lo que vale es lo que digan las bases oficiales.
        </p>
      </section>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
        {g.bases_url && (
          <a href={g.bases_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: T.gold, fontWeight: 700, textDecoration: 'none' }}>
            Ver bases oficiales →
          </a>
        )}
        {g.sede_url && (
          <a href={g.sede_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: T.gold, fontWeight: 700, textDecoration: 'none' }}>
            Sede electrónica para solicitarla →
          </a>
        )}
      </div>

      {g.abierta && !g.concesionDirecta && (
        <>
          <SolicitudForm codigo={g.codigo_bdns} documentacion={documentacionHabitual()} />
          <RegisterCta text="¿Quieres que te avisemos cuando salgan otras como esta? Crea tu perfil de empresa gratis y te mandamos solo las que encajan." />
        </>
      )}

      <p style={{ fontSize: 13.5, marginTop: 8 }}>
        <Link href={g.nivel1 !== 'ESTATAL' && g.ccaa ? `/ayudas/${ccaaSlug(g.ccaa)}` : '/ayudas'} style={{ color: T.gold, fontWeight: 700, textDecoration: 'none' }}>
          ← Más ayudas abiertas{g.nivel1 !== 'ESTATAL' && g.ccaa ? ` en ${g.ccaa}` : ''}
        </Link>
      </p>
    </PageShell>
  )
}
