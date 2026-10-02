import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { fetchGrantByCode, grantPath } from '@/lib/public-grants'
import { notifyAdmin } from '@/lib/leads-notify'
import { APP_URL } from '@/lib/site'
import { CAMPO_TRAMPA } from '@/lib/campo-trampa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/solicitud → "¿Te la tramitamos?" desde la ficha pública de una
// convocatoria, SIN cuenta.
//
// Hasta ahora pedir una tramitación exigía crear cuenta, completar el perfil de
// empresa, guardar la convocatoria y pulsar "Quiero ayuda": cuatro pasos, y en
// el segundo se quedaban diez de cada quince. Cero leads en meses. Aquí basta
// con nombre, correo o teléfono y aceptar las condiciones.
//
// Se escribe con service_role porque no hay usuario (la RLS de `leads` solo
// deja insertar a uno autenticado). Por eso mismo todo se valida aquí.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const recorta = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))

  // Campo trampa relleno: es un bot. Se le contesta como si hubiera ido bien,
  // para que no aprenda qué le ha delatado, y no se guarda nada.
  if (recorta(b[CAMPO_TRAMPA], 200)) {
    console.warn('[solicitud] descartada por el campo trampa')
    return NextResponse.json({ ok: true })
  }

  const codigo = recorta(b.codigo, 120)
  const nombre = recorta(b.nombre, 120)
  const empresa = recorta(b.empresa, 160)
  const email = recorta(b.email, 160).toLowerCase()
  const telefono = recorta(b.telefono, 40)
  const mensaje = recorta(b.mensaje, 1500)

  if (!nombre) return NextResponse.json({ error: 'Dinos tu nombre.' }, { status: 400 })
  if (!email && !telefono) return NextResponse.json({ error: 'Déjanos un correo o un teléfono para que te contacten.' }, { status: 400 })
  if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Revisa el correo.' }, { status: 400 })
  // El consentimiento se comprueba aquí y no solo en la casilla: el formulario
  // se puede saltar mandando la petición a mano.
  if (b.acepto !== true) return NextResponse.json({ error: 'Tienes que aceptar las condiciones y la política de privacidad.' }, { status: 400 })

  const grant = codigo ? await fetchGrantByCode(codigo) : null
  if (!grant) return NextResponse.json({ error: 'No encontramos esa convocatoria.' }, { status: 404 })
  if (!grant.abierta) return NextResponse.json({ error: 'Esa convocatoria ya está cerrada.' }, { status: 400 })
  // La ficha no enseña el formulario en estas; esto es por si llega a mano.
  if (!grant.paraEmpresas || grant.concesionDirecta) {
    return NextResponse.json({ error: 'Esta convocatoria no es para empresas ni autónomos: no la tramitamos.' }, { status: 400 })
  }

  const sb = createAdminSupabase()

  // La misma persona pidiendo lo mismo dos veces el mismo día: una sola fila.
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const contacto = email ? { contacto_email: email } : { contacto_telefono: telefono }
  const { data: repetida } = await sb
    .from('leads')
    .select('id')
    .eq('codigo_bdns', grant.codigo_bdns)
    .match(contacto)
    .gte('created_at', desde)
    .limit(1)
    .maybeSingle()
  if (repetida) return NextResponse.json({ ok: true, id: repetida.id })

  const lead = {
    user_id: null,
    org_id: null,
    codigo_bdns: grant.codigo_bdns,
    grant_titulo: grant.titulo.slice(0, 300),
    grant_url: `${APP_URL}${grantPath(grant.codigo_bdns)}`,
    fuente: grant.fuente,
    contacto_nombre: nombre,
    contacto_email: email || null,
    contacto_telefono: telefono || null,
    mensaje: [empresa && `Empresa: ${empresa}`, mensaje].filter(Boolean).join('\n\n') || null,
    origen: 'ficha',
  }
  const { data, error } = await sb.from('leads').insert(lead).select('id').single()
  if (error) {
    console.error('[solicitud] insert', error.message)
    return NextResponse.json({ error: 'No se ha podido guardar. Prueba otra vez o escríbenos.' }, { status: 500 })
  }
  await notifyAdmin(lead).catch(() => false)
  return NextResponse.json({ ok: true, id: data.id })
}
