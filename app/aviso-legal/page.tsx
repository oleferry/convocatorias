import type { Metadata } from 'next'
import Link from 'next/link'
import { TITULAR, EMAIL_CONTACTO, dato } from '@/lib/legal'
import { LegalPage, H2, P, UL, enlace } from '../legal-ui'

export const metadata: Metadata = {
  title: 'Aviso legal',
  description: 'Quién está detrás de DamePerrasPerro, de dónde salen los datos de las convocatorias y qué responsabilidad asume la web.',
  alternates: { canonical: '/aviso-legal' },
}

export default function AvisoLegal() {
  return (
    <LegalPage titulo="Aviso legal">
      <H2>Quién es el titular</H2>
      <P>
        En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la
        información y de comercio electrónico, el titular de dameperrasperro.es es:
      </P>
      <UL>
        <li>Razón social: <strong>{dato(TITULAR.razonSocial)}</strong></li>
        <li>NIF: <strong>{dato(TITULAR.nif)}</strong></li>
        <li>Domicilio: {dato(TITULAR.domicilio)}</li>
        {TITULAR.registro.trim() && <li>Datos registrales: {TITULAR.registro}</li>}
        <li>Correo electrónico: <a href={`mailto:${EMAIL_CONTACTO}`} style={enlace}>{EMAIL_CONTACTO}</a></li>
      </UL>

      <H2>Qué es DamePerrasPerro</H2>
      <P>
        Un servicio que reúne convocatorias de ayudas y subvenciones públicas y privadas, las cruza
        con el perfil de cada empresa y avisa de las que encajan. Buscar, consultar las fichas y
        recibir avisos es gratis.
      </P>
      <P>
        Quien lo pide puede además ponerse en contacto con una gestoría colaboradora para que le
        tramite una convocatoria. Cómo funciona eso, y quién cobra qué, está en las{' '}
        <Link href="/condiciones" style={enlace}>condiciones de tramitación</Link>.
      </P>

      <H2>De dónde salen los datos de las convocatorias</H2>
      <P>
        La mayoría vienen de la Base de Datos Nacional de Subvenciones (BDNS), que publica el
        Ministerio de Hacienda, y se reutilizan como información del sector público. Otras salen de
        portales de fondos europeos y de las webs de las entidades privadas que convocan.
      </P>
      <P>
        <strong>DamePerrasPerro no es un organismo oficial</strong> ni actúa en nombre de ninguna
        administración. Los resúmenes de las convocatorias se generan de forma automática, también
        con inteligencia artificial, y pueden contener errores u omisiones. Lo que vale es siempre lo
        que digan las bases oficiales, que se enlazan en cada ficha: compruébalas antes de presentar
        nada.
      </P>

      <H2>Responsabilidad</H2>
      <P>
        La web informa de que una convocatoria existe y de a quién parece dirigirse, pero no asegura
        que una empresa concreta cumpla los requisitos ni que se le vaya a conceder. La concesión la
        decide la administración o la entidad que convoca.
      </P>
      <P>
        DamePerrasPerro no responde de los contenidos de las webs externas a las que enlaza, ni de
        las interrupciones del servicio por causas técnicas o ajenas.
      </P>

      <H2>Propiedad intelectual</H2>
      <P>
        El diseño, la marca, el logotipo y los textos propios de la web pertenecen a su titular. Los
        datos de las convocatorias pertenecen a quien los publica.
      </P>

      <H2>Datos personales</H2>
      <P>
        Qué datos se tratan, para qué y cómo ejercer tus derechos está en la{' '}
        <Link href="/privacidad" style={enlace}>política de privacidad</Link>.
      </P>

      <H2>Ley aplicable</H2>
      <P>Este aviso se rige por la legislación española.</P>
    </LegalPage>
  )
}
