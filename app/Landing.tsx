'use client'
import { useState } from 'react'
import { T, FONT, FONT_DISPLAY } from '@/lib/theme'

const wrap: React.CSSProperties = { maxWidth: 1080, margin: '0 auto', padding: '0 24px' }
const h2: React.CSSProperties = { fontSize: 'clamp(22px,4vw,32px)', fontWeight: 800, color: T.ink, fontFamily: FONT_DISPLAY, letterSpacing: '-0.02em', margin: '0 0 12px' }
const lead: React.CSSProperties = { fontSize: 16, color: T.inkMid, lineHeight: 1.65, maxWidth: 640 }
const card: React.CSSProperties = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: 24 }

function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: T.gold, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: Math.round(size * 0.56) }}>
      <img src="/logo.png?v=2" alt="DamePerrasPerro" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={(e) => { const t = e.currentTarget; t.style.display = 'none'; const p = t.parentElement; if (p) p.textContent = '🐶' }} />
    </div>
  )
}

function Wordmark() {
  return (
    <span style={{ fontSize: 20, fontWeight: 800, color: T.ink, fontFamily: FONT_DISPLAY, letterSpacing: '-0.02em' }}>
      Dame<span style={{ color: T.gold }}>Perras</span>Perro
    </span>
  )
}

function CTAButton({ href, children, primary = true }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <a href={href} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '13px 26px', borderRadius: 10, fontSize: 15, fontWeight: 800, textDecoration: 'none',
      background: primary ? T.gold : 'transparent', color: primary ? T.inkOnAccent : T.ink,
      border: primary ? 'none' : `1.5px solid ${T.border}`,
    }}>{children}</a>
  )
}

function Fuente({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 18px' }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{label}</span>
    </div>
  )
}

function Paso({ n, icon, titulo, texto }: { n: number; icon: string; titulo: string; texto: string }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.goldSoft, color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{n}</div>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{titulo}</div>
      <div style={{ fontSize: 14, color: T.inkMid, lineHeight: 1.55 }}>{texto}</div>
    </div>
  )
}

