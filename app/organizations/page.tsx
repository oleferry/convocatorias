'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Organization, TipoEntidad } from '@/lib/types'
import { CCAA, TIPO_ENTIDAD_META, ORG_COLORS } from '@/lib/types'
import { T, FONT } from '@/lib/theme'

const C = { navy:T.navy,amber:T.amber,amberLight:T.amberSoft,
  slate:T.inkLight,muted:T.inkMuted,white:T.bgCard,
  parchment:T.bg,parchmentDark:T.border,ink:T.ink,
  red:T.red,green:T.green,greenLight:T.greenSoft,purple:T.purple,gold:T.gold }

const inp: React.CSSProperties = { width:'100%',padding:'9px 11px',
  border:`1px solid ${C.parchmentDark}`,borderRadius:7,fontSize:14,
  color:C.ink,background:C.white,boxSizing:'border-box',outline:'none',fontFamily:'inherit' }
const lbl: React.CSSProperties = { fontSize:11,fontWeight:600,color:C.slate,
  textTransform:'uppercase',letterSpacing:'0.04em',display:'block',marginBottom:4 }

const EMOJIS = ['🏢','🏭','👤','🚀','💻','🛠️','📊','🌿','🎨','🏥','🎓','🌍']

// ── Catálogos oficiales (INE), servidos desde /public/data ──────
type CnaeItem = { c: string; d: string }
type ProvItem = { id: string; n: string; ccaa: string }
type MuniItem = { id: string; p: string; n: string }

function useCatalogs() {
  const [cnae, setCnae] = useState<CnaeItem[]>([])
  const [iae, setIae] = useState<CnaeItem[]>([])
  const [prov, setProv] = useState<ProvItem[]>([])
  const [muni, setMuni] = useState<MuniItem[]>([])
  useEffect(() => {
    let on = true
    Promise.all([
      fetch('/data/cnae.json').then(r => r.json()),
      fetch('/data/iae.json').then(r => r.json()),
      fetch('/data/provincias.json').then(r => r.json()),
      fetch('/data/municipios.json').then(r => r.json()),
    ]).then(([c, i, p, m]) => { if (on) { setCnae(c); setIae(i); setProv(p); setMuni(m) } }).catch(() => {})
    return () => { on = false }
  }, [])
  return { cnae, iae, prov, muni }
}

