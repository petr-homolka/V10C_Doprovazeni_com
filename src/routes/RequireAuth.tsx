import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function RequireAuth() {
  const { firebaseUser, userDoc, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-app text-text-secondary">Načítání…</div>
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />
  }

  // M4: pěstoun má vlastní omezenou appku `/moje/*` — nikdy ho nenech
  // dopadnout na staffový shell (prázdné/zamítnuté dotazy by byly matoucí).
  if (userDoc?.role === 'pestoun') {
    return <Navigate to="/moje" replace />
  }

  return <Outlet />
}
