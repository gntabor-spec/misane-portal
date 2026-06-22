import { useState } from 'react'
import ReviewStage from './ReviewStage.jsx'
import AccountTab from './AccountTab.jsx'
import PlanTab from './PlanTab.jsx'
import ImagesTab from './ImagesTab.jsx'
import RequestChangesTab from './RequestChangesTab.jsx'

const TABS = [
  ['account', 'Account'],
  ['plan', 'Marketing plan'],
  ['images', 'Images'],
  ['changes', 'Request changes'],
]
const LIVE = ['live', 'maintenance', 'cancelling']

// Stage-driven client portal body. Used by the real client (ClientDashboard) and the admin Preview.
export default function PortalBody({ client, preview = false, onApprove }) {
  const [tab, setTab] = useState('account')
  const status = client?.status || 'intake'

  if (status === 'cancelled') {
    return <div className="card" style={{ marginTop: 18 }}>
      <h3>This plan has ended.</h3>
      <p className="muted" style={{ marginTop: 6 }}>Portal access is closed. To relist, reach out to greg@misaneproperties.com.</p>
    </div>
  }
  if (status === 'intake' || status === 'building') {
    return <div className="card" style={{ marginTop: 18 }}>
      <h3>We’re building your site.</h3>
      <p className="muted" style={{ marginTop: 6 }}>Thanks for getting started. We’ll email you the moment your draft is ready to review here.</p>
    </div>
  }
  if (status === 'preview') {
    return <ReviewStage client={client} preview={preview} onApprove={onApprove} />
  }
  if (!LIVE.includes(status)) {
    return <div className="card" style={{ marginTop: 18 }}><p className="muted">Status: {status}</p></div>
  }
  return (
    <>
      <div className="tabs" style={{ marginTop: 16 }}>
        {TABS.map(([k, label]) => (
          <button key={k} className={`tab ${tab === k ? 'tab-on' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'account' && <AccountTab client={client} preview={preview} />}
      {tab === 'plan' && <PlanTab client={client} />}
      {tab === 'images' && <ImagesTab preview={preview} client={client} />}
      {tab === 'changes' && <RequestChangesTab preview={preview} />}
    </>
  )
}
