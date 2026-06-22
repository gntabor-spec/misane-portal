import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client.js'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('mp_token')
    if (t) {
      api.me().then(setUser).catch(() => localStorage.removeItem('mp_token')).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email, password) {
    const r = await api.login(email, password)
    localStorage.setItem('mp_token', r.token)
    const u = await api.me()
    setUser(u)
    return u
  }

  function logout() {
    localStorage.removeItem('mp_token')
    setUser(null)
  }

  async function refresh() {
    const u = await api.me()
    setUser(u)
    return u
  }

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
