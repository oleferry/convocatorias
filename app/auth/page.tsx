'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { T, FONT, FONT_DISPLAY } from '@/lib/theme'

const C = { navy:T.navy,amber:T.amber,white:T.bgCard,parchment:T.bg,ink:T.ink,
  slate:T.inkLight,red:T.red,parchmentDark:T.border,green:T.green,gold:T.gold }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthPage() {
  const [mode,setMode]       = useState<'login'|'register'|'forgot'>('login')
  const [email,setEmail]     = useState('')
  const [pass,setPass]       = useState('')
  const [name,setName]       = useState('')
  const [loading,setLoading] = useState(false)
  const [error,setError]     = useState('')
  const [ok,setOk]           = useState('')
  const [justRegistered,setJustRegistered] = useState(false)
  const [resending,setResending] = useState(false)
  const router = useRouter()
  const sb = createClient()

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('confirmado') === '0') {
      setError('No pudimos completar la confirmación automáticamente. Si tu cuenta ya está verificada, entra con tu email y contraseña.')
    }
  }, [])

  async function submit() {
    setError(''); setOk('')
    if (!EMAIL_RE.test(email)) return setError('Revisa el email, no parece válido.')
    if (mode === 'register' && pass.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.')

    setLoading(true)
    try {
      if (mode==='register') {
        const {error:e} = await sb.auth.signUp({email,password:pass,options:{
          data:{full_name:name},
          emailRedirectTo:`${window.location.origin}/auth/callback`,
        }})
        if(e) throw e
        setOk('¡Cuenta creada! Revisa tu email (y la carpeta de spam/promociones) y pulsa el enlace para confirmar.')
        setJustRegistered(true)
      } else if (mode === 'forgot') {
        const {error:e} = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
        })
        if(e) throw e
        setOk('Si ese email tiene una cuenta, te hemos mandado un enlace para elegir una contraseña nueva. Revisa también spam.')
      } else {
        const {error:e} = await sb.auth.signInWithPassword({email,password:pass})
        if(e) throw e
        router.push('/dashboard')
      }
    } catch(e:any) { setError(e.message||'Error') }
    finally { setLoading(false) }
  }

  async function resendConfirmation() {
    setResending(true); setError('')
    try {
      const {error:e} = await sb.auth.resend({ type: 'signup', email, options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }})
      if (e) throw e
      setOk('Te hemos mandado el email de confirmación otra vez. Puede tardar un par de minutos.')
    } catch (e: any) { setError(e.message || 'Error') }
    finally { setResending(false) }
  }

  const inp: React.CSSProperties = { width:'100%',padding:'10px 12px',
    border:`1px solid ${C.parchmentDark}`,borderRadius:8,fontSize:15,outline:'none',
    boxSizing:'border-box',fontFamily:'inherit',color:C.ink,background:C.white }
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
              <img src="/logo.png?v=2" alt="DamePerrasPerro" width={58} height={58}
                style={{width:'100%',height:'100%',objectFit:'cover'}}
                onError={(e)=>{const t=e.currentTarget;t.style.display='none';const p=t.parentElement;if(p)p.textContent='🐶'}}/>
            </div>
          </div>
          <h1 style={{margin:0,fontSize:26,color:C.ink,fontWeight:800,fontFamily:FONT_DISPLAY,letterSpacing:'-0.02em'}}>
            Dame<span style={{color:C.gold}}>Perras</span>Perro
          </h1>
          <p style={{margin:'8px 0 0',fontSize:14,color:C.slate}}>El perro que encuentra las perras 🐾</p>
        </div>
        {mode === 'forgot' ? (
          <div style={{marginBottom:20}}>
            <h2 style={{margin:'0 0 4px',fontSize:17,fontWeight:800,color:C.ink}}>Recuperar contraseña</h2>
            <p style={{margin:0,fontSize:13,color:C.slate}}>Te mandamos un enlace para elegir una nueva.</p>
          </div>
        ) : (
          <div style={{display:'flex',marginBottom:24,borderRadius:8,overflow:'hidden',
            border:`1px solid ${C.parchmentDark}`}}>
            {(['login','register'] as const).map(m=>(
              <button key={m} onClick={()=>{setMode(m);setError('');setOk('');setJustRegistered(false)}} style={{flex:1,padding:'10px',border:'none',
                cursor:'pointer',background:mode===m?C.gold:C.white,
                color:mode===m?T.inkOnAccent:C.slate,fontSize:14,fontWeight:600}}>
                {m==='login'?'Entrar':'Registrarse'}
              </button>
            ))}
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          {mode==='register'&&(
            <div><label style={lbl}>Nombre</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" style={inp}/></div>
          )}
          <div><label style={lbl}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="tu@email.com" style={inp}
              onKeyDown={e=>e.key==='Enter'&&mode==='forgot'&&submit()}/></div>
          {mode!=='forgot'&&(
            <div><label style={lbl}>Contraseña</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
                placeholder="Mínimo 8 caracteres" style={inp}
                onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
          )}
          {mode==='login'&&(
            <button onClick={()=>{setMode('forgot');setError('');setOk('')}} style={{alignSelf:'flex-end',
              background:'none',border:'none',padding:0,fontSize:12.5,color:C.slate,cursor:'pointer',textDecoration:'underline'}}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {error&&<div style={{padding:10,background:T.redSoft,borderRadius:6,fontSize:13,color:C.red}}>{error}</div>}
          {ok&&<div style={{padding:10,background:T.greenSoft,borderRadius:6,fontSize:13,color:C.green}}>{ok}</div>}
          {justRegistered&&(
            <button onClick={resendConfirmation} disabled={resending} style={{background:'none',border:'none',
              padding:0,fontSize:12.5,color:C.slate,cursor:resending?'not-allowed':'pointer',textDecoration:'underline',alignSelf:'flex-start'}}>
              {resending?'Enviando…':'¿No te ha llegado? Reenviar email de confirmación'}
            </button>
          )}
          <button onClick={submit} disabled={loading||!email||(mode!=='forgot'&&!pass)} style={{padding:'12px',
            background:loading?C.slate:C.gold,color:T.inkOnAccent,border:'none',borderRadius:8,
            fontSize:15,fontWeight:800,cursor:loading?'not-allowed':'pointer',marginTop:4}}>
            {loading?'Cargando…':mode==='login'?'Entrar':mode==='register'?'Crear cuenta':'Enviar enlace de recuperación'}
          </button>
          {mode==='forgot'&&(
            <button onClick={()=>{setMode('login');setError('');setOk('')}} style={{background:'none',border:'none',
              padding:0,fontSize:12.5,color:C.slate,cursor:'pointer',textDecoration:'underline',alignSelf:'center'}}>
              ← Volver a entrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
