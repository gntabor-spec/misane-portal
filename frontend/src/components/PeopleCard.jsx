import { useEffect, useState } from 'react'
import { api } from '../api/client.js'

// Client-side: owner adds/removes who can access the account (e.g. a spouse or daughter).
export default function PeopleCard({ preview }) {
  const [people, setPeople] = useState([])
  const [invite, setInvite] = useState(null)
  const [err, setErr] = useState('')

  function load() { api.getPeople().then(setPeople).catch((e) => setErr(e.message)) }
  useEffect(() => { if (!preview) load() }, [preview])

  async function add() {
    if (preview) { alert('Preview only — interactive in the client’s login.'); return }
    const email = prompt('Email of the person to add (they’ll get a login and notifications):')
    if (!email) return
    try { setInvite(await api.addPerson(email)); load() } catch (ex) { alert(ex.message) }
  }
  async function remove(uid, email) {
    if (preview) { alert('Preview only — interactive in the client’s login.'); return }
    if (!confirm(`Remove ${email}?`)) return
    try { await api.removePerson(uid); load() } catch (ex) { alert(ex.message) }
  }

  return (
    <div className="card" style={{ marginTop: 16, maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3>People with access</h3>
        <button className="btn btn-line" onClick={add}>+ Add person</button>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>Add family or a co-owner — they get their own login and notifications.</p>
      {invite && (
        <div className="card" style={{ background: 'var(--greige)', marginBottom: 12 }}>
          Login created — send these: <b>{invite.email}</b> · temp password <b>{invite.temp_password}</b>
          <button className="btn btn-line" style={{ marginLeft: 12 }} onClick={() => setInvite(null)}>Dismiss</button>
        </div>
      )}
      {err && <div className="error">{err}</div>}
      {preview ? <p className="muted">The people on the account show here.</p> : people.length === 0 ? <p className="muted">Just you so far.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--hairline)' }}>
                <td style={{ padding: '8px 0' }}>{p.email}</td>
                <td className="muted">{p.must_change_pw ? 'invited' : 'active'}</td>
                <td style={{ textAlign: 'right' }}><button className="btn btn-line" style={{ color: 'var(--danger)' }} onClick={() => remove(p.id, p.email)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
