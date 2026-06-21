import { useState } from 'react'
import { api } from '../api/client.js'

// Request Changes tab — owner asks for edits to their site/plan/materials.
export default function RequestChangesTab() {
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!message.trim()) { setErr('Tell us what you’d like changed.'); return }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('message', message); fd.append('kind', 'change')
      for (const f of files) fd.append('files', f)
      await api.submitUpdate(fd)
      setDone(true); setMessage(''); setFiles([])
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  if (done) return (
    <div className="card" style={{ marginTop: 18, maxWidth: 720 }}>
      <h3>Thanks — we’ve got your request.</h3>
      <p className="muted" style={{ marginTop: 6 }}>We’ll make the change and confirm when it’s live.</p>
      <button className="btn btn-line" style={{ marginTop: 14 }} onClick={() => setDone(false)}>Request another</button>
    </div>
  )

  return (
    <form onSubmit={submit} className="card" style={{ marginTop: 18, maxWidth: 720 }}>
      <h3 style={{ marginBottom: 6 }}>Request a change</h3>
      <p className="muted" style={{ marginBottom: 16 }}>
        A price change, new wording, a feature to add or highlight — tell us and we’ll update your site and materials.
      </p>
      <label>What would you like changed?</label>
      <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Drop the price to $1,350,000 and add that the barn now has power." style={{ resize: 'vertical' }} />
      <label style={{ marginTop: 14 }}>Attach anything helpful (optional)</label>
      <input type="file" multiple onChange={(e) => setFiles([...e.target.files])} />
      {files.length > 0 && <p className="muted" style={{ marginTop: 6 }}>{files.length} file(s) selected</p>}
      {err && <div className="error">{err}</div>}
      <button className="btn btn-navy" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Sending…' : 'Submit request'}</button>
    </form>
  )
}
