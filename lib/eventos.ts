// Eventos de producto. Lista compartida entre el cliente (que los envía) y la
// ruta /api/track (que los valida), para que no se cuelen nombres inventados.
//
// Solo van aquí las acciones que no dejan rastro en ninguna tabla. El resto del
// embudo —altas, emails confirmados, perfiles, leads— ya se cuenta desde
// auth.users, organizations y leads, y encima de forma retroactiva.
export const EVENTOS = [
  'ficha_abierta',      // ha abierto el detalle de una convocatoria
  'tramitar_abierto',   // ha abierto el formulario "quiero que me la tramiten"
  'tramitar_enviado',   // lo ha enviado de verdad (el hueco entre ambos es el que importa)
] as const

export type Evento = typeof EVENTOS[number]

/** Manda un evento sin bloquear ni romper nada. Solo cliente. */
export function track(nombre: Evento, props: Record<string, string | number | boolean> = {}) {
  try {
    const body = JSON.stringify({ nombre, props })
    // sendBeacon sobrevive a que la página se cierre justo después del clic;
    // fetch es el plan B cuando el navegador no lo soporta.
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
    }
  } catch { /* medir nunca puede romper la app */ }
}
