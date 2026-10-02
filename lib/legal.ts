// Quién está detrás de DamePerrasPerro, en un solo sitio.
//
// Lo leen el aviso legal, la política de privacidad, las condiciones de
// tramitación y los datos estructurados. La LSSI (art. 10) obliga a que
// cualquier web con actividad económica diga quién es su titular, con razón
// social, NIF y domicilio; el RGPD (art. 13) obliga a decirlo en el momento en
// que se recogen datos. Hasta octubre de 2026 la web no lo decía en ningún sitio.
//
// MIENTRAS ESTOS TRES CAMPOS ESTÉN VACÍOS, EL DESPLIEGUE A PRODUCCIÓN FALLA
// (ver `comprobarTitular` abajo). Es a propósito: una página legal sin titular
// es peor que no tenerla, porque aparenta cumplir. Las vistas previas sí
// compilan, con el hueco marcado, para poder revisar el resto.

export const TITULAR = {
  /** Razón social exacta, como figura en el Registro Mercantil. */
  razonSocial: '',
  /** NIF de la sociedad. */
  nif: '',
  /** Domicilio social completo. */
  domicilio: '',
  /** Datos registrales, si los hay (tomo, folio, hoja). Opcional. */
  registro: '',
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
      'lib/legal.ts: falta la razón social, el NIF o el domicilio del titular. ' +
        'No se publica una página legal sin titular.',
    )
  }
})()
