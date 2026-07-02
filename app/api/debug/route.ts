import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Prueba end-to-end de Resend. BORRAR luego.
export async function GET() {
  const key = process.env.RESEND_API_KEY
  const from = process.env.DIGEST_FROM
  const to = process.env.LEADS_NOTIFY_EMAIL
  const cfg = { hasKey: !!key, from, to }
  if (!key || !from || !to) return NextResponse.json({ ok: false, cfg, error: 'Falta config' })

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to, subject: '🐾 Prueba DamePerrasPerro',
      html: '<p>¡Guau! Si lees esto, el correo está bien configurado. 🐶</p>',
    }),
  })
  const body = await r.text()
  return NextResponse.json({ ok: r.ok, status: r.status, body, cfg })
}
