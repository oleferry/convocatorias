// ─── DESIGN TOKENS · DamePerrasPerro ──────────────────────────────────────────
// "El perro que encuentra las perras." Dirección "Rastro": fondo pino oscuro,
// latón mate como acento, menta-bosque para éxito, ladrillo para urgencia.
// Nada de crema/dorado brillante/serif — ver brand-directions (dirección B).
export const T = {
  // Fondos — pino oscuro
  bg:        '#12312A',
  bgCard:    '#1B4238',
  bgSidebar: '#0B211B',   // más oscuro que el resto: chrome/sidebar

  // Texto — claro sobre fondo oscuro
  ink:       '#F1EFE6',
  inkMid:    '#C9C6B8',
  inkLight:  '#9CA79E',
  inkMuted:  '#728077',

  // Texto oscuro para usar SOBRE superficies de acento sólidas (botones dorados)
  inkOnAccent: '#1A1305',

  // Acento de marca — latón/mostaza mate (no dorado brillante)
  gold:      '#C99A3D',
  goldSoft:  'rgba(201,154,61,0.18)',

  // Éxito — menta-bosque
  green:     '#6FBE8E',
  greenSoft: 'rgba(111,190,142,0.18)',
  greenDim:  '#2F5D45',

  // Urgencia — ladrillo/terracota (semántico, distinto del acento)
  red:       '#D9714F',
  redSoft:   'rgba(217,113,79,0.18)',

  // Compat: "amber" se reasigna al mismo acento
  amber:     '#C99A3D',
  amberSoft: 'rgba(201,154,61,0.18)',

  // "navy" = superficie oscura de chrome (cabeceras, botones secundarios) —
  // YA NO es el mismo valor que "ink" (que ahora es claro). Solo usar como
  // fondo, nunca como color de texto (ver inkOnAccent / gold para eso).
  navy:      '#0F2921',
  navySoft:  'rgba(15,41,33,0.4)',

  // Púrpura IA (aclarado para contraste sobre fondo oscuro)
  purple:    '#A78BFA',
  purpleSoft:'rgba(167,139,250,0.18)',

  // Bordes
  border:    'rgba(241,239,230,0.14)',
  borderMid: 'rgba(241,239,230,0.24)',
} as const

export const FONT = "'Barlow', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
export const FONT_DISPLAY = "'Barlow Condensed', 'Barlow', -apple-system, 'Segoe UI', sans-serif"

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
