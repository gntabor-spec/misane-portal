// Shared client portal view — used by the live client dashboard and the admin preview.
// `plan` is the parsed marketing-plan object (published for clients, draft for preview), or null.
const lines = (s) => (s || '').split('\n').map((x) => x.trim()).filter(Boolean)

export default function ClientPortalView({ client, plan, preview = false, onCancel }) {
  const c = client
  const p = plan

  return (
    <>
      <div className="kicker">Client Portal{preview ? ' — Preview' : ''}</div>
      <h1 style={{ marginTop: 6 }}>{c?.name || 'Your property'}</h1>
      {c?.property_address && <p className="muted" style={{ marginTop: 6 }}>{c.property_address}</p>}
      {c?.domain && (
        <p style={{ marginTop: 6 }}><b>Your site:</b> <a href={`https://${c.domain}`} target="_blank" rel="noopener">{c.domain}</a></p>
      )}

      {!p ? (
        <div className="card" style={{ marginTop: 18 }}>
          <b>Your plan is being prepared.</b>
          <p className="muted" style={{ marginTop: 6 }}>We're putting together your marketing plan — it'll appear here shortly.</p>
        </div>
      ) : (
        <>
          {p.intro && <p style={{ marginTop: 16, fontSize: 18 }}>{p.intro}</p>}

          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 12 }}>Your marketing plan</h3>
            {p.ch_web && <p style={{ marginBottom: 10 }}><b>Web &amp; portals:</b> {p.ch_web}</p>}
            {p.ch_specialty && <p style={{ marginBottom: 10 }}><b>Specialty sites:</b> {p.ch_specialty}</p>}
            {p.ch_social && <p style={{ marginBottom: 10 }}><b>Social:</b> {p.ch_social}</p>}
            {p.ch_realtor && <p style={{ marginBottom: 0 }}><b>Local realtors:</b> {p.ch_realtor}</p>}
          </div>

          {lines(p.checklist).length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <h3 style={{ marginBottom: 10 }}>Where your listing goes</h3>
              <ul style={{ paddingLeft: 18 }}>{lines(p.checklist).map((x, i) => <li key={i} style={{ marginBottom: 4 }}>{x}</li>)}</ul>
            </div>
          )}

          {lines(p.action_items).length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <h3 style={{ marginBottom: 10 }}>Your action items</h3>
              <ul style={{ paddingLeft: 18 }}>{lines(p.action_items).map((x, i) => <li key={i} style={{ marginBottom: 4 }}>{x}</li>)}</ul>
            </div>
          )}

          {(p.brochure_url || p.cards_url || p.copy_url) && (
            <div className="card" style={{ marginTop: 14 }}>
              <h3 style={{ marginBottom: 10 }}>Downloads</h3>
              {p.brochure_url && <a className="btn btn-gold" href={p.brochure_url} style={{ marginRight: 8 }}>Brochure + QR</a>}
              {p.cards_url && <a className="btn btn-line" href={p.cards_url} style={{ marginRight: 8 }}>Calling cards</a>}
              {p.copy_url && <a className="btn btn-line" href={p.copy_url}>Marketing copy</a>}
            </div>
          )}

          {p.notes && <p className="muted" style={{ marginTop: 14 }}>{p.notes}</p>}
        </>
      )}

      {c?.stripe_subscription && !preview && (
        <div style={{ marginTop: 18 }}><button className="btn btn-line" onClick={onCancel}>Cancel subscription</button></div>
      )}
    </>
  )
}
