// The "here's how it works" + billing terms, shown on the signup page and the thank-you page.
const STEPS = [
  ['Kick the project off — $99', 'A deposit that starts your build. We turn your photos and story into a dedicated draft website for your approval.'],
  ['Review & approve your site', 'See the draft in your portal. Approve it, or send changes for another round.'],
  ['Go live — $499 for 3 months', 'On approval, you get your live website, your full marketing plan, and a portal to manage everything.'],
  ['Keep it going — $59/month', 'After the first 3 months, keep your site live up to 12 months total, with 2 site updates a month, billed automatically.'],
  ['Cancel anytime after 3 months', 'You’re free to cancel anytime after the first three months. Maximum term is 12 months.'],
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
          The $99 kicks off your draft (non-refundable). The $499 on approval covers your first three months —
          your live site, full marketing plan, and portal. After three months it’s $59/month (includes two site
          updates a month), billed automatically, for up to 12 months total. Cancel anytime after the first three
          months. Change your mind after the $100? No further payment is required — but your site won’t go live.
        </p>
      </div>
    </div>
  )
}
