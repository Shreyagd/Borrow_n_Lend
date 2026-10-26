import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { EmptyState, LoadingState } from './ui'
import { Link } from 'react-router-dom'

export function RequireAuth() {
  const { user, loading, profile } = useAuth()
  const loc = useLocation()
  if (loading) return <LoadingState />
  if (!user) return <Navigate to="/auth" replace state={{ from: loc.pathname + loc.search }} />
  if (profile?.suspended) {
    return <EmptyState title="Account suspended">Your account has been suspended. Please <Link to="/contact">contact support</Link>.</EmptyState>
  }
  return <Outlet />
}

/** UI gate only. Every admin read/write is independently authorised by the server (RLS + SQL functions). */
export function RequireAdmin() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <LoadingState />
  if (!isAdmin) {
    return (
      <EmptyState title="Admins only" action={<Link to="/" className="btn-primary no-underline text-white">Go home</Link>}>
        You don’t have access to this area.
      </EmptyState>
    )
  }
  return <Outlet />
}
