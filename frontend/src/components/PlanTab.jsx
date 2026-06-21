import CommissionCard from './CommissionCard.jsx'

// Marketing Plan tab. The full plan opens as its OWN page (no nested iframe / scrollbars).
export default function PlanTab({ client, onApprove }) {
  const c = client
  return (
    <div>
      {c?.status === 'preview' && (
        <div className="card" style={{ marginTop: 16, background: 'var(--navy)', color: '#e7ebf6', border: 'none' }}>
          <h3 style={{ color: '#fff', marginBottom: 6 }}>Your draft is ready to review.</h3>
          <p style={{ color: '#cfd6ea', marginBottom: 14 }}>
            Open your plan, and when you’re happy with it, approve to continue to the $500 build fee and take your site live.
          </p>
          <button className="btn btn-gold" onClick={onApprove}>Approve &amp; continue to $500</button>
        </div>
      )}

      {c?.plan_embed_url ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 6 }}>Your marketing plan is ready</h3>
          <p className="muted" style={{ marginBottom: 14 }}>
            Your full plan — what to produce, where to list, ready-to-post copy, your brochures, and your action
            items. It opens in its own tab so it’s easy to read and use.
          </p>
          <a className="btn btn-navy" href={c.plan_embed_url} target="_blank" rel="noopener">Open your marketing plan ↗</a>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <b>Your plan is being prepared.</b>
          <p className="muted" style={{ marginTop: 6 }}>We’re putting it together — it’ll appear here shortly.</p>
        </div>
      )}

      <CommissionCard client={c} />
    </div>
  )
}
