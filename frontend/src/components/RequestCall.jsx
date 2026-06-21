import { useState } from 'react'
import { api } from '../api/client.js'

// Secondary CTA on the signup page: "prefer to talk first?" — routes a call request to Greg.
export default function RequestCall() {
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '' })
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setErr('')
    try {
      await api.publicContact({
        domain: 'misaneproperties.com',
        name: f.name, email: f.email, phone: f.phone,
        message: `[Call request] ${f.message}`,
      })
      setDone(true)
    } catch (ex) { setErr(ex.message) }
  }

  if (done) return <p style={{ marginTop: 10 }}>Thanks — we’ll reach out to set up a call.</p>

  return (
    <form onSubmit={submit} style={{ marginTop: 12 }}>
      <div className="cf-row" style={{ display: 'flex', gap: 12 }}>
        <input placeholder="Your name" value={f.name} onChange={set('name')} required />
        <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
      </div>
      <input placeholder="Phone" value={f.phone} onChange={set('phone')} style={{ marginTop: 12 }} />
      <textarea rows={3} placeholder="What would you like to talk through?" value={f.message} onChange={set('message')} style={{ marginTop: 12, resize: 'vertical' }} />
      {err && <div className="error">{err}</div>}
      <button className="btn btn-line" style={{ marginTop: 12 }}>Request a call</button>
    </form>
  )
}
