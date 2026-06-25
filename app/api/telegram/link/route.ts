import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerSupabase } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// POST /api/telegram/link → genera un enlace único de vinculación (caduca en 15 min)
export async function POST() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const botUser = process.env.TELEGRAM_BOT_USERNAME
  if (!botUser) return NextResponse.json({ error: 'Falta configurar TELEGRAM_BOT_USERNAME' }, { status: 500 })

  const token = randomUUID().replace(/-/g, '')
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { error } = await supabase.from('telegram_link_tokens')
    .insert({ token, user_id: user.id, expires_at })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ url: `https://t.me/${botUser}?start=${token}` })
}
