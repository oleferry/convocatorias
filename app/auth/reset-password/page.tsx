'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { T, FONT, FONT_DISPLAY } from '@/lib/theme'

const C = { navy:T.navy,amber:T.amber,white:T.bgCard,parchment:T.bg,ink:T.ink,
  slate:T.inkLight,red:T.red,parchmentDark:T.border,green:T.green,gold:T.gold }

export default function ResetPasswordPage() {
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const router = useRouter()
  const sb = createClient()

  useEffect(() => {
    // El enlace del email ya vino a través de /auth/callback, que dejó una
    // sesión de recuperación activa — solo comprobamos que exista.
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) setError('Este enlace ya no es válido. Pide uno nuevo desde "¿Olvidaste tu contraseña?".')
      setReady(true)
    })
  }, [])

  async function submit() {
    setError('')
    if (pass.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.')
    if (pass !== pass2) return setError('Las dos contraseñas no coinciden.')
    setLoading(true)
    try {
      const { error: e } = await sb.auth.updateUser({ password: pass })
      if (e) throw e
      setOk(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (e: any) { setError(e.message || 'Error') }
    finally { setLoading(false) }
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
        <h1 style={{margin:'0 0 4px',fontSize:22,color:C.ink,fontWeight:800,fontFamily:FONT_DISPLAY}}>
          Nueva contraseña
        </h1>
        <p style={{margin:'0 0 24px',fontSize:14,color:C.slate}}>Elige una contraseña nueva para tu cuenta.</p>

        {!ready ? (
          <div style={{fontSize:14,color:C.slate}}>Comprobando el enlace…</div>
        ) : ok ? (
          <div style={{padding:10,background:T.greenSoft,borderRadius:6,fontSize:13,color:C.green}}>
            ✅ Contraseña actualizada. Entrando…
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div><label style={lbl}>Nueva contraseña</label>
              <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
                placeholder="Mínimo 8 caracteres" style={inp}/></div>
            <div><label style={lbl}>Repite la contraseña</label>
              <input type="password" value={pass2} onChange={e=>setPass2(e.target.value)}
                placeholder="Repite la contraseña" style={inp}
                onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
            {error && <div style={{padding:10,background:T.redSoft,borderRadius:6,fontSize:13,color:C.red}}>{error}</div>}
            <button onClick={submit} disabled={loading||!pass||!pass2} style={{padding:'12px',
              background:loading?C.slate:C.gold,color:T.inkOnAccent,border:'none',borderRadius:8,
              fontSize:15,fontWeight:800,cursor:loading?'not-allowed':'pointer',marginTop:4}}>
              {loading?'Guardando…':'Guardar contraseña'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
