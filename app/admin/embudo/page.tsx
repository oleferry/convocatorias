'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { T, FONT } from '@/lib/theme'

const card: React.CSSProperties = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 18px' }

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminEmbudoPage() {
  const sb = createClient()
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')
  const [d, setD] = useState<any>(null)

  async function load() {
    const res = await fetch('/api/admin/embudo', { cache: 'no-store' })
    if (res.status === 403) { setState('denied'); return }
    setD(await res.json()); setState('ok')
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/auth'); return }
      load()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state === 'loading') return <div style={{ padding: 64, textAlign: 'center', color: T.inkMuted, fontFamily: FONT }}>Cargando…</div>
  if (state === 'denied') return <div style={{ padding: 64, textAlign: 'center', color: T.red, fontFamily: FONT }}>Acceso solo para administradores.</div>
  if (!d) return null

  const top = d.pasos[0]?.n || 1
  const semanas = Object.entries(d.porSemana || {}).sort() as [string, number][]
  const maxSemana = Math.max(...semanas.map(s => s[1]), 1)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: FONT }}>
      <div style={{ background: T.navy, padding: '18px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/dashboard" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 20 }}>←</a>
          <h1 style={{ margin: 0, fontSize: 20, color: '#fff', fontWeight: 800, flex: 1 }}>🪜 Embudo de activación</h1>
          <button onClick={load} style={{ padding: '8px 14px', background: T.gold, color: T.inkOnAccent, border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>↻ Actualizar</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        {/* Embudo */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 4 }}>De cada persona que se registra, ¿hasta dónde llega?</div>
          <div style={{ fontSize: 12, color: T.inkMuted, marginBottom: 16 }}>
            Los cuatro primeros pasos salen de la base de datos y valen para todo el histórico.
            Los tres últimos son eventos, y solo cuentan {d.eventosDesde ? `desde el ${fecha(d.eventosDesde)}` : 'desde que se despliegue esta medición (aún no hay ninguno)'}.
          </div>
          {d.pasos.map((p: any, i: number) => {
            const pct = top ? Math.round((p.n / top) * 100) : 0
            const prev = i > 0 ? d.pasos[i - 1].n : null
            const caida = prev != null && prev > 0 ? prev - p.n : 0
            const esEvento = p.fuente === 'eventos'
            return (
              <div key={p.paso} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.ink, marginBottom: 3 }}>
                  <span style={{ color: esEvento ? T.inkLight : T.ink }}>{p.paso}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <strong>{p.n}</strong>
                    <span style={{ color: T.inkMuted, fontSize: 12 }}> · {pct}%</span>
                    {caida > 0 && <span style={{ color: T.red, fontSize: 12 }}> · −{caida}</span>}
                  </span>
                </div>
                <div style={{ height: 22, background: T.bgSidebar, borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(pct, 1)}%`, background: esEvento ? T.inkMuted : T.gold, borderRadius: 5 }} />
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 13, color: T.inkLight }}>
            Leads totales recibidos (web + email + Telegram): <strong style={{ color: T.ink }}>{d.leads}</strong>
          </div>
        </div>

        {/* Altas por semana */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Altas nuevas por semana</div>
          {semanas.length === 0 ? <div style={{ fontSize: 13, color: T.inkMuted }}>Sin altas.</div> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
              {semanas.map(([wk, n]) => (
                <div key={wk} title={`Semana del ${fecha(wk)}: ${n} alta(s)`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ fontSize: 10, color: T.inkMuted, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
                  <div style={{ width: '100%', height: `${(n / maxSemana) * 60}px`, minHeight: 2, background: T.gold, borderRadius: 3 }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sin confirmar */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>Se registraron y nunca confirmaron el email ({d.sinConfirmar.length})</div>
            <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 3 }}>Si varias caen el mismo día, no es desinterés: es que ese día el email no salió.</div>
          </div>
          {d.sinConfirmar.length === 0 ? (
            <div style={{ padding: '14px 18px', fontSize: 13, color: T.inkMuted }}>Ninguno. Todos confirmaron.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {d.sinConfirmar.map((u: any) => (
                  <tr key={u.email}>
                    <td style={{ padding: '10px 18px', fontSize: 13, color: T.ink, borderTop: `1px solid ${T.border}` }}>{u.email}</td>
                    <td style={{ padding: '10px 18px', fontSize: 12.5, color: T.inkMuted, borderTop: `1px solid ${T.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fecha(u.alta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
