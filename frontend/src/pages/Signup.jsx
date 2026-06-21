import { useState } from 'react'
import { api } from '../api/client.js'
import MicTextarea from '../components/MicTextarea.jsx'
import ProcessSteps from '../components/ProcessSteps.jsx'
import RequestCall from '../components/RequestCall.jsx'

const TYPES = [
  ['Residential', 'Primary home'],
  ['Lifestyle', 'Lake, ocean, fishing, hunting, recreational'],
  ['Commercial', 'Business or investment property'],
]
const SUBTYPES = ['Lake', 'Ocean', 'Fishing', 'Hunting', 'Other lifestyle']

const EMPTY = {
  name: '', email: '', phone: '', address: '',
  property_type: '', property_subtype: '', listed_with_agent: false, description: '',
}

export default function Signup() {
  const [f, setF] = useState(EMPTY)
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!f.property_type) { setErr('Please choose a property type.'); return }
    if (!f.name || !f.email) { setErr('Name and email are required.'); return }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('name', f.name); fd.append('email', f.email); fd.append('phone', f.phone)
      fd.append('address', f.address); fd.append('property_type', f.property_type)
      fd.append('property_subtype', f.property_type === 'Lifestyle' ? f.property_subtype : '')
      fd.append('listed_with_agent', f.listed_with_agent ? 'yes' : 'no')
      fd.append('description', f.description)
      for (const file of files) fd.append('files', file)
      const r = await api.publicSignup(fd)
      if (r.checkout_url) { window.location.href = r.checkout_url }
      else { window.location.href = '/start/thanks' }
    } catch (ex) { setErr(ex.message); setBusy(false) }
  }

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <a href="https://misaneproperties.com"><img src="/logo-horizontal.png" alt="Misane Properties" style={{ height: 34 }} /></a>
        <a className="btn btn-line" href="https://misaneproperties.com">← Back to site</a>
      </header>

      <div className="kicker">Start your plan</div>
      <h1 style={{ marginTop: 6 }}>Tell us about your property</h1>
      <p style={{ marginTop: 8, fontSize: 18 }}>
        Every great property has a story a generic listing can’t tell. Give us the photos and the story —
        we’ll build the site and the plan that sells it.
      </p>

      <form onSubmit={submit}>
        <div className="card" style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 12 }}>What kind of property is it?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {TYPES.map(([t, d]) => (
              <button type="button" key={t}
                onClick={() => setF({ ...f, property_type: t })}
                className="card"
                style={{ textAlign: 'left', cursor: 'pointer', borderColor: f.property_type === t ? 'var(--navy)' : 'var(--hairline-d)', borderWidth: f.property_type === t ? 2 : 1, padding: 16 }}>
                <b style={{ color: 'var(--navy-text)' }}>{t}</b>
                <div className="muted" style={{ marginTop: 4 }}>{d}</div>
              </button>
            ))}
          </div>
          {f.property_type === 'Lifestyle' && (
            <div style={{ marginTop: 14 }}>
              <label>Which best fits?</label>
              <select value={f.property_subtype} onChange={set('property_subtype')}>
                <option value="">Choose one…</option>
                {SUBTYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <label style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={f.listed_with_agent} onChange={(e) => setF({ ...f, listed_with_agent: e.target.checked })} />
            It’s already listed with a real-estate agent (we’ll augment, not replace, them)
          </label>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Your contact info</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><label>Name</label><input value={f.name} onChange={set('name')} required /></div>
            <div style={{ flex: 1 }}><label>Email</label><input type="email" value={f.email} onChange={set('email')} required /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1 }}><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div>
            <div style={{ flex: 1 }}><label>Property address</label><input value={f.address} onChange={set('address')} /></div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 6 }}>Your photos</h3>
          <p className="muted" style={{ marginBottom: 12 }}>Drone shots, interiors, the view, trail-cam — whatever shows it off. You can add more later.</p>
          <input type="file" multiple accept="image/*,video/*" onChange={(e) => setFiles([...e.target.files])} />
          {files.length > 0 && <p className="muted" style={{ marginTop: 6 }}>{files.length} file(s) selected</p>}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 6 }}>Tell us what makes it special</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            Don’t overthink it — ramble. What do you love about it? What will the next owner love? The mornings,
            the seasons, the memories. Type it, or tap the mic and just talk.
          </p>
          <MicTextarea value={f.description} onChange={(v) => setF({ ...f, description: v })}
            placeholder="e.g. We’ve hunted this land for 20 years. Fall mornings with fog on the field, the kids learning to fish off the dock, fires at the cabin…" />
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 14 }}>How it works</h3>
          <ProcessSteps />
        </div>

        {err && <div className="error">{err}</div>}
        <button className="btn btn-navy" style={{ marginTop: 18, width: '100%', padding: 15, fontSize: 16 }} disabled={busy}>
          {busy ? 'Submitting…' : 'Pay $100 & start my plan'}
        </button>
      </form>

      <div className="card" style={{ marginTop: 22 }}>
        <h3 style={{ marginBottom: 4 }}>Prefer to talk first?</h3>
        <p className="muted">Not ready to sign up? Request a call and we’ll walk you through it.</p>
        <RequestCall />
      </div>
    </div>
  )
}
