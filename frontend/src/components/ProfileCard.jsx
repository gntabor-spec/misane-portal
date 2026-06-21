import { useState } from 'react'
import { api } from '../api/client.js'

export default function ProfileCard({ client, preview }) {
  const [f, setF] = useState({ name: client?.name || '', phone: client?.phone || '', property_address: client?.property_address || '' })
  const [msg, setMsg] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function save(e) {
    e.preventDefault(); setMsg('')
    if (preview) { setMsg('Preview only — interactive in the client’s login.'); return }
    try { await api.updateProfile(f); setMsg('Saved.') } catch (ex) { setMsg(ex.message) }
  }

  return (
    <form onSubmit={save} className="card" style={{ marginTop: 16, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 12 }}>Your information</h3>
      <label>Name</label><input value={f.name} onChange={set('name')} />
      <label style={{ marginTop: 12 }}>Email</label>
      <input value={client?.email || ''} disabled style={{ background: 'var(--greige)' }} />
      <label style={{ marginTop: 12 }}>Phone</label><input value={f.phone} onChange={set('phone')} />
      <label style={{ marginTop: 12 }}>Property address</label><input value={f.property_address} onChange={set('property_address')} />
      {msg && <div style={{ color: 'var(--green)', fontSize: 13, marginTop: 8 }}>{msg}</div>}
      <button className="btn btn-navy" style={{ marginTop: 14 }}>Save</button>
    </form>
  )
}