// Multi-selector con buscador (por código o por actividad). Sirve para CNAE e IAE.
function CatalogMultiSelect({ all, value, onChange, placeholder, loadingLabel }: { all: CnaeItem[]; value: string[]; onChange: (v: string[]) => void; placeholder: string; loadingLabel: string }) {
  const [q, setQ] = useState('')
  const sel = value.map(code => all.find(x => x.c === code)).filter(Boolean) as CnaeItem[]
  const term = q.trim().toLowerCase()
  const matches = term.length >= 2
    ? all.filter(x => !value.includes(x.c) && (x.c.startsWith(term) || x.d.toLowerCase().includes(term))).slice(0, 30)
    : []
  return (
    <div>
      {sel.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {sel.map(x => (
            <span key={x.c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 8, background: C.amberLight, color: C.ink, fontSize: 12, fontWeight: 600 }}>
              <b>{x.c}</b> {x.d.length > 38 ? x.d.slice(0, 38) + '…' : x.d}
              <button onClick={() => onChange(value.filter(v => v !== x.c))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.slate, fontSize: 14, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <input value={q} onChange={e => setQ(e.target.value)} style={inp}
        placeholder={all.length ? placeholder : loadingLabel} />
      {matches.length > 0 && (
        <div style={{ border: `1px solid ${C.parchmentDark}`, borderRadius: 7, marginTop: 4, maxHeight: 220, overflowY: 'auto', background: C.white }}>
          {matches.map(x => (
            <button key={x.c} onClick={() => { onChange([...value, x.c]); setQ('') }} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 11px', border: 'none',
              borderBottom: `1px solid ${C.parchment}`, background: 'none', cursor: 'pointer', fontSize: 13, color: C.ink,
            }}><b>{x.c}</b> — {x.d}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function OrgForm({ initial, onSave, onClose }: { initial?: Partial<Organization>, onSave: (d:any)=>void, onClose:()=>void }) {
  const { cnae: cnaeAll, iae: iaeAll, prov: provAll, muni: muniAll } = useCatalogs()
  const [form, setForm] = useState({
    name: initial?.name || '',
    tipo_entidad: (initial?.tipo_entidad || 'pyme') as TipoEntidad,
    ccaa: initial?.ccaa || '',
    provincia: initial?.provincia || '',
    municipio: initial?.municipio || '',
    cnaes: (initial?.cnaes && initial.cnaes.length ? initial.cnaes : (initial?.cnae ? [initial.cnae] : [])) as string[],
    iaes: (initial?.iaes && initial.iaes.length ? initial.iaes : (initial?.iae ? [initial.iae] : [])) as string[],
    empleados: initial?.empleados?.toString() || '',
    facturacion: initial?.facturacion || '',
    anio_constitucion: initial?.anio_constitucion?.toString() || '',
    actividad: initial?.actividad || '',
    keywords: initial?.keywords || '',
    color: initial?.color || ORG_COLORS[0],
    emoji: initial?.emoji || '🏢',
  })
  const set = (k:string) => (e:any) => setForm(f=>({...f,[k]:e.target.value}))

  // Municipios de la provincia seleccionada
  const provId = provAll.find(p => p.n === form.provincia)?.id
  const munis = provId ? muniAll.filter(m => m.p === provId) : []
  function pickProvincia(name: string) {
    const p = provAll.find(x => x.n === name)
    setForm(f => ({ ...f, provincia: name, ccaa: p?.ccaa || f.ccaa, municipio: '' }))
  }

  return (
    <div style={{padding:24}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h2 style={{margin:0,fontSize:18,color:C.navy}}>{initial?.id?'Editar perfil':'Nuevo perfil de empresa'}</h2>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.slate}}>×</button>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {/* Identidad visual */}
        <div>
          <label style={lbl}>Icono y color identificativo</label>
          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
            {EMOJIS.map(e=>(
              <button key={e} onClick={()=>setForm(f=>({...f,emoji:e}))} style={{
                fontSize:22,padding:6,borderRadius:8,border:'none',cursor:'pointer',
                background:form.emoji===e?C.amberLight:'transparent',
                outline:form.emoji===e?`2px solid ${C.amber}`:'none'
              }}>{e}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
            {ORG_COLORS.map(col=>(
              <button key={col} onClick={()=>setForm(f=>({...f,color:col}))} style={{
                width:28,height:28,borderRadius:'50%',background:col,border:'none',cursor:'pointer',
                outline:form.color===col?`3px solid ${C.amber}`:'3px solid transparent',outlineOffset:2
              }}/>
            ))}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{gridColumn:'1/-1'}}>
            <label style={lbl}>Nombre del perfil *</label>
            <input value={form.name} onChange={set('name')} style={inp}
              placeholder="Mi SL, Consultoría X, Autónomo…"/>
          </div>
          <div>
            <label style={lbl}>Tipo de entidad</label>
            <select value={form.tipo_entidad} onChange={set('tipo_entidad')} style={inp}>
              {Object.entries(TIPO_ENTIDAD_META).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Provincia</label>
            <select value={form.provincia} onChange={e=>pickProvincia(e.target.value)} style={inp}>
              <option value="">Selecciona provincia…</option>
              {provAll.map(p=><option key={p.id} value={p.n}>{p.n}</option>)}
            </select>
            {form.ccaa && <p style={{margin:'4px 0 0',fontSize:11,color:C.muted}}>CCAA: {form.ccaa}</p>}
          </div>
          <div>
            <label style={lbl}>Municipio</label>
            <select value={form.municipio} onChange={set('municipio')} style={inp} disabled={!provId}>
              <option value="">{provId ? 'Selecciona municipio…' : 'Elige provincia primero'}</option>
              {munis.map(m=><option key={m.id} value={m.n}>{m.n}</option>)}
            </select>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={lbl}>CNAE (puedes elegir varios)</label>
            <CatalogMultiSelect all={cnaeAll} value={form.cnaes} onChange={cnaes=>setForm(f=>({...f,cnaes}))}
              placeholder="Busca por código o actividad (ej. 6201 o «programación»)…" loadingLabel="Cargando catálogo CNAE…"/>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={lbl}>IAE (epígrafe — puedes elegir varios)</label>
            <CatalogMultiSelect all={iaeAll} value={form.iaes} onChange={iaes=>setForm(f=>({...f,iaes}))}
              placeholder="Busca por epígrafe o actividad (ej. 659.3 u «óptica»)…" loadingLabel="Cargando catálogo IAE…"/>
            <p style={{margin:'4px 0 0',fontSize:11,color:C.muted}}>CNAE e IAE se usan juntos para afinar qué convocatorias te encajan.</p>
          </div>
          <div>
            <label style={lbl}>Empleados</label>
            <input type="number" value={form.empleados} onChange={set('empleados')} style={inp} placeholder="12"/>
          </div>
          <div>
            <label style={lbl}>Facturación anual</label>
            <input value={form.facturacion} onChange={set('facturacion')} style={inp} placeholder="&lt; 2M€"/>
          </div>
          <div>
            <label style={lbl}>Año de constitución</label>
            <input type="number" value={form.anio_constitucion} onChange={set('anio_constitucion')} style={inp} placeholder="2018"/>
          </div>
        </div>

        <div>
          <label style={lbl}>Descripción de la actividad (para la IA)</label>
          <textarea value={form.actividad} onChange={set('actividad')} rows={3}
            placeholder="Describe en detalle qué hace la empresa. Más detalle = mejores resultados de búsqueda."
            style={{...inp,resize:'vertical'}}/>
        </div>
        <div>
          <label style={lbl}>Palabras clave adicionales</label>
          <input value={form.keywords} onChange={set('keywords')} style={inp}
            placeholder="digitalización, exportación, I+D, sostenibilidad, contratación pública…"/>
          <p style={{margin:'4px 0 0',fontSize:11,color:C.muted}}>Separadas por comas. Mejoran la búsqueda autónoma.</p>
        </div>

        <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:8}}>
          <button onClick={onClose} style={{padding:'9px 20px',border:`1px solid ${C.parchmentDark}`,
            borderRadius:6,background:'none',color:C.slate,cursor:'pointer',fontSize:14}}>Cancelar</button>
          <button onClick={()=>onSave({...form,
            empleados:form.empleados?parseInt(form.empleados):null,
            anio_constitucion:form.anio_constitucion?parseInt(form.anio_constitucion):null,
            cnae: form.cnaes[0] || null,
            cnae_desc: cnaeAll.find(x=>x.c===form.cnaes[0])?.d || null,
            iae: form.iaes[0] || null,
            iae_desc: iaeAll.find(x=>x.c===form.iaes[0])?.d || null,
          })} disabled={!form.name.trim()} style={{padding:'9px 24px',
            background:form.name.trim()?C.navy:C.muted,color:C.white,border:'none',
            borderRadius:6,fontSize:14,fontWeight:700,cursor:form.name.trim()?'pointer':'not-allowed'}}>
            Guardar perfil
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OrganizationsPage() {
  const [orgs,    setOrgs]    = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Organization>|null>(null)
  const [creating,setCreating]= useState(false)
  const [saved,   setSaved]   = useState('')
  const router = useRouter()
  const sb = createClient()

  useEffect(()=>{
    async function load() {
      const {data:{user}} = await sb.auth.getUser()
      if(!user){router.push('/auth');return}
      const {data} = await sb.from('organizations').select('*').eq('user_id',user.id).order('is_default',{ascending:false}).order('created_at')
      setOrgs(data||[])
      setLoading(false)
    }
    load()
  },[])

  async function handleSave(form:any) {
    const {data:{user}} = await sb.auth.getUser()
    if(!user) return
    if (editing?.id) {
      const {data} = await sb.from('organizations').update(form).eq('id',editing.id).select().single()
      setOrgs(orgs.map(o=>o.id===editing.id?data:o))
      setSaved(editing.id)
    } else {
      const isFirst = orgs.length===0
      const {data} = await sb.from('organizations').insert({...form,user_id:user.id,is_default:isFirst}).select().single()
      setOrgs([...orgs,data])
      setSaved(data.id)
    }
    setEditing(null); setCreating(false)
    setTimeout(()=>setSaved(''),3000)
  }

  async function handleSetDefault(orgId:string) {
    await sb.from('organizations').update({is_default:true}).eq('id',orgId)
    setOrgs(orgs.map(o=>({...o,is_default:o.id===orgId})))
  }

  async function handleDelete(orgId:string) {
    if(!confirm('¿Eliminar este perfil y todas sus convocatorias?')) return
    await sb.from('organizations').delete().eq('id',orgId)
    setOrgs(orgs.filter(o=>o.id!==orgId))
  }

  if(loading) return <div style={{padding:64,textAlign:'center',color:C.muted}}>Cargando…</div>

  return (
    <div style={{minHeight:'100vh',background:C.parchment,fontFamily:FONT}}>
      <div style={{background:C.navy,padding:'20px 24px'}}>
        <div style={{maxWidth:720,margin:'0 auto',display:'flex',alignItems:'center',gap:16}}>
          <a href="/dashboard" style={{color:'rgba(255,255,255,0.5)',textDecoration:'none',fontSize:20}}>←</a>
          <div style={{flex:1}}>
            <h1 style={{margin:0,fontSize:20,color:C.white,fontWeight:800}}>🏢 Mis perfiles de empresa</h1>
            <p style={{margin:'4px 0 0',fontSize:13,color:'rgba(255,255,255,0.5)'}}>
              Cada perfil tiene su propio CNAE, IAE y búsquedas independientes
            </p>
          </div>
          <button onClick={()=>setCreating(true)} style={{padding:'9px 18px',background:C.gold,
            color:C.ink,border:'none',borderRadius:8,fontSize:13,fontWeight:800,cursor:'pointer'}}>
            + Nuevo perfil
          </button>
        </div>
      </div>

      <div style={{maxWidth:720,margin:'0 auto',padding:24}}>
        {orgs.length===0 && !creating && (
          <div style={{textAlign:'center',padding:'64px 24px'}}>
            <div style={{fontSize:48,marginBottom:12}}>🏢</div>
            <h3 style={{color:C.navy,margin:'0 0 8px'}}>Sin perfiles aún</h3>
            <p style={{color:C.slate,fontSize:14,margin:'0 0 24px'}}>
              Crea tu primer perfil de empresa para empezar a gestionar convocatorias.
            </p>
            <button onClick={()=>setCreating(true)} style={{padding:'10px 24px',background:C.gold,
              color:C.ink,border:'none',borderRadius:6,fontSize:14,fontWeight:800,cursor:'pointer'}}>
              Crear primer perfil
            </button>
          </div>
        )}

        {(creating || editing) && (
          <div style={{background:C.white,borderRadius:12,boxShadow:'0 4px 24px rgba(27,42,74,0.1)',marginBottom:20}}>
            <OrgForm
              initial={editing||undefined}
              onSave={handleSave}
              onClose={()=>{setCreating(false);setEditing(null)}}/>
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {orgs.map(org=>(
            <div key={org.id} style={{background:C.white,borderRadius:12,overflow:'hidden',
              border:`1px solid ${C.parchmentDark}`,
              boxShadow:saved===org.id?`0 0 0 2px ${C.amber}`:'none',
              transition:'box-shadow 0.3s'}}>
              <div style={{display:'flex',alignItems:'center',gap:14,padding:'16px 20px'}}>
                {/* Color + emoji */}
                <div style={{width:48,height:48,borderRadius:12,background:org.color,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:22,flexShrink:0}}>
                  {org.emoji}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:16,fontWeight:700,color:C.navy}}>{org.name}</span>
                    {org.is_default&&<span style={{padding:'2px 8px',background:C.amberLight,
                      color:C.amber,fontSize:11,fontWeight:700,borderRadius:10}}>activo</span>}
                    {saved===org.id&&<span style={{fontSize:12,color:C.green}}>✅ Guardado</span>}
                  </div>
                  <div style={{fontSize:12,color:C.slate,marginTop:3,display:'flex',gap:12,flexWrap:'wrap'}}>
                    <span>{TIPO_ENTIDAD_META[org.tipo_entidad]}</span>
                    <span>📍 {org.ccaa}</span>
                    {org.cnae&&<span>CNAE: {org.cnae}</span>}
                    {org.iae&&<span>IAE: {org.iae}</span>}
                    {org.empleados&&<span>👥 {org.empleados}</span>}
                  </div>
                  {org.actividad&&<p style={{margin:'6px 0 0',fontSize:12,color:C.muted,
                    display:'-webkit-box',WebkitLineClamp:1,WebkitBoxOrient:'vertical',
                    overflow:'hidden'} as any}>{org.actividad}</p>}
                </div>
                <div style={{display:'flex',gap:8,flexShrink:0}}>
                  {!org.is_default&&(
                    <button onClick={()=>handleSetDefault(org.id)} style={{padding:'6px 12px',
                      background:'none',border:`1px solid ${C.parchmentDark}`,
                      borderRadius:6,fontSize:12,color:C.slate,cursor:'pointer'}}>
                      Activar
                    </button>
                  )}
                  <button onClick={()=>setEditing(org)} style={{padding:'6px 12px',
                    background:C.navy,color:C.white,border:'none',
                    borderRadius:6,fontSize:12,cursor:'pointer'}}>Editar</button>
                  <button onClick={()=>handleDelete(org.id)} style={{padding:'6px 12px',
                    background:'none',border:`1px solid ${C.red}`,
                    borderRadius:6,fontSize:12,color:C.red,cursor:'pointer'}}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {orgs.length>0&&(
          <div style={{marginTop:20,padding:14,background:'#E8EDF5',borderRadius:8,
            fontSize:13,color:C.navy}}>
            💡 El perfil <strong>activo</strong> es el que se usa por defecto al añadir convocatorias y al hacer la búsqueda autónoma con IA.
            Puedes cambiar el perfil activo desde el dashboard en cualquier momento.
          </div>
        )}
      </div>
    </div>
  )
}
