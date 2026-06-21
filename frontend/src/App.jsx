import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import ClientDetail from './pages/ClientDetail.jsx'
import PreviewPortal from './pages/PreviewPortal.jsx'
import ClientDashboard from './pages/ClientDashboard.jsx'
import Signup from './pages/Signup.jsx'
import SignupThanks from './pages/SignupThanks.jsx'

function Home() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'admin' ? '/admin' : '/portal'} replace />
}

function Require({ role, children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/start" element={<Signup />} />
      <Route path="/start/thanks" element={<SignupThanks />} />
      <Route path="/admin" element={<Require role="admin"><AdminDashboard /></Require>} />
      <Route path="/admin/clients/:id" element={<Require role="admin"><ClientDetail /></Require>} />
      <Route path="/admin/clients/:id/preview" element={<Require role="admin"><PreviewPortal /></Require>} />
      <Route path="/portal" element={<Require role="client"><ClientDashboard /></Require>} />
    </Routes>
  )
}
