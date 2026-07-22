import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        getAll()        { return cookieStore.getAll() },
        setAll(cs: { name: string; value: string; options?: any }[]) { try { cs.forEach(({name,value,options}) => cookieStore.set(name,value,options)) } catch {} },
    }}
  )
}

export function createAdminSupabase() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Cliente anon SIN cookies — para páginas públicas estáticas/ISR (p.ej.
// /ayudas/*) que no deben depender de next/headers para poder generarse
// en build time y revalidarse en segundo plano.
export function createPublicSupabase() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
