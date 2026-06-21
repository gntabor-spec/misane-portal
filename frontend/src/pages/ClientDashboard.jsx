import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import PlanTab from '../components/PlanTab.jsx'
import ImagesTab from '../components/ImagesTab.jsx'
import RequestChangesTab from '../components/RequestChangesTab.jsx'
import BillingTab from '../components/BillingTab.jsx'

const TABS = [
  ['plan', 'Marketing plan'],
  ['images', 'Images'],
  ['changes', 'Request changes'],
  ['billing', 'Billing'],
]

export default function ClientDashboard() {
  const { user, logout } = useAuth()
  const c = user?.client
  const [tab, setTab] = useState('plan')

  async function approve() {
    if (!confirm('Approve your draft and continue to the $500 build fee?')) return
    try { const r = await api.checkoutApproval(c.id); window.location.href = r.url } catch (ex) { alert(ex.message) }
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

      <div className="kicker">Client Portal</div>
      <h1 style={{ marginTop: 6 }}>{c?.name || 'Your property'}</h1>
      {c?.property_address && <p className="muted" style={{ marginTop: 6 }}>{c.property_address}</p>}
      {c?.domain && (
        <p style={{ marginTop: 6 }}><b>Your site:</b> <a href={`https://${c.domain}`} target="_blank" rel="noopener">{c.domain}</a></p>
      )}

      <div className="tabs" style={{ marginTop: 16 }}>
        {TABS.map(([k, label]) => (
          <button key={k} className={`tab ${tab === k ? 'tab-on' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'plan' && <PlanTab client={c} onApprove={approve} />}
      {tab === 'images' && <ImagesTab />}
      {tab === 'changes' && <RequestChangesTab />}
      {tab === 'billing' && <BillingTab client={c} />}
    </div>
  )
}
