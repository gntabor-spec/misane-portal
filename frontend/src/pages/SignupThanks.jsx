import ProcessSteps from '../components/ProcessSteps.jsx'

export default function SignupThanks() {
  return (
    <div className="wrap" style={{ maxWidth: 680 }}>
      <header style={{ marginBottom: 24 }}>
        <a href="https://misaneproperties.com"><img src="/logo-horizontal.png" alt="Misane Properties" style={{ height: 34 }} /></a>
      </header>
      <div className="kicker">You’re in</div>
      <h1 style={{ marginTop: 6 }}>Thanks — we’ve got everything we need to start.</h1>
      <p style={{ marginTop: 10, fontSize: 18 }}>
        Your $99 deposit is in and your property is in our queue. We’ll start building your draft site and
        email you a portal login as soon as it’s ready to review.
      </p>
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 14 }}>What happens next</h3>
        <ProcessSteps />
      </div>
      <p className="muted" style={{ marginTop: 18 }}>
        Questions in the meantime? Email <a href="mailto:greg@misaneproperties.com">greg@misaneproperties.com</a>.
      </p>
    </div>
  )
}
