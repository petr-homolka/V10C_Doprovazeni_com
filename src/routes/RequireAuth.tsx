import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function RequireAuth() {
  const { firebaseUser, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-app text-text-secondary">Načítání…</div>
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
