export type TipoEntidad = 'pyme'|'autonomo'|'gran_empresa'|'asociacion'|'fundacion'|'cooperativa'|'otro'
export type GrantStatus = 'pendiente'|'revisada'|'en_proceso'|'presentada'|'resuelta_positiva'|'resuelta_negativa'|'descartada'
export type GrantTipo   = 'publica'|'concurso'|'privada'|'europeo'
export type GrantAmbito = 'local'|'autonómico'|'nacional'|'europeo'|'internacional'
export type OrgRole     = 'owner'|'editor'|'viewer'

export interface Organization {
  id: string
  user_id: string
  name: string
  tipo_entidad: TipoEntidad
  ccaa: string
  municipio?: string
  cnae?: string
  cnae_desc?: string
  iae?: string
  iae_desc?: string
  empleados?: number
  facturacion?: string
  anio_constitucion?: number
  actividad?: string
  keywords?: string
  color: string
  emoji: string
  is_default: boolean
  is_archived: boolean
  created_at: string
}

export interface Grant {
  id: string
  user_id: string
  org_id?: string
  titulo: string
  organismo?: string
  tipo: GrantTipo
  ambito: GrantAmbito
  importe_max?: string
  importe_min?: string
  cofinanciacion?: string
  plazo_solicitud?: string
  plazo_ejecucion?: string
  fecha_publicacion?: string
  resumen?: string
  requisitos?: string
  documentacion?: string
  url?: string
  url_bases?: string
  elegibilidad?: string
  status: GrantStatus
  prioridad: 1|2|3
  tags?: string[]
  notas?: string
  resultado_importe?: string
  resultado_fecha?: string
  resultado_notas?: string
  source: string
  auto_found: boolean
  match_score?: number
  match_reason?: string
  created_at: string
  updated_at: string
}

// Paleta alineada con el diseño de referencia (lib/theme.ts → T)
export const STATUS_META: Record<GrantStatus, { label: string; color: string; bg: string; icon: string }> = {
  pendiente:          { label:'Pendiente',          color:'#D97706', bg:'#FEF3C7',  icon:'⏳' },
  revisada:           { label:'Revisada',           color:'#1C2B3A', bg:'#EFF3F7',  icon:'👁' },
  en_proceso:         { label:'En proceso',         color:'#7C3AED', bg:'#EDE9FE',  icon:'⚙️' },
  presentada:         { label:'Presentada',         color:'#059669', bg:'#D1FAE5',  icon:'✅' },
  resuelta_positiva:  { label:'Concedida 🎉',       color:'#059669', bg:'#BBF7D0',  icon:'🏆' },
  resuelta_negativa:  { label:'Denegada',           color:'#DC2626', bg:'#FEE2E2',  icon:'❌' },
  descartada:         { label:'Descartada',         color:'#9CA3AF', bg:'#F3F4F6',  icon:'✗'  },
}

export const TYPE_META: Record<GrantTipo, { label: string; icon: string }> = {
  publica:  { label:'Subvención pública',       icon:'🏛️' },
  concurso: { label:'Concurso / Premio',         icon:'🏆' },
  privada:  { label:'Ayuda privada',             icon:'🤝' },
  europeo:  { label:'Fondo europeo',             icon:'🇪🇺' },
}

export const CCAA = [
  'Andalucía','Aragón','Asturias','Baleares','Canarias','Cantabria',
  'Castilla-La Mancha','Castilla y León','Cataluña','Extremadura','Galicia',
  'La Rioja','Madrid','Murcia','Navarra','País Vasco','Valencia','Ceuta','Melilla',
]

export const TIPO_ENTIDAD_META: Record<TipoEntidad, string> = {
  pyme:         'Pyme (1–49 empleados)',
  autonomo:     'Autónomo / Freelance',
  gran_empresa: 'Gran empresa (250+)',
  asociacion:   'Asociación',
  fundacion:    'Fundación',
  cooperativa:  'Cooperativa',
  otro:         'Otro',
}

export const ORG_COLORS = [
  '#1B2A4A','#1A6B3A','#6B3FA0','#D4820A','#C0392B',
  '#2E86AB','#E67E22','#16A085','#8E44AD','#2C3E50',
]
