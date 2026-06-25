import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Recoge el retorno de la confirmación de email / enlaces mágicos de Supabase.
// Soporta los dos flujos: PKCE (?code=...) y verificación por token (?token_hash=&type=).
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = url.searchParams.get('next') || '/dashboard'

  const supabase = createServerSupabase()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }

  // Si algo falla, al login con aviso (la cuenta puede haber quedado verificada igualmente).
  return NextResponse.redirect(new URL('/auth?confirmado=0', url.origin))
}
