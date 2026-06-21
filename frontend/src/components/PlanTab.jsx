// Marketing Plan tab — the plan fills the tab full-bleed (same window), tab menu stays above.
export default function PlanTab({ client }) {
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
    <iframe
      title="Your marketing plan"
      src={c.plan_embed_url}
      style={{ display: 'block', width: '100%', height: 'calc(100vh - 230px)', minHeight: 500, marginTop: 10, border: 'none', background: '#fff' }}
    />
  )
}
