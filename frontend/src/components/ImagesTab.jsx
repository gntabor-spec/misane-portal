import { useState } from 'react'
import { api } from '../api/client.js'

// Images tab — owner uploads new/updated photos and video for their site.
export default function ImagesTab() {
  const [files, setFiles] = useState([])
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (files.length === 0) { setErr('Choose at least one image or video.'); return }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('message', caption); fd.append('kind', 'images')
      for (const f of files) fd.append('files', f)
      await api.submitUpdate(fd)
      setDone(true); setFiles([]); setCaption('')
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  if (done) return (
    <div className="card" style={{ marginTop: 18, maxWidth: 720 }}>
      <h3>Thanks — photos received.</h3>
      <p className="muted" style={{ marginTop: 6 }}>We’ll add them to your site and let you know when they’re live.</p>
      <button className="btn btn-line" style={{ marginTop: 14 }} onClick={() => setDone(false)}>Send more</button>
    </div>
  )

  return (
    <form onSubmit={submit} className="card" style={{ marginTop: 18, maxWidth: 720 }}>
      <h3 style={{ marginBottom: 6 }}>Update your photos &amp; video</h3>
      <p className="muted" style={{ marginBottom: 16 }}>
        Add new or replacement photos and video — new seasons, new features, better shots. Send them anytime and
        we’ll refresh your site. Skip anything with people you’d rather not show; we’ll leave those off.
      </p>
      <label>Photos / videos</label>
      <input type="file" multiple accept="image/*,video/*" onChange={(e) => setFiles([...e.target.files])} />
      {files.length > 0 && <p className="muted" style={{ marginTop: 6 }}>{files.length} file(s) selected</p>}
      <label style={{ marginTop: 14 }}>Notes (optional)</label>
      <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. New drone shots from this fall — please feature the one of the field." style={{ resize: 'vertical' }} />
      {err && <div className="error">{err}</div>}
      <button className="btn btn-navy" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Uploading…' : 'Submit photos'}</button>
    </form>
  )
}
