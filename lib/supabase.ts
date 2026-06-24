import { createBrowserClient } from '@supabase/ssr'

// Las variables NEXT_PUBLIC_* se inyectan en tiempo de build. Usamos valores de
// reserva para que `next build` no falle al prerenderizar sin credenciales; en
// producción (Vercel) las variables reales están presentes y se inyectan.
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
  )
