import CommissionCard from './CommissionCard.jsx'

// Marketing Plan tab (live stage). The full plan opens as its OWN page (no nested iframe).
export default function PlanTab({ client, preview }) {
  const c = client
  return (
    <div>
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

      <CommissionCard client={c} preview={preview} />
    </div>
  )
}
