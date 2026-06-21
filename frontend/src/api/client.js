const BASE = import.meta.env.VITE_API_BASE || ''

function authHeaders() {
  const t = localStorage.getItem('mp_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: r.statusText }))
    throw new Error(e.detail || 'Request failed')
  }
  return r.status === 204 ? null : r.json()
}

// multipart/form-data (file uploads) — let the browser set the boundary, so no Content-Type here
async function reqForm(path, formData) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { ...authHeaders() }, body: formData })
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: r.statusText }))
    throw new Error(e.detail || 'Request failed')
  }
  return r.json()
}

export const api = {
  login: (email, password) => req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => req('/api/auth/me'),
  listClients: () => req('/api/clients'),
  createClient: (b) => req('/api/clients', { method: 'POST', body: JSON.stringify(b) }),
  invite: (cid, email) => req(`/api/clients/${cid}/invite?email=${encodeURIComponent(email)}`, { method: 'POST' }),
  checkoutSignup: (cid) => req(`/api/clients/${cid}/checkout/signup`, { method: 'POST' }),
  checkoutApproval: (cid) => req(`/api/clients/${cid}/checkout/approval`, { method: 'POST' }),
  cancelSub: (cid) => req(`/api/clients/${cid}/cancel`, { method: 'POST' }),
  setStatus: (cid, status) => req(`/api/clients/${cid}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  getClient: (cid) => req(`/api/clients/${cid}`),
  deleteClient: (cid) => req(`/api/clients/${cid}/delete`, { method: 'POST' }),
  savePlan: (cid, body) => req(`/api/clients/${cid}/plan`, { method: 'POST', body: JSON.stringify(body) }),
  publishPlan: (cid) => req(`/api/clients/${cid}/plan/publish`, { method: 'POST' }),
  updateClient: (cid, body) => req(`/api/clients/${cid}/update`, { method: 'POST', body: JSON.stringify(body) }),
  listClientUsers: (cid) => req(`/api/clients/${cid}/users`),
  removeClientUser: (cid, uid) => req(`/api/clients/${cid}/users/${uid}/delete`, { method: 'POST' }),
  submitUpdate: (formData) => reqForm('/api/portal/submissions', formData),
  listSubmissions: (cid) => req(`/api/clients/${cid}/submissions`),
}
