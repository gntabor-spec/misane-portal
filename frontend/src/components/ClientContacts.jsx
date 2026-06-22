import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

// Admin: manage who can log in to a client's portal (owner + family, e.g. Michael + Jenny).
export default function ClientContacts({ cid, client }) {
  const [users, setUsers] = useState([])
  const [invite, setInvite] = useState(null)
  const [err, setErr] = useState('')

  async function load() {
    try { setUsers(await api.listClientUsers(cid)) } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [cid])

  async function add() {
    const email = prompt('Email for the new login (they’ll get notifications and can sign in):')
    if (!email) return
    try { setInvite(await api.invite(cid, email)); load() } catch (ex) { alert(ex.message) }
  }
  async function remove(uid, email) {
    if (!confirm(`Remove login ${email}? They lose access and notifications.`)) return
    try { await api.removeClientUser(cid, uid); load() } catch (ex) { alert(ex.message) }
  }
  async function resend(uid) {
    try { setInvite(await api.resendInvite(cid, uid)); load() } catch (ex) { alert(ex.message) }
  }
  async function addOwner() {
    try { setInvite(await api.invite(cid, client.email)); load() } catch (ex) { alert(ex.message) }
  }

  const ownerHasLogin = client?.email && users.some((u) => (u.email || '').toLowerCase() === client.email.toLowerCase())

  return (
    <div className="card" style={{ marginTop: 16, maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3>People with access</h3>
        <button className="btn btn-line" onClick={add}>+ Add person</button>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Everyone here can sign in, see the plan, send updates, and gets lead &amp; plan-update notifications.
      </p>
      {err && <div className="error">{err}</div>}
      {client?.email && !ownerHasLogin && (
        <div className="card" style={{ background: 'var(--greige)', marginBottom: 12 }}>
          Owner email on file: <b>{client.email}</b>
          <button className="btn btn-line" style={{ marginLeft: 12 }} onClick={addOwner}>Add login &amp; send welcome</button>
        </div>
      )}
      {invite && (
        <div className="card" style={{ background: 'var(--greige)', marginBottom: 12 }}>
          Login created &amp; emailed to <b>{invite.email}</b>. <span className="muted">(Backup — temp password: <b>{invite.temp_password}</b>)</span>
          <button className="btn btn-line" style={{ marginLeft: 12 }} onClick={() => setInvite(null)}>Dismiss</button>
        </div>
      )}
      {users.length === 0 ? (
        <p className="muted">No logins yet — add the owner (and family) above.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <td style={{ padding: '8px 0' }}>
                  {u.email}
                  <div className="muted" style={{ fontSize: 12 }}>
                    Invited {u.invited_at ? u.invited_at.slice(0, 10) : '—'} · {u.last_login ? 'last sign-in ' + u.last_login : 'never signed in'}
                  </div>
                </td>
                <td className="muted">{u.must_change_pw ? 'invited' : 'active'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-line" onClick={() => resend(u.id)}>Resend welcome</button>{' '}
                  <button className="btn btn-line" style={{ color: 'var(--danger)' }} onClick={() => remove(u.id, u.email)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
