// ─── DESIGN TOKENS · DamePerrasPerro ──────────────────────────────────────────
// "El perro que encuentra las perras." Marca: directa, canalla, clara, útil.
// Paleta oficial del kit: negro tinta + oro + papel crema + verde éxito + rojo urgencia.
export const T = {
  // Fondos
  bg:        '#F8F4EC',   // papel crema (kit)
  bgCard:    '#FFFFFF',
  bgSidebar: '#121212',   // negro primario (kit)

  // Texto
  ink:       '#121212',
  inkMid:    '#3A3A3A',
  inkLight:  '#6B7280',
  inkMuted:  '#9CA3AF',

  // Acento de marca — ORO (secundario del kit, color de acción principal)
  gold:      '#E6A800',
  goldSoft:  '#FBEFC9',

  // Éxito — verde (kit)
  green:     '#2BA84A',
  greenSoft: '#DDF3E2',
  greenDim:  '#176B2E',

  // Urgencia — rojo (kit)
  red:       '#D62828',
  redSoft:   '#FBE2E2',

  // Compat: "amber" se reasigna al oro de marca (acento en formularios)
  amber:     '#E6A800',
  amberSoft: '#FBEFC9',

  // "navy" se reasigna al negro de marca (cabeceras/botones oscuros)
  navy:      '#121212',
  navySoft:  '#EFEBE0',

  // Púrpura IA (se mantiene para señalar "IA")
  purple:    '#7C3AED',
  purpleSoft:'#EDE9FE',

  // Bordes
  border:    '#E7E2D6',
  borderMid: '#D8D2C4',
} as const

export const FONT = "'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
// Títulos y logotipo del kit
export const FONT_DISPLAY = "'Bricolage Grotesque', 'Inter', -apple-system, 'Segoe UI', sans-serif"

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
  if (days <= 21)    return { color: T.gold,     label: `${days}d`,  tier: 2 }
  return               { color: T.green,    label: `${days}d`,  tier: 1 }
}
