'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Organization, Grant, GrantStatus } from '@/lib/types'
import { STATUS_META, TYPE_META } from '@/lib/types'
import { T, FONT, FONT_DISPLAY, daysLeft, urgency } from '@/lib/theme'
import { publicToGrant, formatEuro, tituloCorto } from '@/lib/matching'

// Paleta de formularios derivada de los tokens de diseño (compatibilidad con el
// código heredado de GrantForm / DiscoveryPanel).
const C = {
  navy: T.navy, amber: T.amber, amberLight: T.amberSoft,
  green: T.green, greenLight: T.greenSoft, red: T.red, redLight: T.redSoft,
  slate: T.inkLight, muted: T.inkMuted, white: T.bgCard,
  purple: T.purple, purpleLight: T.purpleSoft,
  parchment: T.bg, parchmentDark: T.border, ink: T.ink,
}

// ─── BRAND MARK ───────────────────────────────────────────────────────────────
// Usa /public/logo.png. Si aún no lo has subido, cae a un emoji 🐶 sobre oro.
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 9, background: T.gold, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', fontSize: Math.round(size * 0.56),
    }}>
      <img src="/logo.png?v=2" alt="DamePerrasPerro" width={size} height={size}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={(e) => { const t = e.currentTarget; t.style.display = 'none'; const p = t.parentElement; if (p) p.textContent = '🐶' }} />
    </div>
  )
}

// ─── SHARED UI ATOMS ──────────────────────────────────────────────────────────
function Badge({ status }: { status: GrantStatus }) {
  const s = STATUS_META[status] || STATUS_META.pendiente
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.01em', whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 7 }}>●</span> {s.label}
    </span>
  )
}

function OrgTag({ org }: { org?: Organization }) {
  if (!org) return null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4,
      background: org.color + '18', color: org.color,
      fontSize: 11, fontWeight: 600,
    }}>
      {org.emoji} {org.name}
    </span>
  )
}

// Firma visual: termómetro vertical de urgencia
function UrgencyBar({ days }: { days: number | null }) {
  const u = urgency(days)
  if (u.tier <= 0) return <div style={{ width: 3, background: T.border, borderRadius: 2, alignSelf: 'stretch' }} />
  const pct = days === 0 ? 100 : Math.max(10, Math.min(100, (1 - (days as number) / 90) * 100))
  return (
    <div style={{ width: 3, borderRadius: 2, alignSelf: 'stretch', background: T.border, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: `${pct}%`, background: u.color, borderRadius: 2, transition: 'height 0.4s ease',
      }} />
    </div>
  )
}

function PriorityDot({ p }: { p: number }) {
  return p === 1 ? <span style={{ color: T.red, fontSize: 9, fontWeight: 800 }}>▲ ALTA</span> : null
}

