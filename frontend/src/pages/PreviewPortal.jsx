import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../api/client.js'
import ClientPortalView from '../components/ClientPortalView.jsx'

export default function PreviewPortal() {
  const { id } = useParams()
  const { logout } = useAuth()
  const [c, setC] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { api.getClient(id).then(setC).catch((e) => setErr(e.message)) }, [id])

  return (
    <div>
      <div style={{ background: 'var(--brass)', color: '#fff', textAlign: 'center', padding: '9px', fontSize: 13, fontWeight: 600 }}>
        Admin preview — exactly what this client sees &middot;{' '}
        <Link to={`/admin/clients/${id}`} style={{ color: '#fff', textDecoration: 'underline' }}>back to client</Link>
      </div>
      <div className="wrap">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <img src="/logo-horizontal.png" alt="Misane Properties" style={{ height: 34 }} />
          <button className="btn btn-line" onClick={logout}>Sign out</button>
        </header>
        {err && <div className="error">{err}</div>}
        {c && <ClientPortalView client={c} preview />}
      </div>
    </div>
  )
}
