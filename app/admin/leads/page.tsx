'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { T, FONT } from '@/lib/theme'

const ESTADOS = ['nuevo', 'contactado', 'derivado', 'ganado', 'perdido'] as const
const ESTADO_COLOR: Record<string, string> = {
  nuevo: T.amber, contactado: T.purple, derivado: '#1C7ED6', ganado: T.green, perdido: T.inkMuted,
}

export default function AdminLeadsPage() {
  const sb = createClient()
  const router = useRouter()
  const [leads, setLeads] = useState<any[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')

  async function load() {
    const res = await fetch('/api/admin/leads', { cache: 'no-store' })
    if (res.status === 403) { setState('denied'); return }
    const d = await res.json()
    setLeads(d.leads || []); setState('ok')
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/auth'); return }
      load()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(id: string, patch: any) {
    setLeads(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l))
    await fetch('/api/admin/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
    load()
  }

  if (state === 'loading') return <div style={{ padding: 64, textAlign: 'center', color: T.inkMuted, fontFamily: FONT }}>Cargando…</div>
  if (state === 'denied') return <div style={{ padding: 64, textAlign: 'center', color: T.red, fontFamily: FONT }}>Acceso solo para administradores.</div>

  const pipeline = leads.filter(l => !['perdido'].includes(l.estado)).reduce((s, l) => s + (Number(l.comision_estimada) || 0), 0)
  const ganado = leads.filter(l => l.estado === 'ganado').reduce((s, l) => s + (Number(l.comision_estimada) || 0), 0)
  const eur = (n: number) => n ? Math.round(n).toLocaleString('es-ES') + ' €' : '—'

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: T.inkMuted, padding: '8px 10px', letterSpacing: '0.04em' }
  const td: React.CSSProperties = { padding: '10px', fontSize: 13, color: T.ink, borderTop: `1px solid ${T.border}`, verticalAlign: 'top' }
  const inp: React.CSSProperties = { width: '100%', padding: '5px 7px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', background: T.bgSidebar, color: T.ink }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: FONT }}>
      <div style={{ background: T.navy, padding: '18px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/dashboard" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 20 }}>←</a>
          <h1 style={{ margin: 0, fontSize: 20, color: '#fff', fontWeight: 800, flex: 1 }}>🤝 Leads · panel de administración</h1>
          <button onClick={load} style={{ padding: '8px 14px', background: T.gold, color: T.inkOnAccent, border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>↻ Actualizar</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[['Leads totales', String(leads.length)], ['Comisión en pipeline', eur(pipeline)], ['Comisión ganada', eur(ganado)]].map(([k, v]) => (
            <div key={k} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 18px', minWidth: 160 }}>
              <div style={{ fontSize: 12, color: T.inkMuted }}>{k}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>{v}</div>
            </div>
          ))}
        </div>

        {leads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: T.inkMuted }}>Aún no hay leads. Cuando alguien pulse "Quiero ayuda con esta ayuda" aparecerá aquí.</div>
        ) : (
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead><tr>
                {['Fecha', 'Convocatoria', 'Contacto', 'Estado', 'Gestoría', 'Importe €', '% com.', 'Comisión €', 'Notas'].map(h => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id}>
                    <td style={td}>{new Date(l.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</td>
                    <td style={{ ...td, maxWidth: 220 }}>
                      <div style={{ fontWeight: 600 }}>{l.grant_titulo}</div>
                      {l.grant_url && <a href={l.grant_url} target="_blank" style={{ fontSize: 11, color: T.purple }}>ver bases →</a>}
                    </td>
                    <td style={{ ...td, fontSize: 12 }}>
                      <div>{l.contacto_nombre || '—'}</div>
                      <div>{l.contacto_email || ''}</div>
                      <div>{l.contacto_telefono || ''}</div>
                      {l.mensaje && <div style={{ color: T.inkMuted, marginTop: 4 }}>💬 {l.mensaje}</div>}
                    </td>
                    <td style={td}>
                      <select value={l.estado} onChange={e => save(l.id, { estado: e.target.value })}
                        style={{ ...inp, fontWeight: 700, color: ESTADO_COLOR[l.estado] || T.ink }}>
                        {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={td}><input defaultValue={l.gestoria || ''} placeholder="Gestoría" onBlur={e => save(l.id, { gestoria: e.target.value })} style={inp} /></td>
                    <td style={td}><input defaultValue={l.importe_estimado ?? ''} type="number" placeholder="0" onBlur={e => save(l.id, { importe_estimado: e.target.value })} style={{ ...inp, width: 90 }} /></td>
                    <td style={td}><input defaultValue={l.comision_pct ?? ''} type="number" placeholder="%" onBlur={e => save(l.id, { comision_pct: e.target.value })} style={{ ...inp, width: 60 }} /></td>
                    <td style={{ ...td, fontWeight: 700 }}>{eur(Number(l.comision_estimada) || 0)}</td>
                    <td style={td}><input defaultValue={l.notas_admin || ''} placeholder="Notas" onBlur={e => save(l.id, { notas_admin: e.target.value })} style={{ ...inp, minWidth: 120 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
