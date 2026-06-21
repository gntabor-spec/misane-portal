import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import PortalBody from '../components/PortalBody.jsx'

// Admin preview — renders the exact stage-driven client experience (read-only).
export default function PreviewPortal() {
  const { id } = useParams()
  const { logout } = useAuth()
  const [c, setC] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { api.getClient(id).then(setC).catch((e) => setErr(e.message)) }, [id])

  return (
    <div>
      <div style={{ background: 'var(--brass)', color: '#fff', textAlign: 'center', padding: '9px', fontSize: 13, fontWeight: 600 }}>
        Admin preview — exactly what the client sees ·{' '}
        <Link to={`/admin/clients/${id}`} style={{ color: '#fff', textDecoration: 'underline' }}>back to client</Link> ·{' '}
        <Link to="/admin" style={{ color: '#fff', textDecoration: 'underline' }}>dashboard</Link>
      </div>
      <div className="wrap">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <img src="/logo-horizontal.png" alt="Misane Properties" style={{ height: 34 }} />
          <Link className="btn btn-line" to="/admin">← Dashboard</Link>
        </header>
        {err && <div className="error">{err}</div>}
        {c && (
          <>
            <div className="kicker">Client Portal — Preview ({c.status})</div>
            <h1 style={{ marginTop: 6 }}>{c.name}</h1>
            {c.property_address && <p className="muted" style={{ marginTop: 6 }}>{c.property_address}</p>}
            <PortalBody client={c} preview onApprove={() => alert('Preview only — the client approves from their own login.')} />
          </>
        )}
      </div>
    </div>
  )
}
