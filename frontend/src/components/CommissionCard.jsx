import { useState } from 'react'
import { api } from '../api/client.js'

// Client-editable buyer-agent commission. The owner controls what they offer agents.
export default function CommissionCard({ client, preview }) {
  const [val, setVal] = useState(client?.commission_pct || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function save() {
    if (preview) { setMsg('Preview only — this is interactive in the client’s login.'); return }
    setBusy(true); setMsg('')
    try {
      await api.setCommission(val)
      setMsg('Saved — we’ll reflect this on your agent materials.')
    } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ marginTop: 16, maxWidth: 720 }}>
      <h3 style={{ marginBottom: 6 }}>Buyer’s agent commission</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        What you’ll offer an agent who brings your buyer. Most for-sale-by-owner sellers offer around 2.5% —
        it brings more qualified buyers while you still save the listing side. Change it anytime.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input style={{ maxWidth: 160 }} value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. 2.5%" />
        <button className="btn btn-navy" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {msg && <div style={{ color: 'var(--green)', fontSize: 13, marginTop: 10 }}>{msg}</div>}
    </div>
  )
}
