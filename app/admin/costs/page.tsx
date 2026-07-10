'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { T, FONT } from '@/lib/theme'

const FEATURE_LABEL: Record<string, string> = {
  analyze: 'Analizar convocatoria (link/texto)',
  search_web: 'Buscar con IA (perfil)',
  descubrir_privados: 'Descubrimiento de privados (cron)',
  memoria: 'Generar memoria',
  unknown: 'Sin clasificar',
}

const card: React.CSSProperties = { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 18px' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: T.bgSidebar, color: T.ink }

function usd(n: number) { return '$' + n.toFixed(4) }
function eur(n: number) { return n.toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' €' }

function Sparkbars({ byDay }: { byDay: Record<string, number> }) {
  const days: string[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const values = days.map(d => byDay[d] || 0)
  const max = Math.max(...values, 0.0001)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
      {values.map((v, i) => (
        <div key={i} title={`${days[i]}: ${usd(v)}`} style={{
          flex: 1, height: `${Math.max(2, (v / max) * 100)}%`,
          background: v > 0 ? T.gold : T.border, borderRadius: 2, minWidth: 2,
        }} />
      ))}
    </div>
  )
}

export default function AdminCostsPage() {
  const sb = createClient()
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')
  const [data, setData] = useState<any>(null)
  const [newCost, setNewCost] = useState({ name: '', amount_eur: '', period: 'monthly', notes: '' })

  async function load() {
    const res = await fetch('/api/admin/costs', { cache: 'no-store' })
    if (res.status === 403) { setState('denied'); return }
    setData(await res.json()); setState('ok')
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/auth'); return }
      load()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveCost(patch: any) {
    await fetch('/api/admin/costs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    load()
  }
  async function addCost() {
    if (!newCost.name || !newCost.amount_eur) return
    await saveCost({ name: newCost.name, amount_eur: Number(newCost.amount_eur), period: newCost.period, notes: newCost.notes })
    setNewCost({ name: '', amount_eur: '', period: 'monthly', notes: '' })
  }

  if (state === 'loading') return <div style={{ padding: 64, textAlign: 'center', color: T.inkMuted, fontFamily: FONT }}>Cargando…</div>
  if (state === 'denied') return <div style={{ padding: 64, textAlign: 'center', color: T.red, fontFamily: FONT }}>Acceso solo para administradores.</div>
  if (!data) return null

  const FX = 0.92 // aproximado USD→EUR, solo para el total combinado
  const apiCostEurMonth = data.monthApiCostUsd * FX
  const totalMonth = apiCostEurMonth + data.totalFixedMonthlyEur
  const features = Object.entries(data.byFeature || {}) as [string, any][]

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: T.inkMuted, padding: '8px 10px', letterSpacing: '0.04em' }
  const td: React.CSSProperties = { padding: '10px', fontSize: 13, color: T.ink, borderTop: `1px solid ${T.border}`, verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: FONT }}>
      <div style={{ background: T.navy, padding: '18px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/dashboard" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 20 }}>←</a>
          <h1 style={{ margin: 0, fontSize: 20, color: '#fff', fontWeight: 800, flex: 1 }}>💸 Costes · panel de administración</h1>
          <button onClick={load} style={{ padding: '8px 14px', background: T.gold, color: T.inkOnAccent, border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>↻ Actualizar</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        {/* Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, marginBottom: 20 }}>
          <div style={card}>
            <div style={{ fontSize: 12, color: T.inkMuted }}>API Claude · este mes</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{usd(data.monthApiCostUsd)}</div>
            <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>≈ {eur(apiCostEurMonth)}</div>
          </div>
          <div style={card}>
            <div style={{ fontSize: 12, color: T.inkMuted }}>Costes fijos · al mes</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{eur(data.totalFixedMonthlyEur)}</div>
            <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>Railway, Vercel, Supabase, dominio…</div>
          </div>
          <div style={{ ...card, border: `2px solid ${T.gold}` }}>
            <div style={{ fontSize: 12, color: T.inkMuted }}>Total estimado · al mes</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.gold, fontVariantNumeric: 'tabular-nums' }}>{eur(totalMonth)}</div>
            <div style={{ fontSize: 11, color: T.inkMuted, marginTop: 2 }}>API convertida a € (aprox.)</div>
          </div>
        </div>

        {/* Gráfico 30 días */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 10 }}>Coste API — últimos 30 días</div>
          <Sparkbars byDay={data.byDay || {}} />
        </div>

        {/* Por función */}
        <div style={{ ...card, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', fontSize: 13, fontWeight: 700, color: T.ink, borderBottom: `1px solid ${T.border}` }}>Coste API por función (últimos 30 días)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Función', 'Llamadas', 'Tokens entrada', 'Tokens salida', 'Coste'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {features.length === 0 && <tr><td style={td} colSpan={5}>Aún no hay llamadas registradas.</td></tr>}
              {features.sort((a, b) => b[1].cost - a[1].cost).map(([k, v]) => (
                <tr key={k}>
                  <td style={td}>{FEATURE_LABEL[k] || k}</td>
                  <td style={td}>{v.calls}</td>
                  <td style={td}>{v.inputTokens.toLocaleString('es-ES')}</td>
                  <td style={td}>{v.outputTokens.toLocaleString('es-ES')}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{usd(v.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Costes fijos */}
        <div style={{ ...card, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', fontSize: 13, fontWeight: 700, color: T.ink, borderBottom: `1px solid ${T.border}` }}>Costes fijos (edítalos aquí)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Nombre', 'Importe €', 'Periodo', 'Notas', 'Activo', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(data.fixedCosts || []).map((f: any) => (
                <tr key={f.id}>
                  <td style={td}><input defaultValue={f.name} onBlur={e => saveCost({ id: f.id, name: e.target.value })} style={inp} /></td>
                  <td style={td}><input defaultValue={f.amount_eur} type="number" onBlur={e => saveCost({ id: f.id, amount_eur: Number(e.target.value) })} style={{ ...inp, width: 90 }} /></td>
                  <td style={td}>
                    <select defaultValue={f.period} onChange={e => saveCost({ id: f.id, period: e.target.value })} style={inp}>
                      <option value="monthly">mensual</option>
                      <option value="yearly">anual</option>
                      <option value="one_time">único</option>
                    </select>
                  </td>
                  <td style={td}><input defaultValue={f.notes || ''} onBlur={e => saveCost({ id: f.id, notes: e.target.value })} style={inp} /></td>
                  <td style={td}>
                    <input type="checkbox" defaultChecked={f.active} onChange={e => saveCost({ id: f.id, active: e.target.checked })} />
                  </td>
                  <td style={td}><button onClick={() => saveCost({ id: f.id, delete: true })} style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer' }}>✕</button></td>
                </tr>
              ))}
              <tr>
                <td style={td}><input placeholder="Nuevo coste (ej. Resend Pro)" value={newCost.name} onChange={e => setNewCost({ ...newCost, name: e.target.value })} style={inp} /></td>
                <td style={td}><input placeholder="0" type="number" value={newCost.amount_eur} onChange={e => setNewCost({ ...newCost, amount_eur: e.target.value })} style={{ ...inp, width: 90 }} /></td>
                <td style={td}>
                  <select value={newCost.period} onChange={e => setNewCost({ ...newCost, period: e.target.value })} style={inp}>
                    <option value="monthly">mensual</option>
                    <option value="yearly">anual</option>
                    <option value="one_time">único</option>
                  </select>
                </td>
                <td style={td}><input placeholder="Notas" value={newCost.notes} onChange={e => setNewCost({ ...newCost, notes: e.target.value })} style={inp} /></td>
                <td style={td} colSpan={2}><button onClick={addCost} style={{ padding: '6px 14px', background: T.gold, color: T.inkOnAccent, border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>+ Añadir</button></td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 12, color: T.inkMuted, textAlign: 'center' }}>
          Railway, Vercel, Supabase y Resend se facturan por plan/uso propio — revisa sus paneles para el dato exacto y ajusta aquí el importe.
        </p>
      </div>
    </div>
  )
}
