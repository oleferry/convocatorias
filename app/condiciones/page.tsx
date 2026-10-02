import type { Metadata } from 'next'
import Link from 'next/link'
import { TITULAR, EMAIL_CONTACTO, dato } from '@/lib/legal'
import { LegalPage, H2, P, UL, enlace } from '../legal-ui'

// Cómo funciona la tramitación y quién cobra qué. Decidido el 02-10-2026: en la
// web no se da porcentaje; se dice que solo se paga si se concede y que la
// gestoría da el porcentaje exacto por escrito antes de empezar.

export const metadata: Metadata = {
  title: 'Condiciones de tramitación',
  description: 'Cómo funciona la tramitación de ayudas con DamePerrasPerro: solo pagas si te la conceden, el presupuesto antes de empezar y cómo gana dinero la web.',
  alternates: { canonical: '/condiciones' },
}

export default function Condiciones() {
  return (
    <LegalPage titulo="Condiciones de tramitación">
      <H2>Lo que es gratis</H2>
      <P>
        Buscar ayudas, ver las fichas, crear una cuenta, recibir el resumen semanal y los avisos de
        plazo. Todo eso es gratis y no te compromete a nada.
      </P>

      <H2>Cómo funciona la tramitación</H2>
      <UL>
        <li>
          <strong>Nos dices qué convocatoria te interesa</strong>, desde su ficha o desde tu cuenta.
        </li>
        <li>
          <strong>Te ponemos en contacto con una gestoría colaboradora</strong>, que es quien
          tramita. DamePerrasPerro no presenta solicitudes ni hace de asesor: busca las ayudas y te
          pone con quien las tramita.
        </li>
        <li>
          <strong>La gestoría te llama o te escribe</strong>, mira si cumples los requisitos y te da
          un presupuesto por escrito, con el porcentaje de sus honorarios,{' '}
          <strong>antes de empezar</strong>.
        </li>
        <li>
          <strong>Solo si lo aceptas</strong>, la gestoría se pone a trabajar. El encargo es entre tú
          y ella. Si no te convence, lo dejas ahí y no pagas nada.
        </li>
      </UL>

      <H2>Cuánto cuesta</H2>
      <P>
        <strong>Solo pagas si te la conceden.</strong> Los honorarios de la gestoría son un porcentaje
        de lo que te concedan; si la ayuda no sale, no pagas honorarios. El porcentaje exacto, si lleva
        IVA y cuándo se factura vienen en el presupuesto que te da la gestoría antes de empezar.
      </P>

      <H2>Cómo gana dinero DamePerrasPerro</H2>
      <P>
        La gestoría comparte con nosotros una parte de sus honorarios cuando la ayuda sale.{' '}
        <strong>A ti no te cuesta más</strong>: pagas lo mismo que si hubieras ido directamente a
        ella. Si no sale, no cobra nadie.
      </P>

      <H2>Lo que no podemos prometer</H2>
      <P>
        La concesión la decide la administración o la entidad que convoca, no nosotros ni la gestoría.
        Una solicitud bien hecha puede no salir por falta de presupuesto, por la puntuación de otras
        solicitudes o por cambios en la convocatoria.
      </P>

      <H2>Tus datos</H2>
      <P>
        Para ponerte en contacto, le pasamos a la gestoría los datos que nos das en la petición. Todo
        lo demás está en la <Link href="/privacidad" style={enlace}>política de privacidad</Link>.
      </P>

      <H2>Quién está detrás</H2>
      <P>
        {dato(TITULAR.razonSocial)}, NIF {dato(TITULAR.nif)}. Para cualquier duda:{' '}
        <a href={`mailto:${EMAIL_CONTACTO}`} style={enlace}>{EMAIL_CONTACTO}</a>. Más en el{' '}
        <Link href="/aviso-legal" style={enlace}>aviso legal</Link>.
      </P>
    </LegalPage>
  )
}
