import { useState } from 'react'
import { api } from '../api/client.js'

// Stage 2: client reviews their draft (non-public) site, then approves → $500, or sends feedback.
export default function ReviewStage({ client, onApprove }) {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  async function sendFeedback(e) {
    e.preventDefault()
    if (!msg.trim()) { setErr('Add your feedback first.'); return }
    setBusy(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('message', msg); fd.append('kind', 'feedback')
      await api.submitUpdate(fd)
      setSent(true); setMsg('')
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 6 }}>Review your draft site</h3>
        {client?.draft_url ? (
          <>
            <p className="muted" style={{ marginBottom: 14 }}>
              Here’s your draft website — it’s not public yet. Take a look, then approve it below or send changes.
            </p>
            <a className="btn btn-navy" href={client.draft_url} target="_blank" rel="noopener">View your draft site ↗</a>
          </>
        ) : (
          <p className="muted">Your draft is being prepared — we’ll email you the moment it’s ready to review here.</p>
        )}
      </div>

      {client?.draft_url && (
        <div className="card" style={{ marginTop: 14, background: 'var(--navy)', color: '#e7ebf6', border: 'none' }}>
          <h3 style={{ color: '#fff', marginBottom: 6 }}>Happy with it?</h3>
          <p style={{ color: '#cfd6ea', marginBottom: 14 }}>
            Approve to continue to the $500 build fee — then we buy your domain, take the site live, and build your marketing plan.
          </p>
          <button className="btn btn-gold" onClick={onApprove}>Approve &amp; continue to $500</button>
        </div>
      )}

      <form onSubmit={sendFeedback} className="card" style={{ marginTop: 14, maxWidth: 720 }}>
        <h3 style={{ marginBottom: 6 }}>Send feedback / request changes</h3>
        {sent ? (
          <p style={{ color: 'var(--green)' }}>Thanks — we’ve got your feedback and we’ll update your draft.</p>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>Want something different before you approve? Tell us and we’ll do another round.</p>
            <textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. Love it — can we lead with the aerial photo and make the price bigger?" style={{ resize: 'vertical' }} />
            {err && <div className="error">{err}</div>}
            <button className="btn btn-navy" style={{ marginTop: 12 }} disabled={busy}>{busy ? 'Sending…' : 'Send feedback'}</button>
          </>
        )}
      </form>
    </div>
  )
}
