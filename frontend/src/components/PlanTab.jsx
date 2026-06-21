import CommissionCard from './CommissionCard.jsx'

// Marketing Plan tab — plan shown inline, in the same window. The tab menu stays
// above it for navigation. The iframe fills the window so it's a single scroll.
export default function PlanTab({ client, preview }) {
  const c = client

  if (!c?.plan_embed_url) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <b>Your plan is being prepared.</b>
        <p className="muted" style={{ marginTop: 6 }}>We’re putting it together — it’ll appear here shortly.</p>
      </div>
    )
  }

  return (
    <div>
      <iframe
        title="Your marketing plan"
        src={c.plan_embed_url}
        style={{
          display: 'block', width: '100%', height: 'calc(100vh - 300px)', minHeight: 500,
          marginTop: 14, border: '1px solid var(--hairline-d)', borderRadius: 'var(--radius)', background: '#fff',
        }}
      />
      <CommissionCard client={c} preview={preview} />
    </div>
  )
}
