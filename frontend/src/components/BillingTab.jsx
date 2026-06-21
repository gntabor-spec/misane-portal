import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

const fmt = (ts) => ts ? new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null

// Billing tab — see plan status & next charge, update payment method, cancel.
export default function BillingTab({ client, preview }) {
  const [b, setB] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!preview) api.getBilling().then(setB).catch((e) => setErr(e.message)) }, [preview])

  if (preview) return (
    <div className="card" style={{ marginTop: 18, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 8 }}>Your plan &amp; billing</h3>
      <p className="muted">In the client’s login this shows their next billing date, card on file, an “Update payment method” button (Stripe portal), and a “Cancel plan” button.</p>
    </div>
  )

  async function manage() {
    setBusy(true)
    try { const r = await api.billingPortal(); window.location.href = r.url } catch (e) { alert(e.message); setBusy(false) }
  }
  async function cancel() {
    if (!confirm('Cancel your plan? It ends at the close of the current period; your last payment covers the coming month.')) return
    try { await api.cancelSub(client.id); alert('Cancellation requested — we’ll confirm by email.') } catch (e) { alert(e.message) }
  }

  if (err) return <div className="error" style={{ marginTop: 18 }}>{err}</div>
  if (!b) return <p className="muted" style={{ marginTop: 18 }}>Loading…</p>

  return (
    <div className="card" style={{ marginTop: 18, maxWidth: 560 }}>
      <h3 style={{ marginBottom: 12 }}>Your plan &amp; billing</h3>
      {b.has_subscription ? (
        <>
          <p><b>Plan:</b> {b.amount}</p>
          {b.next_billing_date && <p style={{ marginTop: 6 }}><b>Next billing date:</b> {fmt(b.next_billing_date)}</p>}
          {b.card_last4 && <p style={{ marginTop: 6 }}><b>Card on file:</b> •••• {b.card_last4}</p>}
          <p className="muted" style={{ marginTop: 10 }}>
            You can cancel anytime after the first three months — your last payment covers the coming month.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button className="btn btn-navy" onClick={manage} disabled={busy}>Update payment method ↗</button>
            <button className="btn btn-line" onClick={cancel}>Cancel plan</button>
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            “Update payment method” opens our secure billing portal, where you can change your card, view invoices, or cancel.
          </p>
        </>
      ) : (
        <p className="muted">
          No active billing yet. Your $100/month begins after you approve your plan and the $500 build fee is paid —
          you’ll see your billing date and payment options here once it’s active.
        </p>
      )}
    </div>
  )
}
