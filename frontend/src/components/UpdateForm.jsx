import { useState } from 'react'
import { api } from '../api/client.js'

// Client portal "Update" tab — send new photos/videos, content changes, or feedback.
export default function UpdateForm() {
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!message.trim() && files.length === 0) {
      setErr('Add a note or attach at least one file before submitting.')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('message', message)
      fd.append('kind', 'update')
      for (const f of files) fd.append('files', f)
      await api.submitUpdate(fd)
      setDone(true); setMessage(''); setFiles([])
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="card" style={{ marginTop: 18, maxWidth: 720 }}>
        <h3>Thanks — we’ve got it.</h3>
        <p className="muted" style={{ marginTop: 6 }}>
          Your update was sent to the Misane team. We’ll fold new photos, videos, or changes into your
          site and let you know when it’s live.
        </p>
        <button className="btn btn-line" style={{ marginTop: 14 }} onClick={() => setDone(false)}>Send another</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginTop: 18, maxWidth: 720 }}>
      <h3 style={{ marginBottom: 6 }}>Send photos, videos &amp; updates</h3>
      <p className="muted" style={{ marginBottom: 16 }}>
        New photos or video, a price change, a feature to highlight, or any feedback — send it here and
        we’ll update your site. Skip anything with people you don’t want shown; we’ll leave those off.
      </p>

      <label>Photos / videos</label>
      <input type="file" multiple accept="image/*,video/*" onChange={(e) => setFiles([...e.target.files])} />
      {files.length > 0 && <p className="muted" style={{ marginTop: 6 }}>{files.length} file(s) selected</p>}

      <label style={{ marginTop: 14 }}>New content or feedback</label>
      <textarea
        rows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="e.g. New trail-cam photos attached. Please drop the price to $1,350,000 and add that the barn now has power."
        style={{ resize: 'vertical' }}
      />

      {err && <div className="error">{err}</div>}
      <button className="btn btn-navy" style={{ marginTop: 16 }} disabled={busy}>
        {busy ? 'Sending…' : 'Submit update'}
      </button>
    </form>
  )
}
