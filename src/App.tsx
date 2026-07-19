import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { AuthContext } from '@/contexts/auth-context'
import RequireAuth from '@/routes/RequireAuth'
import { MOCK_AUTH_VALUE } from '@/routes/_mockAuth'

// Code-split lazy routes — §10 provozní úspornost (statická SPA, code-split
// lazy routes). Přidávej sem novou stránku pro každý modul (M1+), ne do
// jednoho velkého bundlu.
const LoginPage = lazy(() => import('@/routes/LoginPage'))
const DashboardPage = lazy(() => import('@/routes/DashboardPage'))
// DOČASNÉ — viz komentář v DesignPreviewPage.tsx, smazat s M1.
const DesignPreviewPage = lazy(() => import('@/routes/DesignPreviewPage'))
// DOČASNÉ — reálné budoucí /nastaveni/* stránky (Dodatek 9), zatím mimo
// RequireAuth přes stejný mock jako DesignPreviewPage, protože backend
// (Auth emulátor) na tomhle stroji nestartuje. Přesunout pod RequireAuth
// a smazat mock wrapper, jakmile M1 přinese reálné přihlášení.
const AppearanceSettingsPage = lazy(() => import('@/routes/settings/AppearanceSettingsPage'))
const AccountSettingsPage = lazy(() => import('@/routes/settings/AccountSettingsPage'))

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app text-text-secondary">
      Načítání…
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/_preview" element={<DesignPreviewPage />} />
            <Route
              element={
                <AuthContext.Provider value={MOCK_AUTH_VALUE}>
                  <Outlet />
                </AuthContext.Provider>
              }
            >
              <Route path="/nastaveni/vzhled" element={<AppearanceSettingsPage />} />
              <Route path="/nastaveni/ucet" element={<AccountSettingsPage />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="/" element={<DashboardPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
