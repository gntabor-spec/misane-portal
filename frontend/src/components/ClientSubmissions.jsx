import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

const API = import.meta.env.VITE_API_BASE || ''
const isVideo = (f) => /\.(mp4|mov|webm|m4v)$/i.test(f)

// Admin: see photos/videos + content/feedback the owner sent from the Update tab.
export default function ClientSubmissions({ cid }) {
  const [subs, setSubs] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => { api.listSubmissions(cid).then(setSubs).catch((e) => setErr(e.message)) }, [cid])

  return (
    <div className="card" style={{ marginTop: 16, maxWidth: 720 }}>
      <h3 style={{ marginBottom: 10 }}>Updates from the owner</h3>
      {err && <div className="error">{err}</div>}
      {subs.length === 0 ? (
        <p className="muted">No updates submitted yet.</p>
      ) : (
        subs.map((s) => (
          <div key={s.id} style={{ borderTop: '1px solid var(--hairline)', paddingTop: 12, marginTop: 12 }}>
            <p className="muted">{s.created_at} &middot; {s.author_email} &middot; {s.kind}</p>
            {s.message && <p style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{s.message}</p>}
            {s.files?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {s.files.map((f, i) => (
                  isVideo(f)
                    ? <a key={i} className="btn btn-line" href={API + f} target="_blank" rel="noopener">Video {i + 1}</a>
                    : <a key={i} href={API + f} target="_blank" rel="noopener">
                        <img src={API + f} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--hairline)' }} />
                      </a>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
