import { NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase-server'
import { isAdminEmail } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** Usuarios distintos que han disparado un evento. */
async function usuariosCon(sb: any, nombre: string): Promise<Set<string>> {
  const s = new Set<string>()
  const { data } = await sb.from('eventos').select('user_id').eq('nombre', nombre).not('user_id', 'is', null)
  for (const r of (data || [])) s.add(r.user_id)
  return s
}

/** Usuarios distintos con al menos una fila en una tabla. */
async function usuariosEn(sb: any, tabla: string): Promise<Set<string>> {
  const s = new Set<string>()
  const { data } = await sb.from(tabla).select('user_id').not('user_id', 'is', null)
  for (const r of (data || [])) s.add(r.user_id)
  return s
}

// GET /api/admin/embudo → embudo de activación (solo admin).
export async function GET() {
  const { data: { user } } = await createServerSupabase().auth.getUser()
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const sb = createAdminSupabase()

  const { data: authData, error: authErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
  const usuarios = authData?.users || []
  const confirmados = usuarios.filter((u: any) => u.email_confirmed_at)

  const [conPerfil, conAyuda, abrieronFicha, abrieronTramitar, enviaronTramitar] = await Promise.all([
    usuariosEn(sb, 'organizations'),
    usuariosEn(sb, 'grants'),
    usuariosCon(sb, 'ficha_abierta'),
    usuariosCon(sb, 'tramitar_abierto'),
    usuariosCon(sb, 'tramitar_enviado'),
  ])

  const { count: leads } = await sb.from('leads').select('id', { count: 'exact', head: true })

  // Los eventos empezaron a registrarse el día que se desplegó esta medición;
  // el panel lo dice para que un cero de "abrió ficha" no se lea como abandono.
  const { data: primerEvento } = await sb.from('eventos')
    .select('created_at').order('created_at').limit(1).maybeSingle()

  const pasos = [
    { paso: 'Se registran', n: usuarios.length, fuente: 'auth.users' },
    { paso: 'Confirman el email', n: confirmados.length, fuente: 'auth.users' },
    { paso: 'Crean perfil de empresa', n: conPerfil.size, fuente: 'organizations' },
    { paso: 'Guardan alguna ayuda', n: conAyuda.size, fuente: 'grants' },
    { paso: 'Abren una ficha', n: abrieronFicha.size, fuente: 'eventos' },
    { paso: 'Abren “que me la tramiten”', n: abrieronTramitar.size, fuente: 'eventos' },
    { paso: 'Envían la solicitud', n: enviaronTramitar.size, fuente: 'eventos' },
  ]

  // Altas por semana: dice si el problema es que no entra nadie o que entra y
  // no activa. Son dos problemas distintos con soluciones distintas.
  const porSemana: Record<string, number> = {}
  for (const u of usuarios) {
    const d = new Date(u.created_at)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)) // lunes de esa semana
    porSemana[d.toISOString().slice(0, 10)] = (porSemana[d.toISOString().slice(0, 10)] || 0) + 1
  }

  // Sin confirmar, con fecha: si se agrupan en un día concreto, no es desinterés
  // sino un email que no salió.
  const sinConfirmar = usuarios.filter((u: any) => !u.email_confirmed_at)
    .map((u: any) => ({ email: u.email, alta: u.created_at }))
    .sort((a: any, b: any) => a.alta < b.alta ? 1 : -1)

  return NextResponse.json({
    pasos,
    leads: leads || 0,
    porSemana,
    sinConfirmar,
    eventosDesde: primerEvento?.created_at || null,
  })
}
