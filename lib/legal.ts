// Quién está detrás de DamePerrasPerro, en un solo sitio.
//
// Lo leen el aviso legal, la política de privacidad, las condiciones de
// tramitación y los datos estructurados. La LSSI (art. 10) obliga a que
// cualquier web con actividad económica diga quién es su titular, con nombre
// o razón social, NIF y domicilio; el RGPD (art. 13) obliga a decirlo en el momento en
// que se recogen datos. Hasta octubre de 2026 la web no lo decía en ningún sitio.
//
// MIENTRAS ESTOS TRES CAMPOS ESTÉN VACÍOS, EL DESPLIEGUE A PRODUCCIÓN FALLA
// (ver `comprobarTitular` abajo). Es a propósito: una página legal sin titular
// es peor que no tenerla, porque aparenta cumplir. Las vistas previas sí
// compilan, con el hueco marcado, para poder revisar el resto.

// Confirmado por el negocio el 02-10-2026. La titular es una persona física,
// no una sociedad: por eso no hay datos registrales, y por eso su NIF va solo
// donde la ley lo exige (aviso legal, privacidad, condiciones) y no en los
// datos estructurados ni en ningún otro sitio.
export const TITULAR = {
  /** Nombre completo de la persona titular, o razón social si fuera una sociedad. */
  razonSocial: 'María Vega Blanco',
  /** NIF. */
  nif: '44915639C',
  /** Domicilio completo. */
  domicilio: 'Calle Cipriano Polo García, 14, 47680 Mayorga (Valladolid)',
  /** Datos registrales, solo si es una sociedad (tomo, folio, hoja). */
  registro: '',
  /** true si es una persona física. */
  personaFisica: true,
}

/** Correo de contacto y para ejercer derechos de protección de datos. */
export const EMAIL_CONTACTO = 'perro@dameperrasperro.es'

/** Fecha de la última revisión de los textos legales. */
export const ULTIMA_REVISION = 'octubre de 2026'

export const PENDIENTE = '⚠ PENDIENTE DE RELLENAR EN lib/legal.ts'

/** Un dato del titular, o el aviso de pendiente en las vistas previas. */
export function dato(valor: string): string {
  return valor.trim() || PENDIENTE
}

export function titularCompleto(): boolean {
  return Boolean(TITULAR.razonSocial.trim() && TITULAR.nif.trim() && TITULAR.domicilio.trim())
}

// Se evalúa al importar el módulo, es decir, al compilar cualquier página que
// lo use. En producción (Vercel) sin titular, el build se para aquí.
;(function comprobarTitular() {
  if (process.env.VERCEL_ENV === 'production' && !titularCompleto()) {
    throw new Error(
      'lib/legal.ts: falta el nombre o razón social, el NIF o el domicilio del titular. ' +
        'No se publica una página legal sin titular.',
    )
  }
})()
