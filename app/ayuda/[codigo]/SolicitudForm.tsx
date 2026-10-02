'use client'
import { useState } from 'react'
import Link from 'next/link'
import { T } from '@/lib/theme'
import { CAMPO_TRAMPA } from '@/lib/campo-trampa'

// "¿Te la tramitamos?" sin cuenta. Ver app/api/solicitud/route.ts.
//
// `documentacion` llega ya calculada desde el servidor: lib/tramitacion.ts usa
// `crypto` de Node y no se puede importar en un componente de cliente.

export default function SolicitudForm({ codigo, documentacion }: { codigo: string; documentacion: string[] }) {
  const [f, setF] = useState({ nombre: '', empresa: '', email: '', telefono: '', mensaje: '', [CAMPO_TRAMPA]: '' })
  const [acepto, setAcepto] = useState(false)
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'hecho'>('idle')
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEstado('enviando'); setError('')
    try {
      const r = await fetch('/api/solicitud', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, codigo, acepto }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error || 'Algo ha fallado. Prueba otra vez.'); setEstado('idle'); return }
      setEstado('hecho')
    } catch {
      setError('No hay conexión. Prueba otra vez.'); setEstado('idle')
    }
  }

  const caja: React.CSSProperties = { background: T.goldSoft, border: '1px solid rgba(201,154,61,0.3)', borderRadius: 12, padding: '20px 22px', margin: '28px 0' }
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4, background: '#fff', color: T.ink }
  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: T.inkMid, display: 'block' }

  if (estado === 'hecho') {
    return (
      <div style={caja} role="status">
        <p style={{ fontSize: 17, fontWeight: 800, color: T.ink, margin: '0 0 6px' }}>🐾 Recibido</p>
        <p style={{ fontSize: 14.5, color: T.inkMid, lineHeight: 1.6, margin: '0 0 10px' }}>
          Te va a contactar una gestoría colaboradora para ver si cumples los requisitos y darte un presupuesto antes de empezar.
          Mientras, puedes ir preparando lo que suelen pedir:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: T.inkMid, lineHeight: 1.7 }}>
          {documentacion.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} style={caja}>
      <p style={{ fontSize: 18, fontWeight: 800, color: T.ink, margin: '0 0 4px' }}>¿Te la tramitamos?</p>
      <p style={{ fontSize: 14, color: T.inkMid, lineHeight: 1.6, margin: '0 0 16px' }}>
        Una gestoría colaboradora mira si cumples los requisitos y te da un presupuesto antes de empezar.{' '}
        <strong>Solo pagas si te la conceden.</strong> No hace falta crear cuenta.
      </p>

      {/* Campo trampa: fuera de la pantalla, sin tabulador ni autocompletado. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
        <label>Referencia interna (déjalo vacío)
          <input type="text" name={CAMPO_TRAMPA} tabIndex={-1} autoComplete="off" value={f[CAMPO_TRAMPA]} onChange={set(CAMPO_TRAMPA)} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <label style={lbl}>Nombre *<input required value={f.nombre} onChange={set('nombre')} style={inp} autoComplete="name" /></label>
        <label style={lbl}>Empresa<input value={f.empresa} onChange={set('empresa')} style={inp} autoComplete="organization" /></label>
        <label style={lbl}>Correo<input type="email" value={f.email} onChange={set('email')} style={inp} autoComplete="email" /></label>
        <label style={lbl}>Teléfono<input type="tel" value={f.telefono} onChange={set('telefono')} style={inp} autoComplete="tel" /></label>
      </div>
      <p style={{ fontSize: 12, color: T.inkMuted, margin: '6px 0 0' }}>Correo o teléfono, el que prefieras que usen.</p>
      <label style={{ ...lbl, marginTop: 12 }}>¿Algo que debamos saber? (opcional)
        <textarea value={f.mensaje} onChange={set('mensaje')} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="Qué quieres financiar, plazos, dudas…" />
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: T.inkMid, marginTop: 14, lineHeight: 1.5 }}>
        <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} required style={{ marginTop: 3 }} />
        <span>
          Acepto las <Link href="/condiciones" target="_blank" style={{ color: T.ink, fontWeight: 700 }}>condiciones de tramitación</Link> y
          que mis datos se pasen a la gestoría para que me contacte, como explica la{' '}
          <Link href="/privacidad" target="_blank" style={{ color: T.ink, fontWeight: 700 }}>política de privacidad</Link>.
        </span>
      </label>

      {error && <p role="alert" style={{ color: T.red, fontSize: 13.5, margin: '12px 0 0' }}>{error}</p>}

      <button type="submit" disabled={estado === 'enviando'} style={{
        marginTop: 16, padding: '12px 22px', background: estado === 'enviando' ? T.inkMuted : T.gold, color: T.inkOnAccent,
        border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 800, cursor: estado === 'enviando' ? 'wait' : 'pointer',
      }}>{estado === 'enviando' ? 'Enviando…' : 'Quiero que me la tramiten'}</button>
    </form>
  )
}
