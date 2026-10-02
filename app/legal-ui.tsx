import { T, FONT_DISPLAY } from '@/lib/theme'
import { ULTIMA_REVISION } from '@/lib/legal'
import { PageShell } from './ayudas/ui'

// Piezas comunes de las tres páginas legales: aviso legal, privacidad y
// condiciones de tramitación.

export function LegalPage({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <PageShell>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, margin: '0 0 6px' }}>{titulo}</h1>
      <p style={{ fontSize: 13, color: T.inkMuted, margin: '0 0 28px' }}>Última revisión: {ULTIMA_REVISION}.</p>
      <div style={{ fontSize: 15, color: T.inkMid, lineHeight: 1.7, maxWidth: 720 }}>{children}</div>
    </PageShell>
  )
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 700, color: T.ink, margin: '28px 0 8px' }}>{children}</h2>
}

export function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 12px' }}>{children}</p>
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>{children}</ul>
}

export const enlace: React.CSSProperties = { color: T.gold, fontWeight: 700, textDecoration: 'none' }
