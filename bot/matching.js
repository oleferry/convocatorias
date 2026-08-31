// ================================================================
//  Matching por reglas (espejo CommonJS de lib/matching.ts) — v2
//  Mantener sincronizado con lib/matching.ts y lib/geo.ts.
// ================================================================
const provincias = require('./data/provincias.json')

function strip(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normKey(s) {
  return strip(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).sort().join('-')
}
const PROVINCIA_BY_KEY = new Map(provincias.map(p => [normKey(p.n), p]))
function provinciaFromName(name) {
  const p = PROVINCIA_BY_KEY.get(normKey(name))
  return p ? { provincia: p.n, ccaa: p.ccaa } : null
}

// Alcance geográfico real por NUTS de `regiones` (espejo de lib/geo.ts).
function regionScopeFromRegiones(regiones) {
  const list = (regiones || []).filter(Boolean)
  if (!list.length) return { wide: true, provincias: [] }
  const provs = []
  for (const r of list) {
    const m = /^(ES\d*)\s*-\s*(.+)$/i.exec(r.trim())
    const code = m ? m[1] : r.trim()
    const digits = (/^ES(\d*)/i.exec(code) || [])[1]?.length || 0
    if (digits <= 2) return { wide: true, provincias: [] }
    if (m) { const g = provinciaFromName(m[2]); if (g) provs.push(g.provincia) }
  }
  return { wide: provs.length === 0, provincias: [...new Set(provs)] }
}

function tokens(s) {
  return strip(s || '').split(/[^a-z0-9+]+/).filter(t => t.length >= 4)
}

const STOP_TOKENS = new Set([
  // Vocabulario administrativo de convocatorias
  'comercio', 'menor', 'mayor', 'establecimientos', 'especializados', 'productos',
  'otros', 'otras', 'actividad', 'actividades', 'servicios', 'empresa', 'empresas',
  'general', 'varios', 'diversos', 'proyecto', 'proyectos', 'programa', 'programas',
  'ayuda', 'ayudas', 'subvencion', 'subvenciones', 'convocatoria', 'concesion',
  'entidad', 'entidades', 'beneficiarios', 'solicitud', 'solicitudes', 'gastos',
  'importe', 'plazo', 'anual', 'anuales', 'nacional', 'regional', 'local',
  // Prosa comercial y relleno
  'nuestro', 'nuestra', 'nuestros', 'nuestras', 'ofrecemos', 'trabajamos', 'donde',
  'cada', 'todos', 'todas', 'puede', 'pueden', 'desde', 'hasta', 'entre', 'sobre',
  'para', 'como', 'este', 'esta', 'estos', 'estas', 'through', 'traves',
  'calidad', 'excelencia', 'innovacion', 'desarrollo', 'mejora', 'apoyo', 'fomento',
  'impulso', 'promocion', 'gestion', 'trabajo', 'equipo', 'equipos', 'personas',
  'profesional', 'profesionales', 'sector', 'sectores', 'ambito', 'nivel',
  'oportunidad', 'oportunidades', 'experiencia', 'compromiso', 'dedicacion',
  'entorno', 'seguro', 'juego', 'creatividad', 'bienestar', 'familias', 'ritmo',
  'crecer', 'aprender', 'descubrir', 'compartir', 'disfrutar', 'acompanamiento',
  'autonomia', 'estimulos', 'pequeno', 'propio', 'lleno', 'acogedor', 'dirigido',
  'realizacion', 'participacion', 'formacion', 'campos', 'edicion', 'estudios',
])

function sectionLetter(div) {
  const n = parseInt(div, 10); if (isNaN(n)) return null
  if (n <= 3) return 'A'; if (n <= 9) return 'B'; if (n <= 33) return 'C'; if (n === 35) return 'D'
  if (n <= 39) return 'E'; if (n <= 43) return 'F'; if (n <= 47) return 'G'; if (n <= 53) return 'H'
  if (n <= 56) return 'I'; if (n <= 63) return 'J'; if (n <= 66) return 'K'; if (n === 68) return 'L'
  if (n <= 75) return 'M'; if (n <= 82) return 'N'; if (n === 84) return 'O'; if (n === 85) return 'P'
  if (n <= 88) return 'Q'; if (n <= 93) return 'R'; if (n <= 96) return 'S'; if (n <= 98) return 'T'; return 'U'
}

// IAE profesionales ("P") y artísticas ("A") no siguen la numeración
// empresarial — espejo de lib/matching.ts.
const IAE_ESPECIALES = {
  P411: 'Q', P421: 'Q', P451: 'M', P460: 'Q', P321: 'M', P411A: 'M',
  P731: 'M', P741: 'M', P742: 'M', P751: 'M', P763: 'J', P776: 'M',
  P861: 'R', A011: 'R', A032: 'R', A041: 'R',
}

function iaeSectionLetter(epigrafe) {
  const code = String(epigrafe || '').trim().toUpperCase()
  if (IAE_ESPECIALES[code]) return IAE_ESPECIALES[code]
  if (/^[PA]/.test(code)) return null
  const d = code.replace(/\D/g, '')[0]
  switch (d) {
    case '0': return 'A'
    case '1': return 'B'
    case '2': return 'C'
    case '3': return 'C'
    case '4': return 'C'
    case '5': return 'F'
    case '6': return 'G'
    case '7': return 'H'
    case '8': return 'K'
    case '9': return 'R'
    default: return null
  }
}

function beneficiarioEncaja(benefArr, tipo) {
  for (const b of (benefArr || [])) {
    const s = strip(b)
    const noEcon = s.includes('no desarrollan')
    const soloJuridica = s.includes('personas juridicas') && !s.includes('persona fisica') && !s.includes('personas fisicas')
    const soloFisica = (s.includes('persona fisica') || s.includes('personas fisicas')) && !s.includes('personas juridicas') && !s.includes('persona juridica')
    if (tipo === 'pyme') {
      if (s.includes('pyme') || s.includes('microempresa') || s.includes('pequena') || s.includes('mediana')) return true
      if (s.includes('desarrollan actividad econ') && !noEcon && !soloFisica) return true
    }
    if (tipo === 'gran_empresa') {
      if (s.includes('gran empresa') || s.includes('grandes empresas')) return true
      if (s.includes('desarrollan actividad econ') && !noEcon && !soloFisica) return true
    }
    if (tipo === 'autonomo') {
      if (s.includes('pyme')) return true
      if ((/aut[oó]nom/.test(s) || s.includes('persona fisica') || s.includes('personas fisicas')) && !noEcon) return true
      if (s.includes('desarrollan actividad econ') && !noEcon && !soloJuridica) return true
    }
    if (tipo === 'asociacion' || tipo === 'fundacion') {
      if (s.includes('sin animo') || s.includes('asociaci') || s.includes('fundaci') || s.includes('no lucr') || noEcon) return true
    }
    if (tipo === 'cooperativa') {
      if (s.includes('cooperativa') || s.includes('economia social')) return true
    }
  }
  return false
}

// "Concesión directa" = pago ya adjudicado por nombre a una entidad concreta —
// espejo de lib/matching.ts.
function esConcesionDirecta(tipoConvocatoria) {
  return strip(tipoConvocatoria || '').includes('concesion directa')
}

// CAPA 1 y CAPA 3 — espejo de lib/matching.ts.
const PROVINCIAS_ES = [
  'alava','albacete','alicante','almeria','asturias','avila','badajoz','baleares','barcelona','burgos',
  'caceres','cadiz','cantabria','castellon','ceuta','ciudad real','cordoba','cuenca','girona','granada',
  'guadalajara','guipuzcoa','huelva','huesca','jaen','la rioja','las palmas','leon','lleida','lugo',
  'madrid','malaga','melilla','murcia','navarra','ourense','palencia','pontevedra','salamanca','segovia',
  'sevilla','soria','tarragona','tenerife','teruel','toledo','valencia','valladolid','vizcaya','zamora','zaragoza',
]
const CCAA_ES = [
  'andalucia','aragon','asturias','baleares','canarias','cantabria','castilla-la mancha','castilla la mancha',
  'castilla y leon','cataluna','cataluña','extremadura','galicia','la rioja','madrid','murcia','navarra',
  'pais vasco','euskadi','valencia','comunidad valenciana','ceuta','melilla',
]

function lugaresAjenos(texto, org) {
  const hay = strip(texto)
  const propios = new Set([strip(org.ccaa || ''), strip(org.provincia || ''), strip(org.municipio || '')].filter(Boolean))
  const fuera = []
  for (const lugar of [...PROVINCIAS_ES, ...CCAA_ES]) {
    if (propios.has(lugar)) continue
    if (new RegExp(`(^|[^a-z])${lugar}([^a-z]|$)`).test(hay)) {
      if (lugar === 'leon' && /castilla y leon/.test(hay)) continue
      fuera.push(lugar)
    }
  }
  return fuera
}

function compartenSector(cnaesObjetivo, org) {
  const grupos = new Set()
  const add = (v) => { const d = String(v || '').replace(/\D/g, '').slice(0, 3); if (d.length >= 2) grupos.add(d) }
  for (const c of (org.cnaes || [])) add(c)
  if (org.cnae) add(org.cnae)
  if (!grupos.size) return false
  for (const objetivo of cnaesObjetivo) {
    const d = String(objetivo || '').replace(/\D/g, '').slice(0, 3)
    if (d.length >= 2 && grupos.has(d)) return true
  }
  return false
}

function matchGrant(c, org, todayISO) {
  const reasons = []
  if (esConcesionDirecta(c.tipo_convocatoria)) return { match: false, score: 0, reasons: [], tier: null }
  const isRadar = !!c.fuente && c.fuente !== 'bdns'
  const open = isRadar || (!!c.fecha_fin && c.fecha_fin >= todayISO)
  if (!open) return { match: false, score: 0, reasons: [], tier: null }

  // CAPA 1: ubicación escrita en texto libre (el radar no la trae estructurada).
  if (isRadar) {
    const ajenos = lugaresAjenos([c.titulo, c.finalidad, ...(c.beneficiarios || [])].join(' '), org)
    if (ajenos.length) return { match: false, score: 0, reasons: [], tier: null }
  }

  // CAPA 3: parentesco de sector con el perfil que disparó el descubrimiento.
  if (c.cnaes_objetivo && c.cnaes_objetivo.length && !compartenSector(c.cnaes_objetivo, org)) {
    return { match: false, score: 0, reasons: [], tier: null }
  }

  const estatal = (c.nivel1 || '').toUpperCase() === 'ESTATAL'
  let score = 10

  if (estatal) {
    reasons.push('Ámbito estatal')
  } else {
    if (!c.ccaa || c.ccaa !== org.ccaa) return { match: false, score: 0, reasons: [], tier: null }

    // Alcance real por NUTS (independiente de si BDNS la marca AUTONOMICA o LOCAL).
    const prov = strip(org.provincia || ''), muni = strip(org.municipio || '')
    const scope = regionScopeFromRegiones(c.regiones)
    if (!scope.wide && scope.provincias.length && prov) {
      if (!scope.provincias.some(p => strip(p) === prov)) return { match: false, score: 0, reasons: [], tier: null }
    }

    const isLocal = (c.nivel1 || '').toUpperCase() === 'LOCAL'
    if (isLocal) {
      const cProv = strip(c.provincia || ''), organoTxt = strip(c.organo || '')
      const muniHit = !!muni && organoTxt.includes(muni)
      const provHit = !!prov && (cProv === prov || organoTxt.includes(prov))
      if (!muniHit && !provHit) {
        if (prov || muni) return { match: false, score: 0, reasons: [], tier: null }
        reasons.push(`Tu CCAA (${org.ccaa})`)
      } else {
        score += 15; reasons.push(muniHit ? `Tu municipio (${org.municipio})` : `Tu provincia (${org.provincia})`)
      }
    } else if (!scope.wide && scope.provincias.length && prov) {
      score += 15; reasons.push(`Tu provincia (${org.provincia})`)
    } else {
      reasons.push(`Tu CCAA (${org.ccaa})`)
    }
  }

  const divs = new Set(), letters = new Set()
  const addCnae = v => { const d = String(v).replace(/\D/g, '').slice(0, 2); if (d) { divs.add(d); const L = sectionLetter(d); if (L) letters.add(L) } }
  for (const code of (org.cnaes || [])) addCnae(code)
  if (org.cnae) addCnae(org.cnae)
  for (const ep of (org.iaes || [])) { const L = iaeSectionLetter(ep); if (L) letters.add(L) }
  if (org.iae) { const L = iaeSectionLetter(org.iae); if (L) letters.add(L) }

  let sectorMatch = false
  const sect = c.sectores || []
  const focused = sect.length > 0 && sect.length <= 8
  if (focused && (divs.size || letters.size)) {
    for (const s of sect) {
      const code = (s.codigo || '').trim()
      if (/^\d/.test(code)) {
        const d = code.replace(/\D/g, '').slice(0, 2)
        if (divs.has(d) || letters.has(sectionLetter(d) || '')) { sectorMatch = true; break }
      } else if (letters.has(code.slice(0, 1).toUpperCase())) { sectorMatch = true; break }
    }
  }
  if (sectorMatch) { score += 45; reasons.push('Tu sector encaja') }

  const benefMatch = beneficiarioEncaja(c.beneficiarios, org.tipo_entidad)
  if (benefMatch) { score += 25; reasons.push('Encaja con tu tipo de entidad') }

  // Filtro duro: beneficiario específico (lista corta) que no encaja con tu
  // tipo de entidad — fuera, aunque coincida sector o palabras clave.
  const benefList = c.beneficiarios || []
  const benefEspecifico = benefList.length > 0 && benefList.length <= 5
  if (!isRadar && benefEspecifico && !benefMatch) return { match: false, score: 0, reasons: [], tier: null }

  const profileTokens = new Set([...tokens(org.keywords), ...tokens(org.actividad), ...tokens(org.cnae_desc), ...tokens(org.iae_desc)])
  for (const t of STOP_TOKENS) profileTokens.delete(t)
  for (const geo of [org.ccaa, org.provincia, org.municipio]) for (const t of tokens(geo)) profileTokens.delete(t)
  let kwHits = 0
  if (profileTokens.size) {
    // Descripciones de sector solo si la lista está acotada (ver 'focused'):
    // una convocatoria con los 21 sectores contiene toda actividad imaginable.
    const hay = strip([
      c.titulo, c.finalidad,
      ...(focused ? (c.sectores || []).map(s => s.descripcion) : []),
      ...(c.beneficiarios || []),
    ].join(' '))
    // Palabra completa, no subcadena.
    for (const t of profileTokens) {
      if (new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(hay)) kwHits++
    }
    if (kwHits > 0) { score += Math.min(30, kwHits * 12); reasons.push(`${kwHits} palabra(s) clave`) }
  }

  // Provincia y tipo de beneficiario ya son filtro duro arriba, pero por sí
  // solos no bastan para sugerir: hace falta señal real de sector/actividad.
  // Una sola palabra suelta no basta sin sector estructurado que la respalde:
  // los homónimos ("edición", "campos") colaban convocatorias de otro mundo.
  const tier = (sectorMatch || kwHits >= 2) ? 'sector' : null
  return { match: tier !== null, score: Math.min(100, score), reasons, tier }
}

function formatEuro(n) {
  if (n == null) return '—'
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'
}

// Coletillas finales de trámite (región/año) — espejo de lib/matching.ts.
const TRAILING_BOILERPLATE = [
  /,?\s*(en|para)\s+la\s+(comunidad( aut[oó]noma)?|ciudad|provincia)\s+de\s+[\wÀ-ÿ][\wÀ-ÿ\s]*$/i,
  /,?\s*en\s+el\s+[aá]mbito\s+de\s+[\wÀ-ÿ][\wÀ-ÿ\s]*$/i,
  /,?\s*(para|durante|correspondientes?\s+a)\s+el\s+(año|ejercicio)\s+\d{4}\.?$/i,
  /,?\s*\d{4}\.?$/,
]

// Resume el título oficial (espejo de lib/matching.ts → tituloCorto).
function tituloCorto(t) {
  let s = (t || '').replace(/\s+/g, ' ').trim()
  const m = s.match(/(subvenci\w*|ayudas?\b|becas?\b|premios?\b|l[ií]neas? de ayuda|bono\w*)[\s\S]*/i)
  if (m) s = m[0].trim()

  let changed = true
  while (changed) {
    changed = false
    for (const re of TRAILING_BOILERPLATE) {
      const next = s.replace(re, '').trim()
      if (next !== s && next.length >= 20) { s = next; changed = true }
    }
  }

  s = s.replace(/[\s,;.:]+$/, '')
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1)
  if (s.length > 120) s = s.slice(0, 117).replace(/\s+\S*$/, '') + '…'
  return s || (t || '')
}

module.exports = { matchGrant, formatEuro, tituloCorto }
