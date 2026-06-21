import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import ClientContacts from '../components/ClientContacts.jsx'
import ClientSubmissions from '../components/ClientSubmissions.jsx'

const PLAN_EMPTY = {
  intro: '', ch_web: '', ch_specialty: '', ch_social: '', ch_realtor: '',
  checklist: '', action_items: '', brochure_url: '', cards_url: '', copy_url: '', notes: '',
}

export default function ClientDetail() {
  const { id } = useParams()
  const { logout } = useAuth()
  const [c, setC] = useState(null)
  const [form, setForm] = useState(null)
  const [plan, setPlan] = useState(PLAN_EMPTY)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [planMsg, setPlanMsg] = useState('')

  async function load() {
    try {
      const d = await api.getClient(id)
      setC(d)
      setForm({
        name: d.name || '', email: d.email || '', phone: d.phone || '',
        property_address: d.property_address || '', domain: d.domain || '',
        scenario: d.scenario || 'fsbo', commission_pct: d.commission_pct || '',
      })
      let dr = {}
      try { dr = d.plan_draft ? JSON.parse(d.plan_draft) : {} } catch { dr = {} }
      setPlan({ ...PLAN_EMPTY, ...dr })
    } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [id])

  async function save(e) {
    e.preventDefault()
    setSaved(false); setErr('')
    try { await api.updateClient(id, form); setSaved(true); load() } catch (ex) { setErr(ex.message) }
  }
  async function savePlanDraft() {
    setPlanMsg('')
    try { await api.savePlan(id, plan); setPlanMsg('Draft saved.'); load() } catch (ex) { setPlanMsg(ex.message) }
  }
  async function publishPlan() {
    if (!confirm('Publish this plan? The client will see it in their portal.')) return
    setPlanMsg('')
    try { await api.savePlan(id, plan); await api.publishPlan(id); setPlanMsg('Published — the client can see it now.'); load() } catch (ex) { setPlanMsg(ex.message) }
  }

  if (!c || !form) return <div className="wrap">{err ? <div className="error">{err}</div> : 'Loading…'}</div>

  const setP = (k) => (e) => setPlan({ ...plan, [k]: e.target.value })
  const TA = (label, k, ph) => (
    <div style={{ marginTop: 12 }}>
      <label>{label}</label>
      <textarea rows={k === 'intro' || k === 'notes' ? 2 : 3} value={plan[k]} onChange={setP(k)} placeholder={ph || ''} style={{ resize: 'vertical' }} />
    </div>
  )

  return (
    <div className="wrap">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <img src="/logo-horizontal.png" alt="Misane Properties" style={{ height: 34 }} />
        <button className="btn btn-line" onClick={logout}>Sign out</button>
      </header>
      <Link to="/admin" style={{ fontSize: 13 }}>&larr; All clients</Link>
      <h1 style={{ marginTop: 8 }}>{c.name}</h1>
      <p className="muted">Status: {c.status} &middot; {c.scenario}{c.domain ? ` · ${c.domain}` : ''} &middot; Plan: {c.plan_published ? 'published' : 'not published'}</p>
      <Link className="btn btn-line" to={`/admin/clients/${id}/preview`} style={{ marginTop: 10 }}>Preview portal (what the client sees)</Link>

      <div className="card" style={{ marginTop: 16, maxWidth: 720 }}>
        <h3 style={{ marginBottom: 10 }}>Quick contact</h3>
        {c.email ? <p><a href={`mailto:${c.email}`}>{c.email}</a></p> : <p className="muted">No email on file</p>}
        {c.phone ? <p style={{ marginTop: 4 }}><a href={`tel:${c.phone}`}>{c.phone}</a></p> : <p className="muted" style={{ marginTop: 4 }}>No phone on file</p>}
      </div>

      <ClientContacts cid={id} />

      <form onSubmit={save} className="card" style={{ marginTop: 16, maxWidth: 720 }}>
        <h3 style={{ marginBottom: 14 }}>Contact &amp; details</h3>
        <label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <label style={{ marginTop: 12 }}>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label style={{ marginTop: 12 }}>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <label style={{ marginTop: 12 }}>Property address</label><input value={form.property_address} onChange={(e) => setForm({ ...form, property_address: e.target.value })} />
        <label style={{ marginTop: 12 }}>Domain</label><input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="3545uniformst.com" />
        <label style={{ marginTop: 12 }}>Buyer-agent commission %</label><input value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} placeholder="e.g. 2.5%" />
        {err && <div className="error">{err}</div>}
        {saved && <div style={{ color: 'var(--green)', fontSize: 13, marginTop: 8 }}>Saved.</div>}
        <button className="btn btn-navy" style={{ marginTop: 16 }}>Save</button>
      </form>

      <div className="card" style={{ marginTop: 16, maxWidth: 720 }}>
        <h3 style={{ marginBottom: 4 }}>Marketing plan</h3>
        <p className="muted">Fill these in, Save Draft, Preview it, then Publish when it's ready. The client only sees it after you publish.</p>
        {TA('Intro line', 'intro', "e.g. Here's everything we're doing to sell 3545 Uniform St.")}
        {TA('Channel A — Web & portals', 'ch_web', 'Zillow FSBO copy + optional flat-fee MLS…')}
        {TA('Channel B — Specialty sites', 'ch_specialty', 'LandWatch, Land.com, Whitetail, Mossy Oak, Hunting Locator…')}
        {TA('Channel C — Social', 'ch_social', 'Ready-to-post copy + MN/Upper-Midwest hunting FB groups…')}
        {TA('Channel D — Local realtors', 'ch_realtor', 'Intro brochure + your chosen commission %…')}
        {TA('Where it goes (one per line)', 'checklist', '3545uniformst.com\nZillow FSBO\nLandWatch\n…')}
        {TA('Action items (one per line)', 'action_items', 'Post your Zillow FSBO with our copy\nSet your commission %\n…')}
        <div style={{ marginTop: 12 }}><label>Brochure download URL (optional)</label><input value={plan.brochure_url} onChange={setP('brochure_url')} /></div>
        <div style={{ marginTop: 12 }}><label>Calling cards URL (optional)</label><input value={plan.cards_url} onChange={setP('cards_url')} /></div>
        <div style={{ marginTop: 12 }}><label>Marketing copy URL (optional)</label><input value={plan.copy_url} onChange={setP('copy_url')} /></div>
        {TA('Note (optional)', 'notes', '')}
        {planMsg && <div style={{ color: 'var(--green)', fontSize: 13, marginTop: 10 }}>{planMsg}</div>}
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-line" onClick={savePlanDraft}>Save draft</button>
          <Link className="btn btn-line" to={`/admin/clients/${id}/preview`}>Preview</Link>
          <button type="button" className="btn btn-navy" onClick={publishPlan}>Publish to client</button>
        </div>
      </div>

      <ClientSubmissions cid={id} />
    </div>
  )
}
