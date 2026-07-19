import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import RequireAuth from '@/routes/RequireAuth'

// Code-split lazy routes — §10 provozní úspornost (statická SPA, code-split
// lazy routes). Přidávej sem novou stránku pro každý modul (M1+), ne do
// jednoho velkého bundlu.
const LoginPage = lazy(() => import('@/routes/LoginPage'))
const RegisterPage = lazy(() => import('@/routes/RegisterPage'))
const DashboardPage = lazy(() => import('@/routes/DashboardPage'))
const StaffPage = lazy(() => import('@/routes/StaffPage'))
const FamilyListPage = lazy(() => import('@/routes/FamilyListPage'))
const FamilyDetailPage = lazy(() => import('@/routes/FamilyDetailPage'))
const AppearanceSettingsPage = lazy(() => import('@/routes/settings/AppearanceSettingsPage'))
const AccountSettingsPage = lazy(() => import('@/routes/settings/AccountSettingsPage'))
const NotificationsSettingsPage = lazy(() => import('@/routes/settings/NotificationsSettingsPage'))
const ImportSettingsPage = lazy(() => import('@/routes/settings/ImportSettingsPage'))
const BackupSettingsPage = lazy(() => import('@/routes/settings/BackupSettingsPage'))

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
            <Route path="/registrace" element={<RegisterPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/zamestnanci" element={<StaffPage />} />
              <Route path="/rodiny" element={<FamilyListPage />} />
              <Route path="/rodiny/:familyUid" element={<FamilyDetailPage />} />
              <Route path="/nastaveni/vzhled" element={<AppearanceSettingsPage />} />
              <Route path="/nastaveni/ucet" element={<AccountSettingsPage />} />
              <Route path="/nastaveni/oznameni" element={<NotificationsSettingsPage />} />
              <Route path="/nastaveni/import" element={<ImportSettingsPage />} />
              <Route path="/nastaveni/zalohy" element={<BackupSettingsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
