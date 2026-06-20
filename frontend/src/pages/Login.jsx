import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    try {
      const u = await login(email, pw)
      nav(u.role === 'admin' ? '/admin' : '/portal')
    } catch (ex) {
      setErr(ex.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} className="card" style={{ width: 380 }}>
        <img src="/logo-horizontal.png" alt="Misane Properties" style={{ height: 38, marginBottom: 18 }} />
        <div className="kicker" style={{ marginBottom: 16 }}>Client Portal</div>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label style={{ marginTop: 12 }}>Password</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <div className="error">{err}</div>}
        <button className="btn btn-navy" style={{ width: '100%', marginTop: 18 }}>Sign in</button>
      </form>
    </div>
  )
}
