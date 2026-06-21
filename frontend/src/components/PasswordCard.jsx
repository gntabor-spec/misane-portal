import { useState } from 'react'
import { api } from '../api/client.js'

export default function PasswordCard({ preview }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')

  async function save(e) {
    e.preventDefault(); setMsg('')
    if (preview) { setMsg('Preview only — interactive in the client’s login.'); return }
    if (pw.length < 8) { setMsg('Use at least 8 characters.'); return }
    if (pw !== pw2) { setMsg('Passwords don’t match.'); return }
    try { await api.changePassword(pw); setMsg('Password updated.'); setPw(''); setPw2('') } catch (ex) { setMsg(ex.message) }
  }

  return (
    <form onSubmit={save} className="card" style={{ marginTop: 16, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 12 }}>Change password</h3>
      <label>New password</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <label style={{ marginTop: 12 }}>Confirm new password</label><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: msg === 'Password updated.' ? 'var(--green)' : 'var(--danger)' }}>{msg}</div>}
      <button className="btn btn-navy" style={{ marginTop: 14 }}>Update password</button>
    </form>
  )
}
