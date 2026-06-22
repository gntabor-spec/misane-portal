import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'

// Shown on first login (must_change_pw) — the owner must set their own password to continue.
export default function ForcePassword() {
  const { logout, refresh } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (pw.length < 8) return setErr('Use at least 8 characters.')
    if (pw !== pw2) return setErr('Passwords don’t match.')
    setBusy(true)
    try { await api.changePassword(pw); await refresh() } catch (ex) { setErr(ex.message); setBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} className="card" style={{ width: 400 }}>
        <img src="/logo-horizontal.png" alt="Misane Properties" style={{ height: 38, marginBottom: 18 }} />
        <div className="kicker" style={{ marginBottom: 8 }}>Welcome</div>
        <h3 style={{ marginBottom: 8 }}>Set your password</h3>
        <p className="muted" style={{ marginBottom: 16 }}>For your security, please choose a new password to finish setting up your account.</p>
        <label>New password</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <label style={{ marginTop: 12 }}>Confirm new password</label>
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <button className="btn btn-navy" style={{ width: '100%', marginTop: 18 }} disabled={busy}>{busy ? 'Saving…' : 'Set password & continue'}</button>
        <button type="button" className="btn btn-line" style={{ width: '100%', marginTop: 10 }} onClick={logout}>Sign out</button>
      </form>
    </div>
  )
}
