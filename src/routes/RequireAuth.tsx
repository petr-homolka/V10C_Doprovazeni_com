import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function RequireAuth() {
  const { firebaseUser, userDoc, loading } = useAuth()
  const location = useLocation()

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

  // M9 (UX zpětná vazba 2026-07-21): spolupracovník zůstává uvnitř
  // normálního staffového shellu (na rozdíl od pěstouna má obyčejný staff
  // účet), ale ze stejného "matoucí prázdné/zamítnuté dotazy" důvodu ho
  // nepustíme na stránky mimo jeho rozsah — jen jeho vlastní obrazovku a
  // osobní Nastavení (ta jsou jeho VLASTNÍ data, ne cizí).
  if (
    userDoc?.role === 'spolupracovnik' &&
    !location.pathname.startsWith('/spolupracovnik') &&
    !location.pathname.startsWith('/nastaveni')
  ) {
    return <Navigate to="/spolupracovnik" replace />
  }

  return <Outlet />
}
