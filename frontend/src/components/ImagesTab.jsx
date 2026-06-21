import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

const API = import.meta.env.VITE_API_BASE || ''

// Images tab — shows the photos they've sent, lets them flag any for removal, and add more.
export default function ImagesTab({ preview }) {
  const [imgs, setImgs] = useState([])
  const [flagged, setFlagged] = useState({})
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  function load() { api.getImages().then(setImgs).catch((e) => setErr(e.message)) }
  useEffect(() => { if (!preview) load() }, [preview])

  async function flag(url) {
    if (preview) { alert('Preview only — interactive in the client’s login.'); return }
    try { await api.flagImage(url); setFlagged((f) => ({ ...f, [url]: true })) } catch (e) { alert(e.message) }
  }
  async function submit(e) {
    e.preventDefault()
    if (preview) { alert('Preview only — interactive in the client’s login.'); return }
    if (files.length === 0) { setErr('Choose at least one file.'); return }
    setBusy(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('kind', 'images'); fd.append('message', '')
      for (const f of files) fd.append('files', f)
      await api.submitUpdate(fd); setFiles([]); setDone(true); load()
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="card" style={{ marginTop: 18 }}>
        <h3 style={{ marginBottom: 6 }}>Your photos</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          These are the photos you’ve sent us. Flag any you’d like removed and we’ll take them down on the next update.
        </p>
        {preview ? (
          <p className="muted">The client’s photo library shows here.</p>
        ) : imgs.length === 0 ? (
          <p className="muted">No photos uploaded yet — add some below.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 12 }}>
            {imgs.map((im) => (
              <div key={im.url} style={{ textAlign: 'center' }}>
                <img src={API + im.url} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--hairline)', opacity: flagged[im.url] ? 0.4 : 1 }} />
                <button type="button" className="btn btn-line" disabled={flagged[im.url]}
                  style={{ marginTop: 6, fontSize: 12, padding: '6px 10px', color: flagged[im.url] ? 'var(--slate2)' : 'var(--danger)' }}
                  onClick={() => flag(im.url)}>
                  {flagged[im.url] ? 'Flagged' : 'Flag for removal'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="card" style={{ marginTop: 14, maxWidth: 720 }}>
        <h3 style={{ marginBottom: 6 }}>Add photos &amp; video</h3>
        <p className="muted" style={{ marginBottom: 12 }}>New seasons, new features, better shots — add them and we’ll refresh your site.</p>
        <input type="file" multiple accept="image/*,video/*" onChange={(e) => setFiles([...e.target.files])} />
        {files.length > 0 && <p className="muted" style={{ marginTop: 6 }}>{files.length} file(s) selected</p>}
        {err && <div className="error">{err}</div>}
        {done && <div style={{ color: 'var(--green)', fontSize: 13, marginTop: 8 }}>Uploaded — thank you.</div>}
        <button className="btn btn-navy" style={{ marginTop: 14 }} disabled={busy}>{busy ? 'Uploading…' : 'Upload photos'}</button>
      </form>
    </div>
  )
}
