import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import Landing from './Landing'

export default async function Home() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return <Landing />
}
