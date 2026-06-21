// Shared client portal view — rendered both for a logged-in client and for the
// admin "Preview portal". Pass the client object; pass onCancel only for the real client.
export default function ClientPortalView({ client, preview = false, onCancel }) {
  const c = client
  return (
    <>
      <div className="kicker">Client Portal{preview ? ' — Preview' : ''}</div>
      <h1 style={{ marginTop: 6 }}>{c?.name || 'Your property'}</h1>
      {c?.property_address && <p className="muted" style={{ marginTop: 6 }}>{c.property_address}</p>}
      <div className="card" style={{ marginTop: 18 }}>
        <p><b>Status:</b> {c?.status || 'intake'}</p>
        {c?.domain && (
          <p style={{ marginTop: 6 }}><b>Site:</b> <a href={`https://${c.domain}`} target="_blank" rel="noopener">{c.domain}</a></p>
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          Your dashboard — intake, preview & approval, downloads, photos, and your subscription —
          appears here as we move through your setup.
        </p>
        {c?.stripe_subscription && !preview && (
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-line" onClick={onCancel}>Cancel subscription</button>
          </div>
        )}
      </div>
    </>
  )
}
