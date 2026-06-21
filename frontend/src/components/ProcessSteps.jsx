// The "here's how it works" + billing terms, shown on the signup page and the thank-you page.
const STEPS = [
  ['Pay $100 to start', 'A refundable-effort deposit that kicks off your build. Nothing else is due yet.'],
  ['We build your draft site', 'We turn your photos and story into a dedicated property website — your draft.'],
  ['You review & approve', 'See the draft in your portal. Approve it and you’re prompted for the $500 build fee.'],
  ['Your packet + site go live', 'Once the $500 is paid, you get your full Marketing Packet and your site goes live.'],
  ['Keep it fresh', 'Request changes and add new photos, video, or content anytime from your portal.'],
]

export default function ProcessSteps() {
  return (
    <div>
      <ol style={{ listStyle: 'none', padding: 0, counterReset: 'step' }}>
        {STEPS.map(([t, d], i) => (
          <li key={i} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'var(--display)' }}>{i + 1}</div>
            <div>
              <b style={{ color: 'var(--navy-text)' }}>{t}</b>
              <div className="muted" style={{ marginTop: 2 }}>{d}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="card" style={{ background: 'var(--greige)', marginTop: 8 }}>
        <b style={{ color: 'var(--navy-text)' }}>The billing, plainly</b>
        <p className="muted" style={{ marginTop: 6 }}>
          The $500 covers your first two months. After that, your card is billed $100/month for up to 10 months —
          one each month — through the one-year mark from your $500 payment. You can cancel anytime after the first
          two months. Change your mind after the $100? No further payment is required — but your site won’t go live.
        </p>
      </div>
    </div>
  )
}
