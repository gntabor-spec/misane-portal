import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import AdminOverview from '../components/AdminOverview.jsx'

const EMPTY = { name: '', email: '', phone: '', property_address: '', domain: '', scenario: 'fsbo' }
const STATUSES = ['intake', 'building', 'preview', 'approved', 'live', 'maintenance', 'cancelled']

export default function AdminDashboard() {
  const { logout } = useAuth()
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [invite, setInvite] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    try { setClients(await api.listClients()) } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    try { await api.createClient(form); setForm(EMPTY); load() } catch (ex) { setErr(ex.message) }
  }
  async function doInvite(cid) {
    const email = prompt('Client email for their login?')
    if (!email) return
    try { setInvite(await api.invite(cid, email)) } catch (ex) { alert(ex.message) }
  }
  async function remove(cid, name) {
    if (!confirm(`Delete "${name}"? This removes the client and any login for it. This can't be undone.`)) return
    try { await api.deleteClient(cid); load() } catch (ex) { alert(ex.message) }
  }
  async function changeStatus(cid, status) {
    try { await api.setStatus(cid, status); load() } catch (ex) { alert(ex.message) }
  }
  async function checkout(cid, kind) {
    try {
      const r = kind === 'signup' ? await api.checkoutSignup(cid) : await api.checkoutApproval(cid)
      window.open(r.url, '_blank')   // opens the Stripe checkout; copy the URL to send to the client
    } catch (ex) { alert(ex.message) }
  }

  return (
    <div className="wrap">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <img src="/logo-horizontal.png" alt="Misane Properties" style={{ height: 34 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <a className="btn btn-line" href="https://misaneproperties.com" target="_blank" rel="noopener">Misane site ↗</a>
          <button className="btn btn-line" onClick={logout}>Sign out</button>
        </div>
      </header>
      <h1 style={{ marginBottom: 16 }}>Dashboard</h1>
      <AdminOverview />
      <h2 style={{ marginBottom: 4 }}>Clients</h2>
      {err && <div className="error">{err}</div>}
      {invite && (
        <div className="card" style={{ margin: '14px 0', background: 'var(--greige)' }}>
          Invite created — send these to the client: <b>{invite.email}</b> &middot; temp password <b>{invite.temp_password}</b>
          <button className="btn btn-line" style={{ marginLeft: 12 }} onClick={() => setInvite(null)}>Dismiss</button>
        </div>
      )}
      <form onSubmit={add} className="card" style={{ margin: '16px 0', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, alignItems: 'end' }}>
        <div><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label>Property address</label><input value={form.property_address} onChange={(e) => setForm({ ...form, property_address: e.target.value })} /></div>
        <div><label>Domain</label><input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="3545uniformst.com" /></div>
        <div><label>Scenario</label><select value={form.scenario} onChange={(e) => setForm({ ...form, scenario: e.target.value })}><option value="fsbo">FSBO</option><option value="realtor">Realtor</option></select></div>
        <button className="btn btn-navy" style={{ gridColumn: '1 / -1' }}>Add client</button>
      </form>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--hairline)' }}>
            <th style={{ padding: 12 }}>Name</th><th>Domain</th><th>Scenario</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <td style={{ padding: 12 }}><Link to={`/admin/clients/${c.id}`} style={{ color: 'var(--brass)', fontWeight: 600 }}>{c.name}</Link></td><td>{c.domain || '—'}</td><td>{c.scenario}</td>
                <td>
                  <select value={c.status} onChange={(e) => changeStatus(c.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-line" onClick={() => doInvite(c.id)}>Invite</button>{' '}
                  <button className="btn btn-line" onClick={() => checkout(c.id, 'signup')}>$100</button>{' '}
                  <button className="btn btn-line" onClick={() => checkout(c.id, 'approval')}>$500</button>{' '}
                  <button className="btn btn-line" style={{ color: 'var(--danger)' }} onClick={() => remove(c.id, c.name)}>Delete</button>
                </td>
              </tr>
            ))}
            {!clients.length && <tr><td colSpan="5" style={{ padding: 16 }} className="muted">No clients yet — add one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
