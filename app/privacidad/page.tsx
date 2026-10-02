import type { Metadata } from 'next'
import Link from 'next/link'
import { TITULAR, EMAIL_CONTACTO, dato } from '@/lib/legal'
import { LegalPage, H2, P, UL, enlace } from '../legal-ui'

// Cada apartado describe lo que el código hace de verdad (revisado en octubre
// de 2026): qué tablas guardan qué, a qué proveedores sale cada dato y qué se
// manda a la IA. Si cambia el código, cambia esto.

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos trata DamePerrasPerro, para qué, con quién los comparte y cómo ejercer tus derechos.',
  alternates: { canonical: '/privacidad' },
}

export default function Privacidad() {
  return (
    <LegalPage titulo="Política de privacidad">
      <H2>Responsable</H2>
      <P>
        <strong>{dato(TITULAR.razonSocial)}</strong>, NIF {dato(TITULAR.nif)}, con domicilio en{' '}
        {dato(TITULAR.domicilio)}. Para cualquier cosa sobre tus datos:{' '}
        <a href={`mailto:${EMAIL_CONTACTO}`} style={enlace}>{EMAIL_CONTACTO}</a>.
      </P>

      <H2>Qué datos tratamos, para qué y por qué podemos</H2>
      <P><strong>Si consultas la web sin cuenta</strong></P>
      <UL>
        <li>
          Estadísticas agregadas de visitas (páginas vistas, país, tipo de dispositivo) con Vercel
          Web Analytics, que no usa cookies ni identifica a nadie. Base: interés legítimo en saber qué
          páginas se usan.
        </li>
      </UL>

      <P><strong>Si pides que te tramitemos una convocatoria</strong></P>
      <UL>
        <li>
          Nombre, empresa, correo, teléfono, la convocatoria que te interesa y lo que nos cuentes en
          el mensaje. Los usamos para ponerte en contacto con una gestoría colaboradora que te la
          tramite, y se los pasamos a ella para eso. Base: tu propia petición, como paso previo a un
          contrato (art. 6.1.b del RGPD).
        </li>
      </UL>

      <P><strong>Si creas una cuenta</strong></P>
      <UL>
        <li>Correo y contraseña (guardada cifrada), para entrar. Base: el contrato del servicio.</li>
        <li>
          El perfil de tu empresa (nombre, tipo de entidad, CNAE o IAE, comunidad, provincia,
          municipio, actividad, número de empleados), las convocatorias que guardas y su estado. Es
          lo que permite cruzar las ayudas con tu empresa. Base: el contrato del servicio.
        </li>
        <li>
          El resumen semanal por correo con las ayudas que encajan, y los avisos de plazo. Forman
          parte del servicio; puedes dejar de recibirlos cuando quieras.
        </li>
        <li>
          Si conectas Telegram, tu identificador de Telegram, para mandarte los avisos por ahí.
        </li>
        <li>
          Qué fichas abres y si abres el formulario de tramitación, asociado a tu cuenta, para saber
          dónde se atasca la gente y mejorar el servicio. Base: interés legítimo.
        </li>
      </UL>

      <P><strong>Si eres una gestoría y nos escribes desde la portada</strong></P>
      <UL>
        <li>
          Nombre, despacho, correo, teléfono, zona y mensaje, para contestarte. Base: tu petición.
        </li>
      </UL>

      <H2>Inteligencia artificial</H2>
      <P>
        Cuando pides un resumen de unas bases, un borrador de memoria o una búsqueda de ayudas para tu
        perfil, se envían a Anthropic (proveedor del modelo Claude) los datos de la convocatoria y los
        del perfil de tu empresa que hagan falta. No se usan para decidir nada sobre ti de forma
        automática: el resultado es un texto que lees tú.
      </P>

      <H2>Con quién se comparten</H2>
      <UL>
        <li>
          <strong>Gestorías colaboradoras</strong>, solo cuando pides que te tramitemos una
          convocatoria, y solo los datos de esa petición.
        </li>
        <li>
          Proveedores que prestan el servicio por cuenta nuestra y no pueden usar los datos para otra
          cosa: Supabase (base de datos y acceso), Vercel (alojamiento de la web y estadísticas),
          Resend (envío de correos), Railway (el bot de Telegram), Telegram (si lo conectas) y
          Anthropic (la IA).
        </li>
        <li>
          Varios de ellos están en Estados Unidos. Las transferencias se amparan en el Marco de
          Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo de la Comisión Europea.
        </li>
        <li>
          Las tipografías de la web se cargan desde Google Fonts, así que tu navegador se conecta a
          servidores de Google, que reciben tu dirección IP.
        </li>
      </UL>
      <P>No vendemos datos ni los usamos para publicidad.</P>

      <H2>Cuánto tiempo los guardamos</H2>
      <UL>
        <li>Los de la cuenta y el perfil, mientras la cuenta exista. Si nos pides borrarla, se borran.</li>
        <li>
          Las peticiones de tramitación y los contactos de gestorías, mientras haya relación y, si no
          sigue adelante, hasta dos años después del último contacto.
        </li>
        <li>Después, solo lo que obligue a guardar la ley, y bloqueado.</li>
      </UL>

      <H2>Cookies</H2>
      <P>
        Solo las necesarias para que funcione el acceso a tu cuenta. No hay cookies de publicidad ni
        de analítica, por eso no hay banner pidiendo permiso.
      </P>

      <H2>Tus derechos</H2>
      <P>
        Puedes pedir acceder a tus datos, corregirlos, borrarlos, llevártelos, limitar su uso u
        oponerte a él escribiendo a{' '}
        <a href={`mailto:${EMAIL_CONTACTO}`} style={enlace}>{EMAIL_CONTACTO}</a>. Si crees que no los
        hemos tratado bien, puedes reclamar ante la Agencia Española de Protección de Datos
        (aepd.es).
      </P>

      <P>
        Más sobre quién está detrás en el <Link href="/aviso-legal" style={enlace}>aviso legal</Link>,
        y sobre la tramitación en las <Link href="/condiciones" style={enlace}>condiciones</Link>.
      </P>
    </LegalPage>
  )
}
