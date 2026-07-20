import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/** Chrání `/moje/*` (kromě `/moje/prihlaseni` samotné, viz MojeLoginPage
 * komentář) — vyžaduje přihlášení A `pestoun` profil, ne jen jakékoli
 * přihlášení jako staffová RequireAuth.tsx. */
export default function RequireFosterAuth() {
  const { firebaseUser, userDoc, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-app text-text-secondary">Načítání…</div>
  }

  if (!firebaseUser || !userDoc || userDoc.role !== 'pestoun') {
    return <Navigate to="/moje/prihlaseni" replace />
  }

  return <Outlet />
}