function GestoriaForm() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [zona, setZona] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function submit() {
    setState('sending')
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, telefono, zona, mensaje }),
      })
      if (!res.ok) throw new Error()
      setState('done')
    } catch { setState('error') }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '11px 13px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4, background: T.bgSidebar, color: T.ink }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: T.inkMid }

  if (state === 'done') {
    return (
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🐾</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, margin: '8px 0 4px' }}>¡Recibido!</div>
        <div style={{ fontSize: 14, color: T.inkMid }}>Te escribimos en cuanto tengamos leads de tu zona/especialidad.</div>
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={lbl}>Nombre y despacho<input value={nombre} onChange={e => setNombre(e.target.value)} style={inp} placeholder="Tu nombre — Nombre de la gestoría" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={lbl}>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="tu@gestoria.com" /></label>
          <label style={lbl}>Teléfono<input value={telefono} onChange={e => setTelefono(e.target.value)} style={inp} placeholder="Opcional" /></label>
        </div>
        <label style={lbl}>Zona / especialidad<input value={zona} onChange={e => setZona(e.target.value)} style={inp} placeholder="Ej. Valladolid — subvenciones I+D" /></label>
        <label style={lbl}>Cuéntanos algo más (opcional)<textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} /></label>
        {state === 'error' && <div style={{ color: T.red, fontSize: 13 }}>Algo ha fallado. Prueba otra vez o escríbenos directamente.</div>}
        <button onClick={submit} disabled={state === 'sending' || !nombre || !email} style={{
          padding: '13px 20px', background: state === 'sending' ? T.inkMuted : T.gold, color: T.inkOnAccent,
          border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: state === 'sending' ? 'wait' : 'pointer',
        }}>{state === 'sending' ? 'Enviando…' : 'Quiero recibir leads'}</button>
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div style={{ fontFamily: FONT, background: T.bg, color: T.ink }}>
      {/* NAV */}
      <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><BrandMark size={34} /><Wordmark /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <a href="#gestorias" style={{ fontSize: 14, fontWeight: 600, color: T.inkMid, textDecoration: 'none' }}>Para gestorías</a>
          <a href="/auth" style={{ fontSize: 14, fontWeight: 700, color: T.ink, textDecoration: 'none' }}>Iniciar sesión</a>
        </div>
      </div>

      {/* HERO */}
      <div style={{ ...wrap, padding: '48px 24px 64px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 20, background: T.goldSoft, color: T.ink, fontSize: 12.5, fontWeight: 700, marginBottom: 20 }}>
          🐾 BDNS · fondos europeos · ayudas y premios privados
        </div>
        <h1 style={{ fontSize: 'clamp(32px,6vw,52px)', fontWeight: 800, fontFamily: FONT_DISPLAY, letterSpacing: '-0.03em', lineHeight: 1.08, margin: '0 0 18px', maxWidth: 780 }}>
          El perro que encuentra <span style={{ color: T.gold }}>las perras</span>
        </h1>
        <p style={{ fontSize: 18, color: T.inkMid, lineHeight: 1.6, maxWidth: 580, margin: '0 0 30px' }}>
          Vigilo la BDNS, las ayudas autonómicas y locales, los fondos europeos y los premios privados de tu sector — y te aviso en cuanto hay una que encaja con tu empresa.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <CTAButton href="/auth">🐶 Crear cuenta gratis</CTAButton>
          <CTAButton href="#como-funciona" primary={false}>Ver cómo funciona</CTAButton>
        </div>
        <p style={{ fontSize: 13, color: T.inkMuted, marginTop: 16 }}>Sin tarjeta. En 2 minutos tienes tu perfil listo.</p>
      </div>

      {/* PROBLEMA */}
      <div style={{ ...wrap, padding: '20px 24px 56px' }}>
        <div style={{ ...card, textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
          <p style={{ fontSize: 16, color: T.inkMid, lineHeight: 1.7, margin: 0 }}>
            Cada semana salen ayudas para tu negocio — de tu ayuntamiento, tu diputación, tu comunidad autónoma, la UE, cámaras de comercio, fundaciones... Repartidas en decenas de webs distintas. La mayoría de pymes y autónomos <b>nunca se enteran</b>, o llegan tarde al plazo. Yo las olfateo todas, todos los días, y solo te traigo las que van contigo.
          </p>
        </div>
      </div>

      {/* CÓMO FUNCIONA */}
      <div id="como-funciona" style={{ ...wrap, padding: '20px 24px 64px' }}>
        <h2 style={{ ...h2, textAlign: 'center' }}>Cómo trabajo</h2>
        <p style={{ ...lead, textAlign: 'center', margin: '0 auto 32px' }}>Cuatro pasos, cero esfuerzo por tu parte.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 16 }}>
          <Paso n={1} icon="🏢" titulo="Creas tu perfil" texto="CNAE, IAE (opcional), CCAA, provincia y municipio. Cuanto más preciso, mejor te encajo las ayudas." />
          <Paso n={2} icon="🐾" titulo="Olfateo cada día" texto="Cruzo tu perfil con la BDNS (estatal, autonómica y local), fondos europeos y ayudas privadas que descubro con IA." />
          <Paso n={3} icon="🔔" titulo="Te aviso" texto="Resumen semanal por email, y al instante por Telegram si lo conectas. Sin ruido: solo lo que de verdad te toca." />
          <Paso n={4} icon="📋" titulo="Lo gestionas" texto="Guardas la convocatoria, marcas el estado, y hasta te genero un borrador de memoria con IA para presentar la solicitud." />
        </div>
      </div>

      {/* QUÉ ENCUENTRO */}
      <div style={{ ...wrap, padding: '20px 24px 64px' }}>
        <h2 style={{ ...h2, textAlign: 'center' }}>Qué olfateo</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 12, maxWidth: 780, margin: '24px auto 0' }}>
          <Fuente icon="🏛️" label="BDNS — estatal, autonómica y local" />
          <Fuente icon="🇪🇺" label="Fondos europeos (Horizon, EIC, LIFE…)" />
          <Fuente icon="🤝" label="Premios y ayudas privadas (fundaciones, bancos, cámaras)" />
        </div>
      </div>

      {/* PARA QUIÉN */}
      <div style={{ ...wrap, padding: '20px 24px 64px', textAlign: 'center' }}>
        <h2 style={h2}>Para cualquier pyme o autónomo</h2>
        <p style={{ ...lead, margin: '0 auto 24px' }}>Da igual tu sector: óptica, arquitectura, transporte, hostelería, comercio, servicios… Configuras tu CNAE/IAE una vez y yo hago el resto.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['👓 Ópticas', '🏗️ Arquitectura', '🚚 Transporte', '🍽️ Hostelería', '🛍️ Comercio', '💼 Servicios', '🌾 Agroalimentario'].map(t => (
            <span key={t} style={{ padding: '8px 16px', borderRadius: 20, background: T.bgCard, border: `1px solid ${T.border}`, fontSize: 13.5, fontWeight: 600, color: T.inkMid }}>{t}</span>
          ))}
        </div>
      </div>

      {/* PRECIO */}
      <div style={{ ...wrap, padding: '20px 24px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 16, maxWidth: 780, margin: '0 auto' }}>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.green, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gratis</div>
            <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0' }}>0 €</div>
            <ul style={{ margin: 0, padding: '0 0 0 18px', color: T.inkMid, fontSize: 14, lineHeight: 1.9 }}>
              <li>1 perfil de empresa</li>
              <li>Sugerencias ilimitadas</li>
              <li>Resumen semanal por email</li>
            </ul>
          </div>
          <div style={{ ...card, border: `2px solid ${T.gold}`, position: 'relative' }}>
            <div style={{ position: 'absolute', top: -12, right: 20, background: T.gold, color: T.inkOnAccent, fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 12 }}>PRÓXIMAMENTE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pro</div>
            <div style={{ fontSize: 28, fontWeight: 800, margin: '8px 0' }}>—</div>
            <ul style={{ margin: 0, padding: '0 0 0 18px', color: T.inkMid, fontSize: 14, lineHeight: 1.9 }}>
              <li>Varios perfiles de empresa</li>
              <li>Alertas por Telegram al instante</li>
              <li>Memorias con IA ilimitadas</li>
            </ul>
          </div>
        </div>
      </div>

      {/* GESTORÍAS */}
      <div id="gestorias" style={{ ...wrap, padding: '20px 24px 72px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 32, alignItems: 'center' }}>
          <div>
            <h2 style={h2}>¿Eres una gestoría o asesoría?</h2>
            <p style={{ ...lead, marginBottom: 14 }}>
              Muchas pymes y autónomos que encuentran una ayuda conmigo prefieren que alguien se la tramite. Cuando pulsan <b>"Quiero ayuda con esta ayuda"</b>, te lo derivamos a ti.
            </p>
            <ul style={{ margin: '0 0 20px', padding: '0 0 0 18px', color: T.inkMid, fontSize: 14.5, lineHeight: 1.9 }}>
              <li>Leads cualificados: ya saben qué convocatoria quieren</li>
              <li>Filtrados por tu zona y tu especialidad</li>
              <li>Sin cuota fija: solo pagas por lo que cierras</li>
            </ul>
          </div>
          <GestoriaForm />
        </div>
      </div>

      {/* CTA FINAL */}
      <div style={{ ...wrap, padding: '20px 24px 72px', textAlign: 'center' }}>
        <div style={{ ...card, background: T.bgSidebar, border: 'none', padding: '48px 24px' }}>
          <div style={{ fontSize: 'clamp(22px,4vw,30px)', fontWeight: 800, color: '#fff', fontFamily: FONT_DISPLAY, marginBottom: 10 }}>
            No dejes que se te escape ni una perra.
          </div>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, marginBottom: 24 }}>Crea tu perfil gratis en 2 minutos.</p>
          <CTAButton href="/auth">🐶 Crear cuenta gratis</CTAButton>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ ...wrap, padding: '24px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BrandMark size={24} /><span style={{ fontSize: 13, color: T.inkMuted }}>DamePerrasPerro — el perro que encuentra las perras</span></div>
        <a href="mailto:perro@dameperrasperro.es" style={{ fontSize: 13, color: T.inkMuted, textDecoration: 'none' }}>perro@dameperrasperro.es</a>
      </div>
    </div>
  )
}
