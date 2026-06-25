'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { T, FONT, FONT_DISPLAY } from '@/lib/theme'

const C = { navy:T.navy,amber:T.amber,white:T.bgCard,parchment:T.bg,ink:T.ink,
  slate:T.inkLight,red:T.red,parchmentDark:T.border,green:T.green,gold:T.gold }

export default function AuthPage() {
  const [mode,setMode]       = useState<'login'|'register'>('login')
  const [email,setEmail]     = useState('')
  const [pass,setPass]       = useState('')
  const [name,setName]       = useState('')
  const [loading,setLoading] = useState(false)
  const [error,setError]     = useState('')
  const [ok,setOk]           = useState('')
  const router = useRouter()
  const sb = createClient()

  async function submit() {
    setLoading(true); setError(''); setOk('')
    try {
      if (mode==='register') {
        const {error:e} = await sb.auth.signUp({email,password:pass,options:{data:{full_name:name}}})
        if(e) throw e
        setOk('¡Cuenta creada! Revisa tu email para confirmar.')
      } else {
        const {error:e} = await sb.auth.signInWithPassword({email,password:pass})
        if(e) throw e
        router.push('/dashboard')
      }
    } catch(e:any) { setError(e.message||'Error') }
    finally { setLoading(false) }
  }

  const inp: React.CSSProperties = { width:'100%',padding:'10px 12px',
    border:`1px solid ${C.parchmentDark}`,borderRadius:8,fontSize:15,outline:'none',
    boxSizing:'border-box',fontFamily:'inherit',color:C.navy }
  const lbl: React.CSSProperties = { fontSize:12,fontWeight:600,color:C.slate,
    display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em' }

  return (
    <div style={{minHeight:'100vh',background:C.parchment,display:'flex',
      alignItems:'center',justifyContent:'center',padding:16,fontFamily:FONT}}>
      <div style={{background:C.white,borderRadius:16,padding:40,width:'100%',maxWidth:420,
        boxShadow:'0 8px 40px rgba(27,42,74,0.12)'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
            <div style={{width:58,height:58,borderRadius:14,background:C.gold,display:'flex',
              alignItems:'center',justifyContent:'center',overflow:'hidden',fontSize:32}}>
              <img src="/logo.png" alt="DamePerrasPerro" width={58} height={58}
                style={{width:'100%',height:'100%',objectFit:'cover'}}
                onError={(e)=>{const t=e.currentTarget;t.style.display='none';const p=t.parentElement;if(p)p.textContent='🐶'}}/>
            </div>
          </div>
          <h1 style={{margin:0,fontSize:26,color:C.navy,fontWeight:800,fontFamily:FONT_DISPLAY,letterSpacing:'-0.02em'}}>
            Dame<span style={{color:C.gold}}>Perras</span>Perro
          </h1>
          <p style={{margin:'8px 0 0',fontSize:14,color:C.slate}}>El perro que encuentra las perras 🐾</p>
        </div>
        <div style={{display:'flex',marginBottom:24,borderRadius:8,overflow:'hidden',
          border:`1px solid ${C.parchmentDark}`}}>
          {(['login','register'] as const).map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:'10px',border:'none',
              cursor:'pointer',background:mode===m?C.navy:C.white,
              color:mode===m?C.white:C.slate,fontSize:14,fontWeight:600}}>
              {m==='login'?'Entrar':'Registrarse'}
            </button>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {mode==='register'&&(
            <div><label style={lbl}>Nombre</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" style={inp}/></div>
          )}
          <div><label style={lbl}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="tu@email.com" style={inp}/></div>
          <div><label style={lbl}>Contraseña</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
              placeholder="Mínimo 8 caracteres" style={inp}
              onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
          {error&&<div style={{padding:10,background:T.redSoft,borderRadius:6,fontSize:13,color:C.red}}>{error}</div>}
          {ok&&<div style={{padding:10,background:T.greenSoft,borderRadius:6,fontSize:13,color:C.green}}>{ok}</div>}
          <button onClick={submit} disabled={loading||!email||!pass} style={{padding:'12px',
            background:loading?C.slate:C.gold,color:loading?C.white:C.ink,border:'none',borderRadius:8,
            fontSize:15,fontWeight:800,cursor:loading?'not-allowed':'pointer',marginTop:4}}>
            {loading?'Cargando…':mode==='login'?'Entrar':'Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  )
}
