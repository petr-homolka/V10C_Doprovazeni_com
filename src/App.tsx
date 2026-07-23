import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import RequireAuth from '@/routes/RequireAuth'
import RequireFosterAuth from '@/routes/moje/RequireFosterAuth'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Code-split lazy routes — §10 provozní úspornost (statická SPA, code-split
// lazy routes). Přidávej sem novou stránku pro každý modul (M1+), ne do
// jednoho velkého bundlu.
const LoginPage = lazy(() => import('@/routes/LoginPage'))
const RegisterPage = lazy(() => import('@/routes/RegisterPage'))
const DashboardPage = lazy(() => import('@/routes/DashboardPage'))
const StaffPage = lazy(() => import('@/routes/StaffPage'))
const FamilyListPage = lazy(() => import('@/routes/FamilyListPage'))
const FamilyDetailPage = lazy(() => import('@/routes/FamilyDetailPage'))
const FosterPersonListPage = lazy(() => import('@/routes/FosterPersonListPage'))
const ChildListPage = lazy(() => import('@/routes/ChildListPage'))
const TaskListPage = lazy(() => import('@/routes/TaskListPage'))
const DocumentListPage = lazy(() => import('@/routes/DocumentListPage'))
const DocumentDetailPage = lazy(() => import('@/routes/DocumentDetailPage'))
const DocumentVerifyPage = lazy(() => import('@/routes/DocumentVerifyPage'))
const VisitTimerPage = lazy(() => import('@/routes/VisitTimerPage'))
const AppearanceSettingsPage = lazy(() => import('@/routes/settings/AppearanceSettingsPage'))
const AccountSettingsPage = lazy(() => import('@/routes/settings/AccountSettingsPage'))
const NotificationsSettingsPage = lazy(() => import('@/routes/settings/NotificationsSettingsPage'))
const CalendarSettingsPage = lazy(() => import('@/routes/settings/CalendarSettingsPage'))
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
const CalendarPage = lazy(() => import('@/routes/CalendarPage'))
const MobileHomePage = lazy(() => import('@/routes/mobile/MobileHomePage'))
const MobileAccountPage = lazy(() => import('@/routes/mobile/MobileAccountPage'))
const MobileCalendarPage = lazy(() => import('@/routes/mobile/MobileCalendarPage'))
const MobileFamiliesPage = lazy(() => import('@/routes/mobile/MobileFamiliesPage'))
const MobileFamilyDetailPage = lazy(() => import('@/routes/mobile/MobileFamilyDetailPage'))
const MobileFosterPersonListPage = lazy(() => import('@/routes/mobile/MobileFosterPersonListPage'))
const MobileChildListPage = lazy(() => import('@/routes/mobile/MobileChildListPage'))
const MobileTaskListPage = lazy(() => import('@/routes/mobile/MobileTaskListPage'))

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app text-text-secondary">
      Načítání…
    </div>
  )
}

/**
 * M11 mobil/PWA odlišení — na `/`, `/rodiny`, `/kalendar`, `/pestouni` a
 * `/deti` rozhoduje ŠÍŘKA okna (`useIsMobile`), ne responzivní CSS:
 * mobilní stránky jsou JINÉ stránky, ne zmenšeniny desktopu (viz
 * `useIsMobile.ts`/`MobileShell.tsx` — živě odhaleno 2026-07-22, tabulky
 * (`Table`/`react-big-calendar`) na 390px šířky displeje byly prakticky
 * nepoužitelné — `AppShell` sidebar zabíral polovinu obrazovky). Detail
 * rodiny (`/rodiny/:uid`) zůstává vědomě desktopový i na mobilu (mobilní
 * varianta, `MobileFamilyDetailPage`, žije na VLASTNÍ cestě
 * `/mobil/rodiny/:uid`, ne na téže — profil rodiny má příliš mnoho
 * desktopových sekcí, aby dávalo smysl je na jedné routě přepínat) — SEAM,
 * dostupné z `MobileFamiliesPage` seznamu. Pěstouni/Děti na mobilu ŽÁDNÝ
 * vlastní profil nemají (`MobileFosterPersonListPage`/`MobileChildListPage`
 * naviguje rovnou na `/mobil/rodiny/:uid` — v terénu je cílem dohledat
 * rodinu/zavolat, ne procházet vzdělávací sekce pěstouna).
 */
function HomeRoute() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileHomePage /> : <DashboardPage />
}

function FamiliesRoute() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileFamiliesPage /> : <FamilyListPage />
}

function CalendarRoute() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileCalendarPage /> : <CalendarPage />
}

function FosterPersonsRoute() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileFosterPersonListPage /> : <FosterPersonListPage />
}

function ChildrenRoute() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileChildListPage /> : <ChildListPage />
}

function TasksRoute() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileTaskListPage /> : <TaskListPage />
}

export default function App() {
  return (
    <ErrorBoundary>
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
                <Route path="/" element={<HomeRoute />} />
                <Route path="/mobil/ucet" element={<MobileAccountPage />} />
                <Route path="/mobil/rodiny/:familyUid" element={<MobileFamilyDetailPage />} />
                <Route path="/zamestnanci" element={<StaffPage />} />
                <Route path="/rodiny" element={<FamiliesRoute />} />
                <Route path="/pestouni" element={<FosterPersonsRoute />} />
                <Route path="/deti" element={<ChildrenRoute />} />
                <Route path="/ukoly" element={<TasksRoute />} />
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
                <Route path="/nastaveni/kalendar" element={<CalendarSettingsPage />} />
                <Route path="/nastaveni/import" element={<ImportSettingsPage />} />
                <Route path="/nastaveni/zalohy" element={<BackupSettingsPage />} />
                <Route path="/nastaveni/organizace" element={<OrganizationSettingsPage />} />
                <Route path="/platforma" element={<PlatformSettingsPage />} />
                <Route path="/kvalita" element={<InspectionsPage />} />
                <Route path="/zajemci" element={<FosterProspectsPage />} />
                <Route path="/externiste" element={<ExternalParticipantsPage />} />
                <Route path="/spolupracovnik" element={<SpolupracovnikDashboardPage />} />
                <Route path="/kalendar" element={<CalendarRoute />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
