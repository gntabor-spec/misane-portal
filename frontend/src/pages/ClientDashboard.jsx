import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'

export default function ClientDashboard() {
  const { user, logout } = useAuth()
  const c = user?.client

  async function cancel() {
    if (!confirm('Cancel your subscription? It ends at the close of the current period; your last payment covers the coming month.')) return
    try { await api.cancelSub(c.id); alert('Cancellation requested — we’ll confirm by email.') } catch (ex) { alert(ex.message) }
  }

  return (
    <div className="wrap">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <img src="/logo-horizontal.png" alt="Misane Properties" style={{ height: 34 }} />
        <button className="btn btn-line" onClick={logout}>Sign out</button>
      </header>
      <div className="kicker">Client Portal</div>
      <h1 style={{ marginTop: 6 }}>{c?.name || 'Your property'}</h1>
      {c?.property_address && <p className="muted" style={{ marginTop: 6 }}>{c.property_address}</p>}
      <div className="card" style={{ marginTop: 18 }}>
        <p><b>Status:</b> {c?.status || 'intake'}</p>
        <p className="muted" style={{ marginTop: 8 }}>
          Your dashboard — intake, preview & approval, downloads, photos, and your subscription —
          appears here as we move through your setup.
        </p>
        {c?.stripe_subscription && (
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-line" onClick={cancel}>Cancel subscription</button>
          </div>
        )}
      </div>
    </div>
  )
}
