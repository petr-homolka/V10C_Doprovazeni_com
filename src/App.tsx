import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import RequireAuth from '@/routes/RequireAuth'
import RequireFosterAuth from '@/routes/moje/RequireFosterAuth'

// Code-split lazy routes — §10 provozní úspornost (statická SPA, code-split
// lazy routes). Přidávej sem novou stránku pro každý modul (M1+), ne do
// jednoho velkého bundlu.
const LoginPage = lazy(() => import('@/routes/LoginPage'))
const RegisterPage = lazy(() => import('@/routes/RegisterPage'))
const DashboardPage = lazy(() => import('@/routes/DashboardPage'))
const StaffPage = lazy(() => import('@/routes/StaffPage'))
const FamilyListPage = lazy(() => import('@/routes/FamilyListPage'))
const FamilyDetailPage = lazy(() => import('@/routes/FamilyDetailPage'))
const DocumentListPage = lazy(() => import('@/routes/DocumentListPage'))
const DocumentDetailPage = lazy(() => import('@/routes/DocumentDetailPage'))
const DocumentVerifyPage = lazy(() => import('@/routes/DocumentVerifyPage'))
const VisitTimerPage = lazy(() => import('@/routes/VisitTimerPage'))
const AppearanceSettingsPage = lazy(() => import('@/routes/settings/AppearanceSettingsPage'))
const AccountSettingsPage = lazy(() => import('@/routes/settings/AccountSettingsPage'))
const NotificationsSettingsPage = lazy(() => import('@/routes/settings/NotificationsSettingsPage'))
const ImportSettingsPage = lazy(() => import('@/routes/settings/ImportSettingsPage'))
const BackupSettingsPage = lazy(() => import('@/routes/settings/BackupSettingsPage'))
const OrganizationSettingsPage = lazy(() => import('@/routes/settings/OrganizationSettingsPage'))
const MojeLoginPage = lazy(() => import('@/routes/moje/MojeLoginPage'))
const MojeDashboardPage = lazy(() => import('@/routes/moje/MojeDashboardPage'))
const PlatformSettingsPage = lazy(() => import('@/routes/PlatformSettingsPage'))
const InspectionsPage = lazy(() => import('@/routes/InspectionsPage'))
const FosterProspectsPage = lazy(() => import('@/routes/FosterProspectsPage'))
const ExternalParticipantsPage = lazy(() => import('@/routes/ExternalParticipantsPage'))
const AgreementDetailPage = lazy(() => import('@/routes/AgreementDetailPage'))
const FosterPersonDetailPage = lazy(() => import('@/routes/FosterPersonDetailPage'))
const ChildDetailPage = lazy(() => import('@/routes/ChildDetailPage'))
const SpolupracovnikDashboardPage = lazy(() => import('@/routes/SpolupracovnikDashboardPage'))

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
            <Route path="/moje/prihlaseni" element={<MojeLoginPage />} />
            <Route element={<RequireFosterAuth />}>
              <Route path="/moje" element={<MojeDashboardPage />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/zamestnanci" element={<StaffPage />} />
              <Route path="/rodiny" element={<FamilyListPage />} />
              <Route path="/dokumenty" element={<DocumentListPage />} />
              <Route path="/rodiny/:familyUid" element={<FamilyDetailPage />} />
              <Route path="/rodiny/:familyUid/dohoda" element={<AgreementDetailPage />} />
              <Route path="/rodiny/:familyUid/pestoun/:fosterPersonId" element={<FosterPersonDetailPage />} />
              <Route path="/rodiny/:familyUid/dite/:childId" element={<ChildDetailPage />} />
              <Route path="/rodiny/:familyUid/navsteva" element={<VisitTimerPage />} />
              <Route path="/rodiny/:familyUid/dokumenty/:docId" element={<DocumentDetailPage />} />
              <Route path="/d/:uid" element={<DocumentVerifyPage />} />
              <Route path="/nastaveni/vzhled" element={<AppearanceSettingsPage />} />
              <Route path="/nastaveni/ucet" element={<AccountSettingsPage />} />
              <Route path="/nastaveni/oznameni" element={<NotificationsSettingsPage />} />
              <Route path="/nastaveni/import" element={<ImportSettingsPage />} />
              <Route path="/nastaveni/zalohy" element={<BackupSettingsPage />} />
              <Route path="/nastaveni/organizace" element={<OrganizationSettingsPage />} />
              <Route path="/platforma" element={<PlatformSettingsPage />} />
              <Route path="/kvalita" element={<InspectionsPage />} />
              <Route path="/zajemci" element={<FosterProspectsPage />} />
              <Route path="/externiste" element={<ExternalParticipantsPage />} />
              <Route path="/spolupracovnik" element={<SpolupracovnikDashboardPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
