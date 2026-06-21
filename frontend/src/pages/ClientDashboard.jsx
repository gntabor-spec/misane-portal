import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import ClientPortalView from '../components/ClientPortalView.jsx'
import UpdateForm from '../components/UpdateForm.jsx'

export default function ClientDashboard() {
  const { user, logout } = useAuth()
  const c = user?.client
  const [tab, setTab] = useState('plan')
  let plan = null
  try { plan = c?.plan_published ? JSON.parse(c.plan_published) : null } catch { plan = null }

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

      <div className="tabs">
        <button className={`tab ${tab === 'plan' ? 'tab-on' : ''}`} onClick={() => setTab('plan')}>Marketing plan</button>
        <button className={`tab ${tab === 'update' ? 'tab-on' : ''}`} onClick={() => setTab('update')}>Send an update</button>
      </div>

      {tab === 'plan'
        ? <ClientPortalView client={c} plan={plan} onCancel={cancel} />
        : <UpdateForm />}
    </div>
  )
}
