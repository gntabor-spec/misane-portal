import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'

const API = import.meta.env.VITE_API_BASE || ''

function Tile({ label, value }) {
  return (
    <div className="card" style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--display)', fontSize: 28, color: 'var(--navy-text)', fontWeight: 600 }}>{value}</div>
      <div className="muted" style={{ textTransform: 'capitalize' }}>{label}</div>
    </div>
  )
}

export default function AdminOverview() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { api.adminOverview().then(setData).catch((e) => setErr(e.message)) }, [])

  if (err) return <div className="error">{err}</div>
  if (!data) return null

  const live = data.by_status?.live || 0
  const building = (data.by_status?.building || 0) + (data.by_status?.preview || 0)
  const intake = data.by_status?.intake || 0

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <Tile label="total sites" value={data.total} />
        <Tile label="live" value={live} />
        <Tile label="in build" value={building} />
        <Tile label="new signups" value={intake} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Recent inquiries</h3>
          {data.recent_leads.length === 0 ? <p className="muted">No inquiries yet.</p> : data.recent_leads.map((l) => (
            <div key={l.id} style={{ borderTop: '1px solid var(--hairline)', paddingTop: 8, marginTop: 8 }}>
              <b>{l.name}</b> <span className="muted">· {l.domain}</span>
              <div className="muted" style={{ fontSize: 12 }}>{l.created_at}</div>
              <div style={{ marginTop: 2 }}><a href={`mailto:${l.email}`}>{l.email}</a>{l.phone ? ` · ${l.phone}` : ''}</div>
              {l.message && <p style={{ marginTop: 4, fontSize: 14 }}>{l.message}</p>}
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Recent update requests</h3>
          {data.recent_updates.length === 0 ? <p className="muted">No update requests yet.</p> : data.recent_updates.map((s) => (
            <div key={s.id} style={{ borderTop: '1px solid var(--hairline)', paddingTop: 8, marginTop: 8 }}>
              <b>{s.client_name || `Client ${s.client_id}`}</b> <span className="muted">· {s.kind}</span>
              <div className="muted" style={{ fontSize: 12 }}>{s.created_at} · {s.author_email}</div>
              {s.message && <p style={{ marginTop: 4, fontSize: 14, whiteSpace: 'pre-wrap' }}>{s.message}</p>}
              {s.files?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {s.files.map((file, i) => /\.(mp4|mov|webm|m4v)$/i.test(file)
                    ? <a key={i} className="muted" href={API + file} target="_blank" rel="noopener">video {i + 1}</a>
                    : <a key={i} href={API + file} target="_blank" rel="noopener"><img src={API + file} alt="" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--hairline)' }} /></a>)}
                </div>
              )}
              {s.client_id && <div style={{ marginTop: 6 }}><Link to={`/admin/clients/${s.client_id}`} style={{ fontSize: 13 }}>Open client →</Link></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