// ─── GRANT CARD ───────────────────────────────────────────────────────────────
function GrantCard({ grant, org, onClick, compact }: { grant: Grant; org?: Organization; onClick: () => void; compact?: boolean }) {
  const days = daysLeft(grant.plazo_solicitud)
  const u = urgency(days)
  const [hover, setHover] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: T.bgCard, borderRadius: 12,
        border: `1px solid ${hover ? T.borderMid : T.border}`,
        cursor: 'pointer', display: 'flex', gap: 0, overflow: 'hidden',
        transition: 'box-shadow 0.18s, border-color 0.18s, transform 0.12s',
        boxShadow: hover ? '0 8px 28px rgba(0,0,0,0.09)' : '0 1px 3px rgba(0,0,0,0.04)',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}
    >
      <UrgencyBar days={days} />
      <div style={{ flex: 1, padding: compact ? '14px 16px' : '18px 20px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: T.inkLight }}>
                {TYPE_META[grant.tipo]?.icon} {grant.organismo}
              </span>
              {org && <OrgTag org={org} />}
              {grant.auto_found && (
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: T.purpleSoft, color: T.purple, fontWeight: 700 }}>IA</span>
              )}
            </div>
            <div style={{
              fontSize: compact ? 14 : 15, fontWeight: 700, color: T.ink,
              lineHeight: 1.35, letterSpacing: '-0.01em',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            } as any}>{grant.titulo}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <Badge status={grant.status} />
            <PriorityDot p={grant.prioridad} />
          </div>
        </div>

        {grant.importe_max && (
          <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', marginBottom: 10 }}>
            {grant.importe_max}
          </div>
        )}

        {!compact && grant.resumen && (
          <p style={{
            margin: '0 0 12px', fontSize: 12.5, color: T.inkLight, lineHeight: 1.6,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as any}>{grant.resumen}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          {grant.plazo_solicitud ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: u.color, fontVariantNumeric: 'tabular-nums' }}>
                {u.tier <= 0 ? 'Vencida' : u.tier === 4 ? '¡Hoy!' : `${days}d`}
              </span>
              <span style={{ fontSize: 11, color: T.inkMuted }}>
                {u.tier > 0 && new Date(grant.plazo_solicitud).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: T.inkMuted }}>Sin plazo</span>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            {(grant.tags || []).slice(0, 2).map(t => (
              <span key={t} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: T.bg, color: T.inkLight, fontWeight: 500 }}>#{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SUGGESTION CARD (catálogo BDNS) ──────────────────────────────────────────
function SuggestionCard({ c, saved, onSave, onLead }: { c: any; saved: boolean; onSave: () => void; onLead: () => void }) {
  const days = daysLeft(c.fecha_fin)
  const u = urgency(days)
  const scoreColor = c.matchScore >= 80 ? T.green : c.matchScore >= 50 ? T.amber : T.inkLight
  return (
    <div style={{
      background: saved ? T.greenSoft + '55' : T.bgCard, borderRadius: 12,
      border: `1px solid ${T.border}`, overflow: 'hidden', display: 'flex',
    }}>
      <UrgencyBar days={days} />
      <div style={{ flex: 1, padding: '16px 18px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: T.inkLight, marginBottom: 4 }}>
              {c.fuente === 'privada' ? '🤝 Privada' : c.fuente === 'europea' ? '🇪🇺 Europa' : '🏛️'} {c.organo || c.nivel1}{(!c.fuente || c.fuente === 'bdns') ? ` · BDNS ${c.codigo_bdns}` : ''}
            </div>
            <div title={c.titulo} style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, lineHeight: 1.35 }}>{tituloCorto(c.titulo)}</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: 46, flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>{c.matchScore}</div>
            <div style={{ fontSize: 10, color: T.inkMuted }}>match</div>
          </div>
        </div>
        {c.presupuesto_total != null && (
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 6 }}>
            {formatEuro(c.presupuesto_total)}
          </div>
        )}
        {c.matchReason && (
          <div style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 6, background: T.purpleSoft, color: T.purple, fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>
            💡 {c.matchReason}
          </div>
        )}
        {(c.beneficiarios || []).length > 0 && (
          <div style={{ fontSize: 11.5, color: T.inkLight, marginBottom: 10, lineHeight: 1.5 }}>
            👥 {(c.beneficiarios || []).join(' · ')}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: u.color }}>
            {c.fecha_fin ? (u.tier <= 0 ? 'Vencida' : `Hasta ${new Date(c.fecha_fin).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${days}d`) : (c.fuente && c.fuente !== 'bdns' ? '🔁 Consulta el plazo en la web' : 'Sin plazo')}
          </span>
          {c.bases_url && <a href={c.bases_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: T.gold, textDecoration: 'none', fontWeight: 600 }}>🔗 Bases</a>}
          <div style={{ flex: 1 }} />
          <button onClick={onLead} title="Te ponemos en contacto con una gestoría especializada"
            style={{ padding: '7px 12px', background: 'transparent', color: T.purple, border: `1px solid ${T.purple}`, borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>🤝 Quiero ayuda</button>
          {saved
            ? <span style={{ fontSize: 13, color: T.green, fontWeight: 700 }}>✅ Guardada</span>
            : <button onClick={onSave} style={{ padding: '7px 16px', background: T.gold, color: T.inkOnAccent, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>+ Guardar</button>}
        </div>
      </div>
    </div>
  )
}

// ─── MODAL: solicitar ayuda de gestoría (lead / monetización) ─────────────────
function LeadModal({ item, user, onClose }: { item: any; user: any; onClose: () => void }) {
  const [nombre, setNombre] = useState((user?.user_metadata?.full_name as string) || '')
  const [email, setEmail] = useState(user?.email || '')
  const [telefono, setTelefono] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  async function submit() {
    setSending(true); setErr('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: item.grant_titulo || item.titulo, codigo_bdns: item.codigo_bdns || null,
          url: item.bases_url || item.url || null, fuente: item.fuente || null, orgId: item.org_id || null,
          nombre, email, telefono, mensaje,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Error')
      setDone(true)
    } catch (e: any) { setErr(e.message || 'Error') } finally { setSending(false) }
  }
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', marginTop: 4, background: T.bgSidebar, color: T.ink }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(18,18,18,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bgCard, borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 12px 48px rgba(0,0,0,0.25)' }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>🐾</div>
            <h3 style={{ color: T.ink, margin: '8px 0' }}>¡Recibido!</h3>
            <p style={{ color: T.inkLight, fontSize: 14 }}>Te pondremos en contacto con una gestoría especializada en esta ayuda. Revisaremos tu caso y te escribimos.</p>
            <button onClick={onClose} style={{ marginTop: 16, padding: '10px 24px', background: T.navy, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cerrar</button>
          </div>
        ) : (
          <>
            <h3 style={{ color: T.ink, margin: '0 0 4px' }}>🤝 Quiero ayuda con esta ayuda</h3>
            <p style={{ color: T.inkLight, fontSize: 13, margin: '0 0 6px' }}>{item.grant_titulo || item.titulo}</p>
            <p style={{ color: T.inkMuted, fontSize: 12.5, margin: '0 0 16px' }}>Te ponemos en contacto con una gestoría especializada que te la tramita. Déjanos cómo contactarte.</p>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.inkLight }}>Nombre<input value={nombre} onChange={e => setNombre(e.target.value)} style={inp} /></label>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.inkLight, display: 'block', marginTop: 10 }}>Email<input value={email} onChange={e => setEmail(e.target.value)} style={inp} /></label>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.inkLight, display: 'block', marginTop: 10 }}>Teléfono<input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Para que te llamen" style={inp} /></label>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.inkLight, display: 'block', marginTop: 10 }}>Mensaje (opcional)<textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
            {err && <div style={{ color: T.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={onClose} style={{ padding: '10px 18px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, color: T.inkLight, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={submit} disabled={sending || !email} style={{ padding: '10px 22px', background: sending ? T.inkMuted : T.gold, color: T.inkOnAccent, border: 'none', borderRadius: 8, fontWeight: 800, cursor: sending ? 'wait' : 'pointer' }}>{sending ? 'Enviando…' : 'Solicitar ayuda'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ orgs, activeOrgId, setActiveOrgId, filter, setFilter, grants, user, onSignOut, tgLinked, onConnectTelegram }: {
  orgs: Organization[]; activeOrgId: string | null; setActiveOrgId: (id: string | null) => void
  filter: string; setFilter: (f: string) => void; grants: Grant[]; user: any; onSignOut: () => void
  tgLinked: boolean; onConnectTelegram: () => void
}) {
  const visibleByOrg = grants.filter(g => !activeOrgId || g.org_id === activeOrgId)
  const statCounts = (Object.keys(STATUS_META) as GrantStatus[]).reduce((acc, k) => {
    acc[k] = visibleByOrg.filter(g => g.status === k).length
    return acc
  }, {} as Record<string, number>)

  return (
    <aside style={{
      width: 240, flexShrink: 0, background: T.bgSidebar,
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      position: 'sticky', top: 0, alignSelf: 'flex-start',
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandMark size={34} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#FFF', letterSpacing: '-0.02em', fontFamily: FONT_DISPLAY, lineHeight: 1 }}>
              Dame<span style={{ color: T.gold }}>Perras</span>Perro
            </div>
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>El perro que encuentra las perras</div>
          </div>
        </div>
      </div>

      {/* Mis perfiles */}
      <div style={{ padding: '0 12px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 8px' }}>
          Mis perfiles
        </div>
        {orgs.length > 1 && (
          <button onClick={() => setActiveOrgId(null)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: !activeOrgId ? 'rgba(255,255,255,0.1)' : 'transparent', marginBottom: 2,
          }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <span style={{ fontSize: 13, color: !activeOrgId ? '#FFF' : 'rgba(255,255,255,0.55)', fontWeight: !activeOrgId ? 600 : 400 }}>Todas</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>{grants.length}</span>
          </button>
        )}
        {orgs.map(org => {
          const count = grants.filter(g => g.org_id === org.id).length
          const active = activeOrgId === org.id
          return (
            <button key={org.id} onClick={() => setActiveOrgId(org.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: active ? org.color + '30' : 'transparent', marginBottom: 2,
              outline: active ? `1px solid ${org.color}40` : 'none',
            }}>
              <span style={{ fontSize: 16 }}>{org.emoji}</span>
              <span style={{ fontSize: 13, color: active ? '#FFF' : 'rgba(255,255,255,0.6)', fontWeight: active ? 700 : 400, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {org.name}
              </span>
              {count > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
            </button>
          )
        })}
        <a href="/organizations" style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, boxSizing: 'border-box',
          padding: '8px 10px', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.15)',
          cursor: 'pointer', background: 'transparent', marginTop: 6, textDecoration: 'none',
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>+ Gestionar perfiles</span>
        </a>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 12px 16px' }} />

      {/* Estado filter */}
      <div style={{ padding: '0 12px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 8px' }}>
          Estado
        </div>
        {[['all', 'Todas'], ...(Object.entries(STATUS_META).map(([k, v]) => [k, v.label]) as [string, string][])].map(([k, label]) => {
          const count = k === 'all' ? visibleByOrg.length : (statCounts[k] || 0)
          if (k !== 'all' && count === 0) return null
          const active = filter === k
          const s = k !== 'all' ? STATUS_META[k as GrantStatus] : null
          return (
            <button key={k} onClick={() => setFilter(k)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: active ? 'rgba(255,255,255,0.1)' : 'transparent', marginBottom: 1,
            }}>
              {s && <span style={{ fontSize: 8, color: s.color }}>●</span>}
              <span style={{ fontSize: 13, flex: 1, textAlign: 'left', color: active ? '#FFF' : 'rgba(255,255,255,0.5)', fontWeight: active ? 600 : 400 }}>{label}</span>
              {count > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Bottom user area */}
      <div style={{ padding: '12px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Conectar Telegram */}
        <button onClick={onConnectTelegram} disabled={tgLinked} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          padding: '9px 10px', borderRadius: 8, border: 'none',
          cursor: tgLinked ? 'default' : 'pointer',
          background: tgLinked ? 'rgba(43,168,74,0.18)' : 'rgba(255,255,255,0.08)',
          color: tgLinked ? '#7BE0A0' : 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: 600,
          outline: tgLinked ? 'none' : '1px solid rgba(255,255,255,0.12)',
        }}>
          <span>{tgLinked ? '✅' : '🔗'}</span>
          {tgLinked ? 'Telegram conectado' : 'Conectar Telegram'}
        </button>

        {['daniel@gafasvan.com', 'daniel.paniagua.f@gmail.com'].includes((user?.email || '').toLowerCase()) && (
          <>
            <a href="/admin/leads" style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, textDecoration: 'none',
              padding: '9px 10px', borderRadius: 8, background: 'rgba(201,154,61,0.18)', color: '#DFC17A',
              fontSize: 12.5, fontWeight: 700, outline: '1px solid rgba(201,154,61,0.3)',
            }}>🤝 Leads (admin)</a>
            <a href="/admin/costs" style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, textDecoration: 'none',
              padding: '9px 10px', borderRadius: 8, background: 'rgba(201,154,61,0.18)', color: '#DFC17A',
              fontSize: 12.5, fontWeight: 700, outline: '1px solid rgba(201,154,61,0.3)',
            }}>💸 Costes (admin)</a>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: T.inkOnAccent }}>
            {(user?.email || 'A')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email || '—'}</div>
            <button onClick={onSignOut} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
function Topbar({ search, setSearch, onAdd, onAI }: { search: string; setSearch: (s: string) => void; onAdd: () => void; onAI: () => void }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: T.bg + 'EE', backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${T.border}`, padding: '12px 24px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ flex: 1, position: 'relative', maxWidth: 480 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: T.inkMuted, pointerEvents: 'none' }}>⌕</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar convocatorias…"
          style={{
            width: '100%', padding: '9px 14px 9px 36px', background: T.bgCard,
            border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 14, color: T.ink,
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = T.green; e.target.style.boxShadow = `0 0 0 3px ${T.greenSoft}` }}
          onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none' }}
        />
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={onAI} style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10,
        border: 'none', cursor: 'pointer', background: T.purpleSoft, color: T.purple, fontSize: 13, fontWeight: 700,
      }}>
        <span>🤖</span> Buscar con IA
      </button>
      <button onClick={onAdd} style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
        border: 'none', cursor: 'pointer', background: T.gold, color: T.inkOnAccent, fontSize: 13, fontWeight: 800,
        boxShadow: '0 2px 8px rgba(201,154,61,0.35)',
      }}>
        + Nueva
      </button>
    </div>
  )
}

// ─── STATS STRIP ──────────────────────────────────────────────────────────────
function StatsStrip({ grants, activeOrgId }: { grants: Grant[]; activeOrgId: string | null }) {
  const visible = grants.filter(g => !activeOrgId || g.org_id === activeOrgId)
  const urgent = visible.filter(g => {
    const d = daysLeft(g.plazo_solicitud)
    return d !== null && d >= 0 && d <= 14 && g.status !== 'descartada'
  }).length
  const active = visible.filter(g => !['descartada', 'resuelta_positiva', 'resuelta_negativa'].includes(g.status)).length
  const concedidas = visible.filter(g => g.status === 'resuelta_positiva').length

  const stats = [
    { label: 'Activas', value: active, color: T.gold, bg: T.goldSoft },
    urgent > 0 && { label: 'Urgentes (≤14d)', value: urgent, color: T.red, bg: T.redSoft },
    concedidas > 0 && { label: 'Concedidas', value: concedidas, color: T.green, bg: T.greenSoft },
  ].filter(Boolean) as { label: string; value: number; color: string; bg: string }[]

  return (
    <div style={{ display: 'flex', gap: 12, padding: '20px 24px 0', flexWrap: 'wrap' }}>
      {stats.map((stat, i) => (
        <div key={i} style={{
          padding: '10px 16px', borderRadius: 10, background: stat.bg,
          border: `1px solid ${stat.color}22`, display: 'flex', alignItems: 'baseline', gap: 8,
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: stat.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{stat.value}</span>
          <span style={{ fontSize: 12, color: stat.color, fontWeight: 600 }}>{stat.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── DETAIL PANEL (slide-in) ──────────────────────────────────────────────────
function DetailPanel({ grant, org, onClose, onEdit, onDelete, onStatusChange, onMemoria }: {
  grant: Grant; org?: Organization; onClose: () => void; onEdit: () => void
  onDelete: () => void; onStatusChange: (s: GrantStatus) => void; onMemoria: () => void
}) {
  const days = daysLeft(grant.plazo_solicitud)
  const u = urgency(days)
  const reqs = (grant.requisitos || '').split('\n').filter(Boolean)
  const docs = (grant.documentacion || '').split('\n').filter(Boolean)

  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: T.inkMuted,
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.35)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'relative', width: 'min(520px, 100vw)', background: T.bgCard,
        height: '100%', overflowY: 'auto', boxShadow: '-12px 0 48px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: T.inkLight }}>{TYPE_META[grant.tipo]?.icon} {TYPE_META[grant.tipo]?.label}</span>
                {org && <OrgTag org={org} />}
                {grant.auto_found && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: T.purpleSoft, color: T.purple, fontWeight: 700 }}>IA</span>}
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1.3 }}>{grant.titulo}</h2>
              {grant.organismo && <p style={{ margin: '6px 0 0', fontSize: 14, color: T.inkLight }}>{grant.organismo}</p>}
            </div>
            <button onClick={onClose} style={{ background: T.bg, border: 'none', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: T.inkLight, flexShrink: 0 }}>×</button>
          </div>

          {/* Status selector */}
          <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.entries(STATUS_META) as [GrantStatus, typeof STATUS_META[GrantStatus]][]).map(([k, v]) => (
              <button key={k} onClick={() => onStatusChange(k)} style={{
                padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: grant.status === k ? v.bg : 'transparent',
                color: grant.status === k ? v.color : T.inkMuted,
                fontSize: 11, fontWeight: grant.status === k ? 700 : 500,
                outline: grant.status === k ? `1.5px solid ${v.color}55` : '1px solid transparent',
                transition: 'all 0.15s',
              }}>{v.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22, flex: 1 }}>
          <button onClick={onMemoria} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 16px', borderRadius: 10, border: `1px solid ${T.purple}33`, cursor: 'pointer',
            background: T.purpleSoft, color: T.purple, fontSize: 14, fontWeight: 700,
          }}>
            {grant.memoria ? '📄 Ver memoria (IA)' : '✨ Prepárame una memoria con IA'}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {grant.importe_max && (
              <div style={{ padding: '14px 16px', background: T.bg, borderRadius: 10 }}>
                <div style={{ ...sectionLabel, marginBottom: 6 }}>Importe máximo</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.ink, letterSpacing: '-0.02em' }}>{grant.importe_max}</div>
              </div>
            )}
            {grant.plazo_solicitud && (
              <div style={{ padding: '14px 16px', background: u.tier >= 3 ? T.redSoft : T.bg, borderRadius: 10, border: u.tier >= 3 ? `1px solid ${T.red}33` : 'none' }}>
                <div style={{ ...sectionLabel, color: u.tier >= 3 ? T.red : T.inkMuted, marginBottom: 6 }}>Plazo solicitud</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: u.color, letterSpacing: '-0.01em' }}>
                  {new Date(grant.plazo_solicitud).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: u.color, marginTop: 2 }}>{u.tier > 0 ? `Quedan ${days} días` : 'Vencida'}</div>
              </div>
            )}
            {grant.cofinanciacion && (
              <div style={{ padding: '14px 16px', background: T.bg, borderRadius: 10 }}>
                <div style={{ ...sectionLabel, marginBottom: 6 }}>Cofinanciación</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{grant.cofinanciacion}</div>
              </div>
            )}
            {grant.plazo_ejecucion && (
              <div style={{ padding: '14px 16px', background: T.bg, borderRadius: 10 }}>
                <div style={{ ...sectionLabel, marginBottom: 6 }}>Fin ejecución</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
                  {new Date(grant.plazo_ejecucion).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            )}
          </div>

          {grant.match_reason && (
            <div style={{ padding: '10px 14px', background: T.purpleSoft, borderRadius: 8, fontSize: 13, color: T.purple }}>
              🤖 Encontrada por IA: {grant.match_reason}
            </div>
          )}

          {grant.elegibilidad && (
            <div>
              <div style={sectionLabel}>Elegibilidad</div>
              <div style={{ padding: '10px 14px', background: T.navySoft, borderRadius: 8, fontSize: 13, color: T.ink, fontWeight: 500 }}>{grant.elegibilidad}</div>
            </div>
          )}

          {grant.resumen && (
            <div>
              <div style={sectionLabel}>Resumen</div>
              <p style={{ margin: 0, fontSize: 14, color: T.inkMid, lineHeight: 1.7 }}>{grant.resumen}</p>
            </div>
          )}

          {reqs.length > 0 && (
            <div>
              <div style={sectionLabel}>Requisitos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {reqs.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: T.green, marginTop: 2, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: T.inkMid, lineHeight: 1.5 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {docs.length > 0 && (
            <div>
              <div style={sectionLabel}>Documentación requerida</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {docs.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: T.inkLight, marginTop: 2, flexShrink: 0 }}>📎</span>
                    <span style={{ fontSize: 13, color: T.inkMid, lineHeight: 1.5 }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {grant.notas && (
            <div>
              <div style={sectionLabel}>Notas</div>
              <div style={{ fontSize: 13, color: T.inkMid, padding: '10px 14px', background: T.bg, borderRadius: 8, fontStyle: 'italic', borderLeft: `3px solid ${T.borderMid}` }}>{grant.notas}</div>
            </div>
          )}

          {(grant.tags || []).length > 0 && (
            <div>
              <div style={sectionLabel}>Etiquetas</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {grant.tags!.map(t => (
                  <span key={t} style={{ padding: '4px 10px', borderRadius: 20, background: T.bg, border: `1px solid ${T.border}`, fontSize: 12, color: T.inkLight }}>#{t}</span>
                ))}
              </div>
            </div>
          )}

          {(grant.url || grant.url_bases) && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {grant.url && <a href={grant.url} target="_blank" rel="noreferrer" style={{ color: T.gold, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>🔗 Ver convocatoria ↗</a>}
              {grant.url_bases && <a href={grant.url_bases} target="_blank" rel="noreferrer" style={{ color: T.inkLight, fontSize: 13, textDecoration: 'none' }}>📋 Bases reguladoras ↗</a>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 10 }}>
          <button onClick={onDelete} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${T.red}`, cursor: 'pointer', background: 'transparent', color: T.red, fontSize: 13, fontWeight: 600 }}>Eliminar</button>
          <div style={{ flex: 1 }} />
          <button onClick={onEdit} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer', background: T.navy, color: '#FFF', fontSize: 13, fontWeight: 700 }}>Editar</button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL (formularios) ──────────────────────────────────────────────────────
function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bgCard, borderRadius: 14, width: '100%', maxWidth: wide ? 820 : 660, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}>
        {children}
      </div>
    </div>
  )
}

// ─── GRANT FORM ───────────────────────────────────────────────────────────────
function GrantForm({ initial, orgs, activeOrgId, onSave, onClose }: any) {
  const [tab, setTab] = useState('ia')
  const [input, setInput] = useState('')
  const [load, setLoad] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    titulo: '', organismo: '', tipo: 'publica', ambito: 'nacional',
    importe_max: '', importe_min: '', cofinanciacion: '',
    plazo_solicitud: '', plazo_ejecucion: '', fecha_publicacion: '',
    resumen: '', requisitos: '', documentacion: '',
    url: '', url_bases: '', elegibilidad: '',
    status: 'pendiente', prioridad: 2, notas: '',
    org_id: activeOrgId || '',
    ...initial,
    // tags se normaliza a string (la BD lo guarda como array)
    tags: Array.isArray(initial?.tags) ? initial.tags.join(', ') : (initial?.tags || ''),
  })
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }))

  async function handleAI() {
    if (!input.trim()) return
    setLoad(true); setErr('')
    try {
      const res = await fetch('/api/grants/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }) })
      const p = await res.json()
      if (!res.ok) throw new Error(p?.error || 'Error')
      setForm((f: any) => ({
        ...f,
        titulo: p.titulo || f.titulo, organismo: p.organismo || f.organismo,
        tipo: p.tipo || f.tipo, ambito: p.ambito || f.ambito,
        importe_max: p.importe_max || f.importe_max, importe_min: p.importe_min || f.importe_min,
        cofinanciacion: p.cofinanciacion || f.cofinanciacion,
        plazo_solicitud: p.plazo_solicitud || f.plazo_solicitud,
        plazo_ejecucion: p.plazo_ejecucion || f.plazo_ejecucion,
        fecha_publicacion: p.fecha_publicacion || f.fecha_publicacion,
        resumen: p.resumen || f.resumen,
        requisitos: Array.isArray(p.requisitos) ? p.requisitos.join('\n') : (p.requisitos || f.requisitos),
        documentacion: Array.isArray(p.documentacion) ? p.documentacion.join('\n') : (p.documentacion || f.documentacion),
        url: p.url || f.url, url_bases: p.url_bases || f.url_bases, elegibilidad: p.elegibilidad || f.elegibilidad,
      }))
      setTab('manual')
    } catch { setErr('No pude extraer la información. Añádela manualmente.') }
    finally { setLoad(false) }
  }

  const inp2: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${C.parchmentDark}`, borderRadius: 6, fontSize: 14, color: C.ink, background: C.white, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }
  const lbl2: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: C.slate, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }

  return (
    <div>
      <div style={{ padding: '20px 24px 0', borderBottom: `1px solid ${C.parchmentDark}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: C.navy }}>{initial?.id ? 'Editar' : 'Nueva'} convocatoria</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.slate }}>×</button>
        </div>
        <div style={{ display: 'flex' }}>
          {[['ia', '✨ Analizar con IA'], ['manual', '✏️ Manual']].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              borderBottom: tab === t ? `2px solid ${C.purple}` : '2px solid transparent',
              color: tab === t ? C.purple : C.slate, background: 'none',
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: 24 }}>
        {tab === 'ia' && (
          <div>
            <label style={lbl2}>URL o texto de la convocatoria</label>
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={6}
              placeholder={'https://www.boe.es/...\n\nO pega el texto aquí'}
              style={{ ...inp2, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
            {err && <p style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{err}</p>}
            <button onClick={handleAI} disabled={load || !input.trim()} style={{
              marginTop: 12, padding: '10px 24px', background: load ? C.muted : C.purple,
              color: C.white, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: load ? 'not-allowed' : 'pointer', width: '100%',
            }}>
              {load ? 'Analizando…' : '🤖 Analizar y extraer información'}
            </button>
          </div>
        )}
        {tab === 'manual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {orgs.length > 1 && (
              <div>
                <label style={lbl2}>Perfil de empresa</label>
                <select value={form.org_id} onChange={set('org_id')} style={inp2}>
                  <option value="">Sin perfil asignado</option>
                  {orgs.map((o: Organization) => <option key={o.id} value={o.id}>{o.emoji} {o.name}</option>)}
                </select>
              </div>
            )}
            <div><label style={lbl2}>Título *</label>
              <input value={form.titulo} onChange={set('titulo')} style={inp2} placeholder="Nombre oficial" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl2}>Organismo</label>
                <input value={form.organismo} onChange={set('organismo')} style={inp2} /></div>
              <div><label style={lbl2}>Tipo</label>
                <select value={form.tipo} onChange={set('tipo')} style={inp2}>
                  {Object.entries(TYPE_META).map(([k, v]: any) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl2}>Plazo solicitud</label>
                <input type="date" value={form.plazo_solicitud} onChange={set('plazo_solicitud')} style={inp2} /></div>
              <div><label style={lbl2}>Fin ejecución</label>
                <input type="date" value={form.plazo_ejecucion} onChange={set('plazo_ejecucion')} style={inp2} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl2}>Importe máximo</label>
                <input value={form.importe_max} onChange={set('importe_max')} style={inp2} placeholder="hasta 50.000 €" /></div>
              <div><label style={lbl2}>Cofinanciación empresa</label>
                <input value={form.cofinanciacion} onChange={set('cofinanciacion')} style={inp2} placeholder="30%" /></div>
            </div>
            <div><label style={lbl2}>Elegibilidad</label>
              <input value={form.elegibilidad} onChange={set('elegibilidad')} style={inp2} /></div>
            <div><label style={lbl2}>URL oficial</label>
              <input value={form.url} onChange={set('url')} style={inp2} placeholder="https://…" /></div>
            <div><label style={lbl2}>URL bases reguladoras</label>
              <input value={form.url_bases} onChange={set('url_bases')} style={inp2} placeholder="https://…" /></div>
            <div><label style={lbl2}>Resumen</label>
              <textarea value={form.resumen} onChange={set('resumen')} rows={3} style={{ ...inp2, resize: 'vertical' }} /></div>
            <div><label style={lbl2}>Requisitos (uno por línea)</label>
              <textarea value={form.requisitos} onChange={set('requisitos')} rows={3} style={{ ...inp2, resize: 'vertical' }} /></div>
            <div><label style={lbl2}>Documentación requerida (uno por línea)</label>
              <textarea value={form.documentacion} onChange={set('documentacion')} rows={2} style={{ ...inp2, resize: 'vertical' }}
                placeholder={'NIF/CIF\nMemoria técnica\nPresupuesto detallado'} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl2}>Estado</label>
                <select value={form.status} onChange={set('status')} style={inp2}>
                  {Object.entries(STATUS_META).map(([k, v]: any) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select></div>
              <div><label style={lbl2}>Prioridad</label>
                <select value={form.prioridad} onChange={e => setForm((f: any) => ({ ...f, prioridad: parseInt(e.target.value) }))} style={inp2}>
                  <option value={1}>🔴 Alta</option>
                  <option value={2}>🟡 Media</option>
                  <option value={3}>⚪ Baja</option>
                </select></div>
            </div>
            <div><label style={lbl2}>Etiquetas (separadas por comas)</label>
              <input value={form.tags} onChange={set('tags')} style={inp2} placeholder="digitalización, i+d, sostenibilidad" /></div>
            <div><label style={lbl2}>Notas</label>
              <textarea value={form.notas} onChange={set('notas')} rows={2} style={{ ...inp2, resize: 'vertical' }} /></div>
          </div>
        )}
      </div>
      <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '9px 20px', border: `1px solid ${C.parchmentDark}`, borderRadius: 8, background: 'none', color: C.slate, cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
        {tab === 'manual' && (
          <button onClick={() => onSave({
            ...form,
            tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
            prioridad: parseInt(form.prioridad as any) || 2,
          })} disabled={!form.titulo.trim()} style={{
            padding: '9px 24px', background: form.titulo.trim() ? C.green : C.muted, color: C.white,
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
            cursor: form.titulo.trim() ? 'pointer' : 'not-allowed',
          }}>Guardar</button>
        )}
      </div>
    </div>
  )
}

