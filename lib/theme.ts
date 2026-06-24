// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// Concepto: "Expediente digital" — el rigor de lo oficial con la claridad de lo moderno.
// Paleta: papel crudo + tinta profunda + verde oportunidad + ámbar urgencia.
// Fuente única de verdad para el diseño (ver diseno-referencia.jsx).
export const T = {
  // Fondos
  bg:        '#F7F5F0',   // papel crudo
  bgCard:    '#FFFFFF',
  bgSidebar: '#1C2B3A',   // tinta noche

  // Texto
  ink:       '#111827',
  inkMid:    '#374151',
  inkLight:  '#6B7280',
  inkMuted:  '#9CA3AF',

  // Acento primario — verde señal (oportunidad)
  green:     '#059669',
  greenSoft: '#D1FAE5',
  greenDim:  '#064E3B',

  // Acento urgencia
  amber:     '#D97706',
  amberSoft: '#FEF3C7',

  // Acento peligro
  red:       '#DC2626',
  redSoft:   '#FEE2E2',

  // Acento neutral/marino (marca)
  navy:      '#1C2B3A',
  navySoft:  '#EFF3F7',

  // Púrpura IA
  purple:    '#7C3AED',
  purpleSoft:'#EDE9FE',

  // Bordes
  border:    '#E5E7EB',
  borderMid: '#D1D5DB',
} as const

export const FONT = "'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

// ─── URGENCY SYSTEM ───────────────────────────────────────────────────────────
export function daysLeft(d?: string | null): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

export interface Urgency { color: string; label: string | null; tier: number }

export function urgency(days: number | null): Urgency {
  if (days === null) return { color: T.inkMuted, label: null,        tier: 0 }
  if (days < 0)      return { color: T.inkMuted, label: 'Vencida',   tier: -1 }
  if (days === 0)    return { color: T.red,      label: '¡Hoy!',     tier: 4 }
  if (days <= 7)     return { color: T.red,      label: `${days}d`,  tier: 3 }
  if (days <= 21)    return { color: T.amber,    label: `${days}d`,  tier: 2 }
  return               { color: T.green,    label: `${days}d`,  tier: 1 }
}
