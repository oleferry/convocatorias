// ================================================================
//  Radar — catálogo curado de oportunidades que NO están en la BDNS:
//  premios, becas y aceleradoras de empresas y fundaciones, y fondos
//  europeos. Programas recurrentes y conocidos. El plazo concreto se
//  consulta en la web oficial (no inventamos fechas).
// ================================================================

export interface RadarProgram {
  id: string
  fuente: 'privada' | 'europea'
  nombre: string
  entidad: string
  finalidad: string          // descripción rica en palabras clave (para el matching)
  beneficiarios: string[]
  url: string
}

export const RADAR_PROGRAMS: RadarProgram[] = [
  // ── Privados / fundaciones (España) ──────────────────────────
  {
    id: 'emprendedorxxi', fuente: 'privada',
    nombre: 'Premios EmprendeXXI', entidad: 'CaixaBank y ENISA',
    finalidad: 'Premio a startups y empresas de base tecnológica con menos de 5 años. Emprendimiento, innovación, escalado, inversión.',
    beneficiarios: ['Startups', 'Empresas de base tecnológica < 5 años'],
    url: 'https://www.emprendedorxxi.es',
  },
  {
    id: 'southsummit', fuente: 'privada',
    nombre: 'South Summit Startup Competition', entidad: 'South Summit',
    finalidad: 'Competición internacional de startups: visibilidad, inversores, mentoría. Innovación, tecnología, escalado.',
    beneficiarios: ['Startups', 'Pymes innovadoras'],
    url: 'https://www.southsummit.io',
  },
  {
    id: 'lanzadera', fuente: 'privada',
    nombre: 'Lanzadera', entidad: 'Fundación de Juan Roig',
    finalidad: 'Aceleradora de empresas y startups: formación, mentoría, financiación y espacio. Emprendimiento, crecimiento.',
    beneficiarios: ['Startups', 'Emprendedores', 'Pymes'],
    url: 'https://lanzadera.es',
  },
  {
    id: 'wayra', fuente: 'privada',
    nombre: 'Wayra', entidad: 'Telefónica',
    finalidad: 'Hub de innovación abierta de Telefónica: inversión y acceso a mercado para startups tecnológicas. Tech, digital, escalado.',
    beneficiarios: ['Startups tecnológicas'],
    url: 'https://www.wayra.com',
  },
  {
    id: 'googleforstartups', fuente: 'privada',
    nombre: 'Google for Startups', entidad: 'Google',
    finalidad: 'Programas y campus para startups: formación, mentoría, créditos cloud. Tecnología, IA, escalado internacional.',
    beneficiarios: ['Startups'],
    url: 'https://startup.google.com',
  },
  {
    id: 'lacaixa-socioeconomico', fuente: 'privada',
    nombre: 'Convocatorias Fundación "la Caixa"', entidad: 'Fundación "la Caixa"',
    finalidad: 'Ayudas a proyectos de innovación social, investigación, cultura y empleo. Tercer sector, entidades sociales, investigación.',
    beneficiarios: ['Entidades sin ánimo de lucro', 'Asociaciones', 'Fundaciones', 'Investigadores'],
    url: 'https://fundacionlacaixa.org',
  },
  {
    id: 'fpdgi', fuente: 'privada',
    nombre: 'Premios Fundación Princesa de Girona', entidad: 'Fundación Princesa de Girona',
    finalidad: 'Premios a jóvenes en empresa, investigación científica, artes y social. Talento joven, innovación, impacto.',
    beneficiarios: ['Jóvenes', 'Emprendedores', 'Investigadores'],
    url: 'https://www.fpdgi.org',
  },
  {
    id: 'bbva-momentum', fuente: 'privada',
    nombre: 'BBVA Momentum', entidad: 'Fundación BBVA / BBVA',
    finalidad: 'Programa de impulso a empresas de impacto social: formación, mentoría y financiación. Emprendimiento social, sostenibilidad.',
    beneficiarios: ['Empresas de impacto social', 'Emprendedores sociales'],
    url: 'https://www.bbva.com/es/sostenibilidad/bbva-momentum',
  },
  {
    id: 'repsol-fund', fuente: 'privada',
    nombre: 'Fundación Repsol — Entrepreneurs Fund', entidad: 'Fundación Repsol',
    finalidad: 'Aceleradora de startups en energía, transición energética y sostenibilidad. Cleantech, eficiencia, descarbonización.',
    beneficiarios: ['Startups de energía y sostenibilidad'],
    url: 'https://www.fundacionrepsol.com',
  },
  {
    id: 'aje-joven', fuente: 'privada',
    nombre: 'Premio Joven Empresario', entidad: 'AJE (Asociación de Jóvenes Empresarios)',
    finalidad: 'Premio a jóvenes empresarios y trayectorias emprendedoras. Emprendimiento, pyme, autónomos jóvenes.',
    beneficiarios: ['Jóvenes empresarios', 'Pymes', 'Autónomos'],
    url: 'https://ajeimpulsa.es',
  },
  {
    id: 'sabadell-investigacion', fuente: 'privada',
    nombre: 'Premios Fundación Banco Sabadell', entidad: 'Fundación Banco Sabadell',
    finalidad: 'Premios a la investigación, la ciencia y la economía. Talento investigador, innovación, biomedicina.',
    beneficiarios: ['Investigadores', 'Jóvenes científicos'],
    url: 'https://www.fundacionbancosabadell.com',
  },
  {
    id: 'botin', fuente: 'privada',
    nombre: 'Becas y programas Fundación Botín', entidad: 'Fundación Botín',
    finalidad: 'Becas de formación, talento y emprendimiento. Educación, ciencia, desarrollo profesional.',
    beneficiarios: ['Estudiantes', 'Jóvenes profesionales', 'Investigadores'],
    url: 'https://www.fundacionbotin.org',
  },

  // ── Europeos ─────────────────────────────────────────────────
  {
    id: 'eic-accelerator', fuente: 'europea',
    nombre: 'EIC Accelerator', entidad: 'European Innovation Council (UE)',
    finalidad: 'Subvención y capital para pymes y startups de deep tech con innovación disruptiva. I+D, escalado, tecnología de alto riesgo.',
    beneficiarios: ['Startups', 'Pymes innovadoras (deep tech)'],
    url: 'https://eic.ec.europa.eu',
  },
  {
    id: 'horizon-europe', fuente: 'europea',
    nombre: 'Horizonte Europa (Horizon Europe)', entidad: 'Comisión Europea',
    finalidad: 'Programa marco de I+D+i de la UE: proyectos colaborativos de investigación e innovación. Ciencia, tecnología, consorcios.',
    beneficiarios: ['Pymes', 'Universidades', 'Centros de investigación', 'Empresas'],
    url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home',
  },
  {
    id: 'life', fuente: 'europea',
    nombre: 'Programa LIFE', entidad: 'Comisión Europea',
    finalidad: 'Financiación de proyectos de medio ambiente, naturaleza y acción climática. Sostenibilidad, economía circular, biodiversidad.',
    beneficiarios: ['Empresas', 'Entidades públicas', 'ONG', 'Pymes'],
    url: 'https://cinea.ec.europa.eu/programmes/life_en',
  },
  {
    id: 'digital-europe', fuente: 'europea',
    nombre: 'Digital Europe Programme', entidad: 'Comisión Europea',
    finalidad: 'Financiación de digitalización: IA, ciberseguridad, computación, competencias digitales. Transformación digital.',
    beneficiarios: ['Empresas', 'Pymes', 'Administraciones'],
    url: 'https://digital-strategy.ec.europa.eu/en/activities/digital-programme',
  },
  {
    id: 'creative-europe', fuente: 'europea',
    nombre: 'Europa Creativa (Creative Europe)', entidad: 'Comisión Europea',
    finalidad: 'Apoyo a los sectores cultural, creativo y audiovisual. Cultura, cine, patrimonio, industrias creativas.',
    beneficiarios: ['Empresas culturales', 'ONG', 'Asociaciones', 'Creadores'],
    url: 'https://culture.ec.europa.eu/creative-europe',
  },
  {
    id: 'erasmus-plus', fuente: 'europea',
    nombre: 'Erasmus+', entidad: 'Comisión Europea',
    finalidad: 'Educación, formación, juventud y deporte: movilidad y proyectos de cooperación. Formación, empleo joven, FP.',
    beneficiarios: ['Centros educativos', 'Entidades juveniles', 'Empresas de formación'],
    url: 'https://erasmus-plus.ec.europa.eu',
  },
  {
    id: 'eit', fuente: 'europea',
    nombre: 'EIT (Climate-KIC, Digital, Health…)', entidad: 'European Institute of Innovation & Technology',
    finalidad: 'Comunidades de innovación europeas: emprendimiento, aceleración y financiación por sectores (clima, salud, digital, energía).',
    beneficiarios: ['Startups', 'Pymes', 'Emprendedores'],
    url: 'https://eit.europa.eu',
  },
]
