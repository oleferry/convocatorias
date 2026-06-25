// ================================================================
//  Worker combinado (entrypoint de Railway)
//   • Ingesta BDNS → catálogo:  diaria  06:00 Europe/Madrid
//   • Digest semanal (TG+email): lunes  08:00 Europe/Madrid
//  Arranca con una ingesta inicial para tener catálogo cuanto antes.
// ================================================================

const cron = require('node-cron')
const { runOnce } = require('./ingest-bdns')
const { runDigest } = require('./digest')

const TZ = { timezone: 'Europe/Madrid' }

console.log('🛠️  Worker de Convocatorias en marcha.')
console.log('    · Ingesta BDNS: diaria 06:00')
console.log('    · Digest semanal: lunes 08:00')

cron.schedule('0 6 * * *', () => runOnce().catch(e => console.error('[ingest]', e)), TZ)
cron.schedule('0 8 * * 1', () => runDigest().catch(e => console.error('[digest]', e)), TZ)

// Ingesta inicial al desplegar (sin bloquear el arranque del cron)
runOnce().catch(e => console.error('[ingest:boot]', e))
