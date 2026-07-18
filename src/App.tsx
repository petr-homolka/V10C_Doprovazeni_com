import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import RequireAuth from '@/routes/RequireAuth'

// Code-split lazy routes — §10 provozní úspornost (statická SPA, code-split
// lazy routes). Přidávej sem novou stránku pro každý modul (M1+), ne do
// jednoho velkého bundlu.
const LoginPage = lazy(() => import('@/routes/LoginPage'))
const DashboardPage = lazy(() => import('@/routes/DashboardPage'))
// DOČASNÉ — viz komentář v DesignPreviewPage.tsx, smazat s M1.
const DesignPreviewPage = lazy(() => import('@/routes/DesignPreviewPage'))

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
            <Route element={<RequireAuth />}>
              <Route path="/" element={<DashboardPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
