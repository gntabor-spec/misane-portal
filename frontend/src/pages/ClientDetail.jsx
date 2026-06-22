import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import ClientContacts from '../components/ClientContacts.jsx'
import ClientSubmissions from '../components/ClientSubmissions.jsx'

export default function ClientDetail() {
  const { id } = useParams()
  const { logout } = useAuth()
  const [c, setC] = useState(null)
  const [form, setForm] = useState(null)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)

  async function load() {
    try {
      const d = await api.getClient(id)
      setC(d)
      setForm({
        name: d.name || '', email: d.email || '', phone: d.phone || '',
        property_address: d.property_address || '', domain: d.domain || '',
        scenario: d.scenario || 'fsbo', commission_pct: d.commission_pct || '',
        plan_embed_url: d.plan_embed_url || '', draft_url: d.draft_url || '',
      })
    } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [id])

  async function save(e) {
    e.preventDefault()
    setSaved(false); setErr('')
    try { await api.updateClient(id, form); setSaved(true); load() } catch (ex) { setErr(ex.message) }
  }

  if (!c || !form) return <div className="wrap">{err ? <div className="error">{err}</div> : 'Loading…'}</div>

  return (
    <div className="wrap">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <img src="/logo-horizontal.png" alt="Misane Properties" style={{ height: 34 }} />
        <button className="btn btn-line" onClick={logout}>Sign out</button>
      </header>
      <Link to="/admin" style={{ fontSize: 13 }}>&larr; All clients</Link>
      <h1 style={{ marginTop: 8 }}>{c.name}</h1>
      <p className="muted">Status: {c.status} &middot; {c.scenario}{c.domain ? ` · ${c.domain}` : ''}</p>
      <Link className="btn btn-line" to={`/admin/clients/${id}/preview`} style={{ marginTop: 10 }}>Preview portal (what the client sees)</Link>

      <div className="card" style={{ marginTop: 16, maxWidth: 720 }}>
        <h3 style={{ marginBottom: 10 }}>Quick contact</h3>
        {c.email ? <p><a href={`mailto:${c.email}`}>{c.email}</a></p> : <p className="muted">No email on file</p>}
        {c.phone ? <p style={{ marginTop: 4 }}><a href={`tel:${c.phone}`}>{c.phone}</a></p> : <p className="muted" style={{ marginTop: 4 }}>No phone on file</p>}
      </div>

      <ClientContacts cid={id} client={c} />

      <form onSubmit={save} className="card" style={{ marginTop: 16, maxWidth: 720 }}>
        <h3 style={{ marginBottom: 14 }}>Contact &amp; details</h3>
        <label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <label style={{ marginTop: 12 }}>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label style={{ marginTop: 12 }}>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <label style={{ marginTop: 12 }}>Property address</label><input value={form.property_address} onChange={(e) => setForm({ ...form, property_address: e.target.value })} />
        <label style={{ marginTop: 12 }}>Domain</label><input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="3545uniformst.com" />
        <label style={{ marginTop: 12 }}>Draft site URL <span className="muted" style={{ fontWeight: 400 }}>— shown on the Review stage (set status to "preview")</span></label>
        <input value={form.draft_url} onChange={(e) => setForm({ ...form, draft_url: e.target.value })} placeholder="https://draft.3545uniformst.com or a staging link" />
        <label style={{ marginTop: 12 }}>Buyer-agent commission % <span className="muted" style={{ fontWeight: 400 }}>— the owner can also set this in their portal</span></label>
        <input value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} placeholder="e.g. 2.5%" />
        <label style={{ marginTop: 12 }}>Published plan URL <span className="muted" style={{ fontWeight: 400 }}>— the produced plan shown in their portal</span></label>
        <input value={form.plan_embed_url} onChange={(e) => setForm({ ...form, plan_embed_url: e.target.value })} placeholder="/plans/3545/" />
        {err && <div className="error">{err}</div>}
        {saved && <div style={{ color: 'var(--green)', fontSize: 13, marginTop: 8 }}>Saved.</div>}
        <button className="btn btn-navy" style={{ marginTop: 16 }}>Save</button>
      </form>

      <ClientSubmissions cid={id} />
    </div>
  )
}
