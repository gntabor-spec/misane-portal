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

const TERMS = `Misane Properties LLC — Service Terms (summary)

1. Services. Misane provides marketing services only — a dedicated property website, marketing materials, and a distribution plan. Misane is not a licensed real estate broker or agent, does not represent you in any transaction, does not list on the MLS on your behalf, and earns no commission on a sale.

2. No guarantee. Misane does not guarantee a sale, a price, a timeline, or any specific result.

3. Your information. You are solely responsible for the accuracy of all information, pricing, descriptions, and representations about your property. You confirm you have the right to market and sell the property and the rights to all photos, video, and content you submit. Misane is not responsible for any inaccuracies, omissions, or misstatements in materials derived from information you provide.

4. Domain & materials. Misane registers and owns the marketing domain and the website it creates. Your plan grants you a license to use the site and materials while your plan is active; they remain Misane's property.

5. Fees & billing. The $100 startup fee initiates your draft and is non-refundable. The $500 approval fee covers the first three months and is non-refundable once work proceeds. After three months, service continues at $59/month (including up to two site updates per month), billed automatically, for up to 12 months total. You may cancel anytime after the first three months; cancellation stops future billing and ends your site and access.

6. Listed properties. Where a property is listed with an agent, Misane augments the agent and routes inquiries accordingly and does not interfere with your agency relationship.

7. Limitation of liability. To the fullest extent permitted by law, Misane's total liability is limited to the fees paid in the prior three months, and Misane is not liable for indirect or consequential damages.

8. Governing law: State of Minnesota.`

const EMPTY = {
  firstName: '', lastName: '', email: '', phone: '',
  ownerAddress: '', ownerCity: '', ownerState: '', ownerZip: '',
  sameAsProperty: true,
  propAddress: '', propCity: '', propState: '', propZip: '',
  property_type: '', property_subtype: '', listed: '', listing_ref: '',
  price: '', beds: '', baths: '', sqft: '', lot: '', year: '',
  description: '', acceptTerms: false,
}

function fmtPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 10)
  if (!d) return ''
  if (d.length < 4) return '(' + d
  if (d.length < 7) return '(' + d.slice(0, 3) + ')' + d.slice(3)
  return '(' + d.slice(0, 3) + ')' + d.slice(3, 6) + '-' + d.slice(6)
}
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export default function Signup() {
  const [f, setF] = useState(EMPTY)
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!f.property_type) return setErr('Please choose a property type.')
    if (!f.listed) return setErr('Please tell us whether it’s listed with an agent.')
    if (!f.firstName || !f.lastName) return setErr('First and last name are required.')
    if (!emailOk(f.email)) return setErr('Please enter a valid email address.')
    if (f.phone.replace(/\D/g, '').length !== 10) return setErr('Please enter a 10-digit phone number.')
    if (!f.acceptTerms) return setErr('Please accept the Terms to continue.')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('first_name', f.firstName); fd.append('last_name', f.lastName)
      fd.append('email', f.email); fd.append('phone', f.phone)
      fd.append('owner_address', f.ownerAddress); fd.append('owner_city', f.ownerCity)
      fd.append('owner_state', f.ownerState); fd.append('owner_zip', f.ownerZip)
      fd.append('same_as_property', f.sameAsProperty ? 'yes' : 'no')
      fd.append('prop_address', f.sameAsProperty ? '' : f.propAddress)
      fd.append('prop_city', f.sameAsProperty ? '' : f.propCity)
      fd.append('prop_state', f.sameAsProperty ? '' : f.propState)
      fd.append('prop_zip', f.sameAsProperty ? '' : f.propZip)
      fd.append('property_type', f.property_type)
      fd.append('property_subtype', f.property_type === 'Lifestyle' ? f.property_subtype : '')
      fd.append('listed_with_agent', f.listed)
      fd.append('listing_ref', f.listed === 'yes' ? f.listing_ref : '')
      if (f.listed === 'no') {
        fd.append('price', f.price); fd.append('beds', f.beds); fd.append('baths', f.baths)
        fd.append('sqft', f.sqft); fd.append('lot', f.lot); fd.append('year_built', f.year)
      }
      fd.append('description', f.description)
      fd.append('accept_terms', f.acceptTerms ? 'yes' : 'no')
      for (const file of files) fd.append('files', file)
      const r = await api.publicSignup(fd)
      window.location.href = r.checkout_url || '/start/thanks'
    } catch (ex) { setErr(ex.message); setBusy(false) }
  }

  const card = (sel) => ({ textAlign: 'left', cursor: 'pointer', padding: 16, borderColor: sel ? 'var(--navy)' : 'var(--hairline-d)', borderWidth: sel ? 2 : 1 })

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
        {/* Type */}
        <div className="card" style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 12 }}>What kind of property is it?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {TYPES.map(([t, d]) => (
              <button type="button" key={t} onClick={() => setF({ ...f, property_type: t })} className="card" style={card(f.property_type === t)}>
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
        </div>

        {/* Listed? */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Is it listed with a real-estate agent?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button type="button" onClick={() => setF({ ...f, listed: 'no' })} className="card" style={card(f.listed === 'no')}>
              <b style={{ color: 'var(--navy-text)' }}>No — for sale by owner</b>
              <div className="muted" style={{ marginTop: 4 }}>We’ll ask a few property details next.</div>
            </button>
            <button type="button" onClick={() => setF({ ...f, listed: 'yes' })} className="card" style={card(f.listed === 'yes')}>
              <b style={{ color: 'var(--navy-text)' }}>Yes — listed with an agent</b>
              <div className="muted" style={{ marginTop: 4 }}>We augment your agent; all leads route to them.</div>
            </button>
          </div>
          {f.listed === 'yes' && (
            <div style={{ marginTop: 14 }}>
              <label>Paste your listing link (Realtor.com / Zillow) or MLS number — we’ll pull the details from it</label>
              <input value={f.listing_ref} onChange={set('listing_ref')} placeholder="https://www.realtor.com/realestateandhomes-detail/…  or  MLS# 1234567" />
            </div>
          )}
        </div>

        {/* Property details — only when NOT listed */}
        {f.listed === 'no' && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Property details</h3>
            <label>Asking price</label>
            <input value={f.price} onChange={set('price')} placeholder="$1,400,000" />
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}><label>Bedrooms</label><input value={f.beds} onChange={set('beds')} /></div>
              <div style={{ flex: 1, minWidth: 120 }}><label>Bathrooms</label><input value={f.baths} onChange={set('baths')} /></div>
              <div style={{ flex: 1, minWidth: 120 }}><label>Square footage</label><input value={f.sqft} onChange={set('sqft')} /></div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}><label>Lot size / acreage</label><input value={f.lot} onChange={set('lot')} placeholder="400 acres" /></div>
              <div style={{ flex: 1, minWidth: 120 }}><label>Year built</label><input value={f.year} onChange={set('year')} /></div>
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>Fill in what applies — leave the rest blank.</p>
          </div>
        )}

        {/* Contact */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Your contact info</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><label>First name *</label><input value={f.firstName} onChange={set('firstName')} required /></div>
            <div style={{ flex: 1 }}><label>Last name *</label><input value={f.lastName} onChange={set('lastName')} required /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1 }}><label>Email *</label><input type="email" value={f.email} onChange={set('email')} required /></div>
            <div style={{ flex: 1 }}><label>Phone *</label><input value={f.phone} onChange={(e) => setF({ ...f, phone: fmtPhone(e.target.value) })} placeholder="(555)555-5555" required /></div>
          </div>
          <div style={{ marginTop: 12 }}><label>Street address</label><input value={f.ownerAddress} onChange={set('ownerAddress')} /></div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <div style={{ flex: 2 }}><label>City</label><input value={f.ownerCity} onChange={set('ownerCity')} /></div>
            <div style={{ flex: 1 }}><label>State</label><input value={f.ownerState} onChange={set('ownerState')} placeholder="MN" /></div>
            <div style={{ flex: 1 }}><label>Zip</label><input value={f.ownerZip} onChange={set('ownerZip')} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, marginTop: 14 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={f.sameAsProperty} onChange={(e) => setF({ ...f, sameAsProperty: e.target.checked })} />
            This is also the address of the property for sale
          </label>
          {!f.sameAsProperty && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Property for sale — address</h3>
              <div><label>Street address</label><input value={f.propAddress} onChange={set('propAddress')} /></div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <div style={{ flex: 2 }}><label>City</label><input value={f.propCity} onChange={set('propCity')} /></div>
                <div style={{ flex: 1 }}><label>State</label><input value={f.propState} onChange={set('propState')} /></div>
                <div style={{ flex: 1 }}><label>Zip</label><input value={f.propZip} onChange={set('propZip')} /></div>
              </div>
            </div>
          )}
        </div>

        {/* Photos */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 6 }}>Your photos</h3>
          <p className="muted" style={{ marginBottom: 12 }}>Drone shots, interiors, the view, trail-cam — whatever shows it off. You can add more later.</p>
          <input type="file" multiple accept="image/*,video/*" onChange={(e) => setFiles([...e.target.files])} />
          {files.length > 0 && <p className="muted" style={{ marginTop: 6 }}>{files.length} file(s) selected</p>}
        </div>

        {/* Story */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 6 }}>Tell us what makes it special</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            Don’t overthink it — ramble. What do you love about it? What will the next owner love? The mornings,
            the seasons, the memories. Type it, or tap the mic and just talk.
          </p>
          <MicTextarea value={f.description} onChange={(v) => setF({ ...f, description: v })}
            placeholder="e.g. We’ve hunted this land for 20 years. Fall mornings with fog on the field, the kids learning to fish off the dock, fires at the cabin…" />
        </div>

        {/* How it works */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 14 }}>How it works</h3>
          <ProcessSteps />
        </div>

        {/* Terms */}
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 10 }}>Terms</h3>
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--hairline-d)', borderRadius: 6, padding: 14, background: '#fff', fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--slate)' }}>
            {TERMS}
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontWeight: 600, color: 'var(--navy-text)', marginTop: 12 }}>
            <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={f.acceptTerms} onChange={(e) => setF({ ...f, acceptTerms: e.target.checked })} />
            I have read and agree to the Terms above.
          </label>
        </div>

        {err && <div className="error">{err}</div>}
        <button className="btn btn-navy" style={{ marginTop: 18, width: '100%', padding: 15, fontSize: 16 }} disabled={busy}>
          {busy ? 'Submitting…' : 'Kick the project off — $100'}
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
