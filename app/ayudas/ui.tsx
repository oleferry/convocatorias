import Link from 'next/link'
import { T, FONT, FONT_DISPLAY, daysLeft, urgency } from '@/lib/theme'
import type { PublicGrantCard } from '@/lib/public-grants'

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: FONT, color: T.ink }}>
      <div style={{ background: T.navy, padding: '16px 24px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <span style={{ fontSize: 20 }}>🐾</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 700, color: '#FFF' }}>
              Dame<span style={{ color: T.gold }}>Perras</span>Perro
            </span>
          </Link>
        </div>
      </div>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px 72px' }}>
        {children}
      </div>
    </div>
  )
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <div style={{ fontSize: 12.5, color: T.inkMuted, marginBottom: 18, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'flex', gap: 6 }}>
          {i > 0 && <span>/</span>}
          {it.href ? <Link href={it.href} style={{ color: T.inkLight, textDecoration: 'none' }}>{it.label}</Link> : <span>{it.label}</span>}
        </span>
      ))}
    </div>
  )
}

export function RegisterCta({ text }: { text: string }) {
  return (
    <div style={{
      background: T.goldSoft, border: `1px solid rgba(201,154,61,0.3)`, borderRadius: 12,
      padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      justifyContent: 'space-between', margin: '28px 0',
    }}>
      <p style={{ margin: 0, fontSize: 14, color: T.ink, maxWidth: 480 }}>{text}</p>
      <Link href="/auth" style={{
        padding: '10px 20px', borderRadius: 8, background: T.gold, color: T.inkOnAccent,
        fontWeight: 800, fontSize: 13.5, textDecoration: 'none', whiteSpace: 'nowrap',
      }}>Crear cuenta gratis →</Link>
    </div>
  )
}

function PlazoTag({ fechaFin }: { fechaFin: string | null }) {
  if (!fechaFin) return <span style={{ fontSize: 12, color: T.inkMuted }}>Sin plazo fijo — consulta la web oficial</span>
  const d = daysLeft(fechaFin)
  const u = urgency(d)
  if (d !== null && d < 0) return null
  return <span style={{ fontSize: 12, fontWeight: 700, color: u.color }}>{u.label ? `Cierra en ${u.label}` : `Hasta ${fechaFin}`}</span>
}

export function GrantCard({ grant }: { grant: PublicGrantCard }) {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.ink, lineHeight: 1.35, flex: 1, minWidth: 220 }}>
          {grant.titulo}
        </h3>
        {grant.importe && (
          <span style={{ fontSize: 14, fontWeight: 800, color: T.gold, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            hasta {grant.importe}
          </span>
        )}
      </div>
      {grant.organo && <p style={{ margin: '0 0 8px', fontSize: 13, color: T.inkLight }}>{grant.organo}</p>}
      {grant.finalidad && <p style={{ margin: '0 0 10px', fontSize: 13.5, color: T.inkMid, lineHeight: 1.55 }}>{grant.finalidad}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <PlazoTag fechaFin={grant.fechaFin} />
        {grant.bases_url && (
          <a href={grant.bases_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: T.gold, fontWeight: 700, textDecoration: 'none' }}>
            Ver bases oficiales →
          </a>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ message, backHref, backLabel }: { message: string; backHref: string; backLabel: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 20px', color: T.inkMuted }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>🐾</div>
      <p style={{ fontSize: 14.5, marginBottom: 16 }}>{message}</p>
      <Link href={backHref} style={{ fontSize: 13.5, color: T.gold, fontWeight: 700, textDecoration: 'none' }}>{backLabel} →</Link>
    </div>
  )
}