// ─── DISCOVERY PANEL ──────────────────────────────────────────────────────────
function DiscoveryPanel({ orgs, activeOrg, existingGrants, onAddGrant, onClose }: any) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(new Set<string>())
  const [selectedOrg, setSelectedOrg] = useState<Organization | undefined>(activeOrg || orgs[0])

  async function runSearch() {
    if (!selectedOrg) return
    setLoading(true); setError(''); setResults([]); setDone(false)
    try {
      const titles = existingGrants.filter((g: Grant) => g.org_id === selectedOrg.id).map((g: Grant) => g.titulo)
      const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org: selectedOrg, existingTitles: titles }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error')
      setResults(data.results || [])
      setDone(true)
    } catch { setError('Error al buscar. Inténtalo de nuevo.') }
    finally { setLoading(false) }
  }

  const scoreColor = (s: number) => s >= 80 ? C.green : s >= 60 ? C.amber : C.slate

  return (
    <div>
      <div style={{ background: T.bgSidebar, padding: '24px 24px 20px', borderRadius: '14px 14px 0 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: C.white }}>🤖 Búsqueda autónoma con IA</h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              Consulta BDNS · BOE · Boletín autonómico · Fondos europeos
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        {orgs.length > 1 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Buscar para:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {orgs.map((o: Organization) => (
                <button key={o.id} onClick={() => setSelectedOrg(o)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: selectedOrg?.id === o.id ? o.color : 'rgba(255,255,255,0.1)',
                  outline: selectedOrg?.id === o.id ? 'none' : '1px solid rgba(255,255,255,0.2)',
                }}>
                  <span style={{ fontSize: 14 }}>{o.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{o.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedOrg && (
          <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 8, fontSize: 12, color: 'rgba(255,255,255,0.65)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>📍 {selectedOrg.ccaa}</span>
            {selectedOrg.cnae && <span>CNAE: {selectedOrg.cnae}</span>}
            {selectedOrg.iae && <span>IAE: {selectedOrg.iae}</span>}
            {selectedOrg.empleados && <span>👥 {selectedOrg.empleados} emp.</span>}
          </div>
        )}
      </div>
      <div style={{ padding: 24 }}>
        {!done && !loading && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p style={{ color: C.slate, fontSize: 14, marginBottom: 24 }}>
              La IA buscará en fuentes oficiales convocatorias que encajan con el perfil de <strong>{selectedOrg?.name}</strong>.
            </p>
            <button onClick={runSearch} disabled={!selectedOrg} style={{ padding: '12px 32px', background: C.purple, color: C.white, border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Iniciar búsqueda
            </button>
          </div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
            <p style={{ color: C.slate, fontSize: 14, margin: 0 }}>Consultando fuentes oficiales…</p>
            <p style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>Puede tardar 15-30 segundos</p>
          </div>
        )}
        {error && <div style={{ padding: 16, background: C.redLight, borderRadius: 8, color: C.red, fontSize: 14 }}>{error}</div>}
        {done && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: C.slate }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🤷</div>
            <p>No se encontraron convocatorias abiertas ahora para este perfil.</p>
            <button onClick={runSearch} style={{ marginTop: 12, padding: '8px 20px', background: C.navy, color: C.white, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              Buscar de nuevo
            </button>
          </div>
        )}
        {results.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: C.navy, fontSize: 15 }}>{results.length} convocatorias encontradas</h3>
              <button onClick={runSearch} style={{ padding: '6px 14px', background: 'none', border: `1px solid ${C.parchmentDark}`, borderRadius: 8, fontSize: 12, color: C.slate, cursor: 'pointer' }}>
                🔄 Nueva búsqueda
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.map((r: any, i: number) => {
                const isAdded = added.has(r.titulo)
                return (
                  <div key={i} style={{ border: `1px solid ${C.parchmentDark}`, borderRadius: 12, overflow: 'hidden', background: isAdded ? T.greenSoft + '55' : C.white }}>
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
                            {TYPE_META[r.tipo as keyof typeof TYPE_META]?.icon} {r.organismo}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: C.navy, lineHeight: 1.3 }}>{r.titulo}</div>
                        </div>
                        <div style={{ textAlign: 'center', minWidth: 48 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(r.matchScore || 0) }}>{r.matchScore || '?'}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>match</div>
                        </div>
                      </div>
                      {r.importe_max && <div style={{ fontSize: 14, fontWeight: 800, color: C.ink, marginTop: 8 }}>{r.importe_max}</div>}
                      {r.matchReason && <div style={{ marginTop: 8, padding: '6px 10px', background: C.purpleLight, borderRadius: 6, fontSize: 12, color: C.purple }}>💡 {r.matchReason}</div>}
                      {r.resumen && <p style={{ margin: '10px 0 0', fontSize: 13, color: C.slate, lineHeight: 1.5 }}>{r.resumen}</p>}
                    </div>
                    <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.parchmentDark}`, display: 'flex', gap: 10, alignItems: 'center', background: C.parchment }}>
                      {r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.navy, textDecoration: 'none', fontWeight: 600 }}>🔗 Ver fuente</a>}
                      <div style={{ flex: 1 }} />
                      {isAdded
                        ? <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>✅ Añadida</span>
                        : <button onClick={() => { onAddGrant({ ...r, org_id: selectedOrg?.id }); setAdded(s => new Set([...s, r.titulo])) }}
                            style={{ padding: '7px 16px', background: C.navy, color: C.white, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            + Añadir
                          </button>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MEMORIA MODAL ────────────────────────────────────────────────────────────
function MemoriaModal({ state, onClose, onRegenerate }: {
  state: { loading: boolean; text: string; error: string }
  onClose: () => void; onRegenerate: () => void
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(state.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
  }
  function download() {
    const blob = new Blob([state.text], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'memoria.md'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: T.ink, fontFamily: FONT_DISPLAY }}>✨ Memoria — borrador</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: T.inkLight }}>Generada con IA. Revísala y complétala antes de presentarla.</p>
        </div>
        <button onClick={onClose} style={{ background: T.bg, border: 'none', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16, color: T.inkLight }}>×</button>
      </div>

      <div style={{ padding: '20px 24px', minHeight: 200 }}>
        {state.loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.inkLight }}>
            <div style={{ fontSize: 34, marginBottom: 12 }}>🐾</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Redactando tu memoria…</div>
            <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 4 }}>Suele tardar 10-20 segundos</div>
          </div>
        ) : state.error ? (
          <div style={{ padding: 16, background: T.redSoft, borderRadius: 8, color: T.red, fontSize: 14 }}>{state.error}</div>
        ) : (
          <div style={{
            whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.7, color: T.inkMid,
            fontFamily: FONT, background: T.bg, border: `1px solid ${T.border}`,
            borderRadius: 10, padding: '18px 20px', maxHeight: '58vh', overflowY: 'auto',
          }}>{state.text}</div>
        )}
      </div>

      {!state.loading && !state.error && (
        <div style={{ padding: '0 24px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onRegenerate} style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'none', color: T.inkMid, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🔄 Regenerar</button>
          <button onClick={download} style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'none', color: T.gold, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⬇ Descargar .md</button>
          <button onClick={copy} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: T.gold, color: T.inkOnAccent, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{copied ? '✓ Copiado' : 'Copiar'}</button>
        </div>
      )}
    </div>
  )
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [grants, setGrants] = useState<Grant[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<string | null>(null)
  const [selected, setSelected] = useState<Grant | null>(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [mode, setMode] = useState<'grants' | 'suggestions'>('grants')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loadingSug, setLoadingSug] = useState(false)
  const [savedSug, setSavedSug] = useState<Set<string>>(new Set())
  const [leadFor, setLeadFor] = useState<any>(null)
  const [memoria, setMemoria] = useState<{ open: boolean; loading: boolean; text: string; error: string } | null>(null)
  const [tgLinked, setTgLinked] = useState(false)
  const router = useRouter()
  const sb = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)
      const [{ data: orgsData }, { data: grantsData }] = await Promise.all([
        sb.from('organizations').select('*').eq('user_id', user.id).eq('is_archived', false).order('is_default', { ascending: false }).order('created_at'),
        sb.from('grants').select('*').eq('user_id', user.id).order('plazo_solicitud', { ascending: true, nullsFirst: false }),
      ])
      const orgsList = orgsData || []
      setOrgs(orgsList)
      setGrants(grantsData || [])
      const def = orgsList.find(o => o.is_default)
      if (def) setActiveOrgId(def.id)
      else if (orgsList.length > 0) setActiveOrgId(orgsList[0].id)
      const { data: profile } = await sb.from('users').select('telegram_id').eq('id', user.id).maybeSingle()
      setTgLinked(!!profile?.telegram_id)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback(async (updated: Grant[]) => { setGrants(updated) }, [])

  async function handleSaveGrant(form: any) {
    const orgId = form.org_id || activeOrgId || null
    // Solo aceptamos fechas con formato YYYY-MM-DD; '', 'null' o basura → null
    const dateOrNull = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null)
    const TIPOS = ['publica', 'concurso', 'privada', 'europeo']
    const AMBITOS = ['local', 'autonómico', 'nacional', 'europeo', 'internacional']
    const STATUSES = ['pendiente', 'revisada', 'en_proceso', 'presentada', 'resuelta_positiva', 'resuelta_negativa', 'descartada']
    const clean: any = {
      ...form, org_id: orgId,
      tipo: TIPOS.includes(form.tipo) ? form.tipo : 'publica',
      ambito: AMBITOS.includes(form.ambito) ? form.ambito : 'nacional',
      status: STATUSES.includes(form.status) ? form.status : 'pendiente',
      prioridad: [1, 2, 3].includes(parseInt(form.prioridad)) ? parseInt(form.prioridad) : 2,
      plazo_solicitud: dateOrNull(form.plazo_solicitud),
      plazo_ejecucion: dateOrNull(form.plazo_ejecucion),
      fecha_publicacion: dateOrNull(form.fecha_publicacion),
      resultado_fecha: dateOrNull(form.resultado_fecha),
    }
    if (form.id && grants.find(g => g.id === form.id)) {
      const { data, error } = await sb.from('grants').update(clean).eq('id', form.id).select().single()
      if (error) { alert('No se pudo guardar: ' + error.message); return }
      if (data) { persist(grants.map(g => g.id === form.id ? data : g)); setSelected(data) }
    } else {
      delete clean.id
      const { data, error } = await sb.from('grants').insert({ ...clean, user_id: user.id, source: 'manual' }).select().single()
      if (error) { alert('No se pudo guardar: ' + error.message); return }
      if (data) {
        persist([data, ...grants])
        // Llevar la vista a donde está la convocatoria recién guardada
        setMode('grants'); setFilter('all'); setSearch('')
        if (data.org_id) setActiveOrgId(data.org_id)
      }
    }
    setModal(null)
  }

  async function handleAddFromDiscovery(r: any) {
    const { data } = await sb.from('grants').insert({
      user_id: user.id, org_id: r.org_id || activeOrgId || null,
      titulo: r.titulo, organismo: r.organismo, tipo: r.tipo || 'publica',
      ambito: r.ambito || 'nacional', importe_max: r.importe_max,
      plazo_solicitud: r.plazo_solicitud || null, resumen: r.resumen,
      requisitos: Array.isArray(r.requisitos) ? r.requisitos.join('\n') : r.requisitos || '',
      url: r.url || '', elegibilidad: r.elegibilidad, status: 'pendiente',
      notas: `Encontrada automáticamente. ${r.matchReason || ''}`,
      auto_found: true, match_score: r.matchScore, match_reason: r.matchReason, source: 'ia_search',
    }).select().single()
    if (data) persist([data, ...grants])
  }

  async function handleDelete() {
    if (!selected) return
    await sb.from('grants').delete().eq('id', selected.id)
    persist(grants.filter(g => g.id !== selected.id))
    setModal(null); setSelected(null)
  }

  async function handleStatusChange(status: GrantStatus) {
    if (!selected) return
    await sb.from('grants').update({ status }).eq('id', selected.id)
    setSelected({ ...selected, status })
    persist(grants.map(g => g.id === selected.id ? { ...g, status } : g))
  }

  async function handleSignOut() {
    await sb.auth.signOut(); router.push('/auth')
  }

  async function handleConnectTelegram() {
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) { alert(data?.error || 'No se pudo generar el enlace de Telegram.'); return }
      window.open(data.url, '_blank')
    } catch { alert('No se pudo generar el enlace de Telegram.') }
  }

  const loadSuggestions = useCallback(async (orgId: string) => {
    setLoadingSug(true)
    try {
      const res = await fetch(`/api/suggestions?orgId=${orgId}`, { cache: 'no-store' })
      const data = await res.json()
      setSuggestions(res.ok ? (data.suggestions || []) : [])
    } catch { setSuggestions([]) }
    finally { setLoadingSug(false) }
  }, [])

  useEffect(() => {
    if (mode === 'suggestions' && activeOrgId) loadSuggestions(activeOrgId)
  }, [mode, activeOrgId, loadSuggestions])

  async function runMemoria(grantId: string) {
    setMemoria({ open: true, loading: true, text: '', error: '' })
    try {
      const res = await fetch('/api/memoria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grantId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Error')
      setMemoria({ open: true, loading: false, text: data.memoria, error: '' })
      setGrants(gs => gs.map(x => x.id === grantId ? { ...x, memoria: data.memoria } : x))
    } catch (e: any) {
      setMemoria({ open: true, loading: false, text: '', error: e?.message || 'No se pudo generar la memoria.' })
    }
  }

  function handleMemoria() {
    if (!selected) return
    const g = grants.find(x => x.id === selected.id) || selected
    if (g.memoria) setMemoria({ open: true, loading: false, text: g.memoria, error: '' })
    else runMemoria(g.id)
  }

  async function handleSaveSuggestion(c: any) {
    const grant = publicToGrant(c, activeOrgId, c.matchReason)
    const { data } = await sb.from('grants').insert({ ...grant, user_id: user.id }).select().single()
    if (data) {
      persist([data, ...grants])
      setSavedSug(s => new Set([...s, c.codigo_bdns]))
    }
  }

  function getOrg(orgId?: string | null) { return orgs.find(o => o.id === orgId) }

  const activeOrg = orgs.find(o => o.id === activeOrgId)

  const visibleByOrg = activeOrgId
    ? grants.filter(g => g.org_id === activeOrgId || (!g.org_id && orgs.length === 1))
    : grants

  const visible = visibleByOrg
    .filter(g => filter === 'all' || g.status === filter)
    .filter(g => !search || [g.titulo, g.organismo, g.resumen, g.elegibilidad].some(f => f && f.toLowerCase().includes(search.toLowerCase())))

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.inkMuted }}>Cargando…</div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: FONT, fontSize: 14 }}>
      <Sidebar orgs={orgs} activeOrgId={activeOrgId} setActiveOrgId={setActiveOrgId}
        filter={filter} setFilter={setFilter} grants={grants} user={user} onSignOut={handleSignOut}
        tgLinked={tgLinked} onConnectTelegram={handleConnectTelegram} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar search={search} setSearch={setSearch}
          onAdd={() => setModal('add')} onAI={() => setModal('discovery')} />

        {/* Mode tabs: mis convocatorias / sugeridas BDNS */}
        <div style={{ display: 'flex', gap: 6, padding: '16px 24px 0' }}>
          {([['grants', '📋 Mis convocatorias'], ['suggestions', '✨ Sugeridas para ti']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: mode === m ? (m === 'suggestions' ? T.purpleSoft : T.bgCard) : 'transparent',
              color: mode === m ? (m === 'suggestions' ? T.purple : T.ink) : T.inkLight,
              boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {mode === 'grants' ? (
          <>
            <StatsStrip grants={grants} activeOrgId={activeOrgId} />

            {/* Grid header */}
            <div style={{ padding: '16px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: T.inkLight }}>
                <strong style={{ color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{visible.length}</strong> convocatoria{visible.length !== 1 ? 's' : ''}
                {activeOrg && <> en <strong style={{ color: activeOrg.color }}>{activeOrg.emoji} {activeOrg.name}</strong></>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {([['grid', '⊞'], ['list', '☰']] as const).map(([v, icon]) => (
                  <button key={v} onClick={() => setView(v)} style={{
                    width: 32, height: 32, borderRadius: 7, border: 'none', cursor: 'pointer',
                    background: view === v ? T.goldSoft : 'transparent', color: view === v ? T.gold : T.inkMuted, fontSize: 14,
                  }}>{icon}</button>
                ))}
              </div>
            </div>

            {/* Grant grid/list */}
            <div style={{
              padding: '0 24px 32px',
              display: view === 'grid' ? 'grid' : 'flex',
              flexDirection: view === 'list' ? 'column' : undefined,
              gridTemplateColumns: view === 'grid' ? 'repeat(auto-fill, minmax(300px, 1fr))' : undefined,
              gap: 12,
            }}>
              {visible.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '72px 24px', color: T.inkMuted }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>{orgs.length === 0 ? '🏢' : '📭'}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.inkLight, marginBottom: 8 }}>
                    {orgs.length === 0 ? 'Sin perfiles aún'
                      : search ? 'Sin resultados para tu búsqueda'
                      : filter !== 'all' ? 'Sin convocatorias en este estado'
                      : 'Sin convocatorias aún'}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 20 }}>
                    {orgs.length === 0 ? 'Primero crea un perfil de empresa para organizar tus convocatorias.'
                      : search ? 'Prueba con otros términos'
                      : 'Añade una manualmente, pega un link o usa la búsqueda con IA.'}
                  </div>
                  {orgs.length === 0
                    ? <a href="/organizations" style={{ padding: '10px 24px', background: T.gold, color: T.inkOnAccent, borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>Crear perfil de empresa</a>
                    : !search && filter === 'all' && <button onClick={() => setModal('add')} style={{ padding: '10px 24px', background: T.gold, color: T.inkOnAccent, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>+ Añadir convocatoria</button>}
                </div>
              ) : visible.map(g => (
                <GrantCard key={g.id} grant={g} org={getOrg(g.org_id)} onClick={() => setSelected(g)} compact={view === 'list'} />
              ))}
            </div>
          </>
        ) : (
          /* Sugeridas para ti (catálogo BDNS) */
          <div style={{ padding: '16px 24px 32px' }}>
            <div style={{ fontSize: 13, color: T.inkLight, marginBottom: 14 }}>
              {!activeOrg ? 'Selecciona un perfil en la barra lateral para ver sugerencias.'
                : loadingSug ? 'Buscando convocatorias que encajan con tu perfil…'
                : <><strong style={{ color: T.ink }}>{suggestions.length}</strong> sugerencia{suggestions.length !== 1 ? 's' : ''} de la BDNS para <strong style={{ color: activeOrg.color }}>{activeOrg.emoji} {activeOrg.name}</strong> · <span style={{ color: T.inkMuted }}>abiertas, de tu CCAA o estatales</span></>}
            </div>
            {!activeOrg ? null : loadingSug ? (
              <div style={{ textAlign: 'center', padding: '56px 24px', color: T.inkMuted }}>⚙️ Cargando…</div>
            ) : suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 24px', color: T.inkMuted }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.inkLight, marginBottom: 8 }}>Sin sugerencias por ahora</div>
                <div style={{ fontSize: 13 }}>No hay convocatorias públicas abiertas que encajen con este perfil. Afina el CNAE/keywords del perfil o vuelve más adelante.</div>
              </div>
            ) : (() => {
              const sector = suggestions.filter(c => c.tier !== 'elegible')
              const elegibles = suggestions.filter(c => c.tier === 'elegible')
              const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 } as React.CSSProperties
              const head = (icon: string, txt: string, sub: string) => (
                <div style={{ margin: '4px 0 12px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{icon} {txt}</div>
                  <div style={{ fontSize: 12, color: T.inkMuted, marginTop: 2 }}>{sub}</div>
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                  <div>
                    {head('🎯', `Para tu sector (${sector.length})`, 'Afines a tu CNAE/IAE o a tu actividad.')}
                    {sector.length === 0
                      ? <div style={{ fontSize: 13, color: T.inkMuted, padding: '8px 0' }}>Ninguna específica de tu sector ahora mismo. Mira las de abajo: podrías optar igualmente.</div>
                      : <div style={grid}>{sector.map(c => <SuggestionCard key={c.codigo_bdns} c={c} saved={savedSug.has(c.codigo_bdns)} onSave={() => handleSaveSuggestion(c)} onLead={() => setLeadFor({ ...c, grant_titulo: c.titulo })} />)}</div>}
                  </div>
                  {elegibles.length > 0 && (
                    <div>
                      {head('🤝', `También podrías optar (${elegibles.length})`, 'No son de tu sector, pero están abiertas a tu tipo de entidad y en tu zona.')}
                      <div style={grid}>{elegibles.map(c => <SuggestionCard key={c.codigo_bdns} c={c} saved={savedSug.has(c.codigo_bdns)} onSave={() => handleSaveSuggestion(c)} onLead={() => setLeadFor({ ...c, grant_titulo: c.titulo })} />)}</div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </main>

      {/* LEAD (solicitar gestoría) */}
      {leadFor && <LeadModal item={leadFor} user={user} onClose={() => setLeadFor(null)} />}

      {/* DETAIL PANEL (slide-in) */}
      {selected && modal !== 'edit' && (
        <DetailPanel
          grant={grants.find(g => g.id === selected.id) || selected}
          org={getOrg(selected.org_id)}
          onClose={() => setSelected(null)}
          onEdit={() => setModal('edit')}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onMemoria={handleMemoria}
        />
      )}

      {/* MODALS */}
      {modal === 'add' && (
        <Modal onClose={() => setModal(null)}>
          <GrantForm orgs={orgs} activeOrgId={activeOrgId} onSave={handleSaveGrant} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'edit' && selected && (
        <Modal onClose={() => setModal(null)}>
          <GrantForm initial={selected} orgs={orgs} activeOrgId={selected.org_id || activeOrgId}
            onSave={handleSaveGrant} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'discovery' && (
        <Modal onClose={() => setModal(null)} wide>
          <DiscoveryPanel orgs={orgs} activeOrg={activeOrg} existingGrants={grants}
            onAddGrant={handleAddFromDiscovery} onClose={() => setModal(null)} />
        </Modal>
      )}
      {memoria?.open && (
        <Modal onClose={() => setMemoria(null)} wide>
          <MemoriaModal state={memoria} onClose={() => setMemoria(null)}
            onRegenerate={() => selected && runMemoria(selected.id)} />
        </Modal>
      )}
    </div>
  )
}
