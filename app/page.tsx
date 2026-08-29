import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import Landing from './Landing'

// Solo el canonical: el titulo y la descripcion se heredan del layout.
//
// No puede ir en el layout: alli lo heredarian todas las paginas que no pongan
// el suyo, y las 326 de /ayudas acabarian declarando que son la portada. Eso es
// peor que no tener ninguno.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default async function Home() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return <Landing />
}
