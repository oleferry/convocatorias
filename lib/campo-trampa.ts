/**
 * Nombre del campo trampa de los formularios públicos. Va oculto: una persona
 * no lo ve ni llega a él con el tabulador, así que siempre llega vacío. Los
 * bots que rellenan todos los campos que encuentran, no.
 *
 * El nombre es a propósito uno que el autocompletado del navegador no
 * reconoce: con «website» o «url» podría rellenarlo solo y dejar fuera a una
 * persona. Mismo mecanismo que en Camionisto, donde siete de doce cuentas de
 * empresa eran altas de bots.
 */
export const CAMPO_TRAMPA = 'referencia_interna'
