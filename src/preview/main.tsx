import { StrictMode, useEffect, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '@/contexts/auth-context'
import { currentUser } from './fixtures'
// STEJNÉ importy fontů jako `src/main.tsx` — bez nich by náhled kreslil
// systémovým fontem a jakýkoli soud o typografii by byl o něčem jiném, než
// co uvidí uživatel.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@/index.css'
import './lab/lab.css'
import './lab/osa/osa.css'
import './lab/osa/routine.css'
import { DirectionSpis } from './lab/DirectionSpis'
import { DirectionFaces } from './lab/DirectionFaces'
import { DirectionRail } from './lab/DirectionRail'
import { OsaFamilies } from './lab/osa/ScreenFamilies'
import { OsaFamily } from './lab/osa/ScreenFamily'
import { OsaCalendar } from './lab/osa/ScreenCalendar'
import { OsaToday } from './lab/osa/ScreenToday'
import { RoutineToday } from './lab/osa/ScreenRoutineToday'

import { useIsMobile } from '@/hooks/useIsMobile'
import FamilyListPage from '@/routes/FamilyListPage'
import FamilyDetailPage from '@/routes/FamilyDetailPage'
import ChildListPage from '@/routes/ChildListPage'
import FosterPersonListPage from '@/routes/FosterPersonListPage'
import StaffPage from '@/routes/StaffPage'
import StaffDetailPage from '@/routes/StaffDetailPage'
import CalendarPage from '@/routes/CalendarPage'
import TaskListPage from '@/routes/TaskListPage'
import DashboardPage from '@/routes/DashboardPage'
import MessengerPage from '@/routes/MessengerPage'
import MobileHomePage from '@/routes/mobile/MobileHomePage'
import MobileFamiliesPage from '@/routes/mobile/MobileFamiliesPage'
import MobileFamilyDetailPage from '@/routes/mobile/MobileFamilyDetailPage'
import MobileCalendarPage from '@/routes/mobile/MobileCalendarPage'
import MobileChildListPage from '@/routes/mobile/MobileChildListPage'
import MobileFosterPersonListPage from '@/routes/mobile/MobileFosterPersonListPage'
import MobileTaskListPage from '@/routes/mobile/MobileTaskListPage'

/**
 * NÁHLED DESIGNU — druhý Vite vstup (`design-preview.html`), který renderuje
 * SKUTEČNÉ stránky appky proti vzorovým datům, bez Firebase a bez
 * přihlášení. Existuje kvůli jednomu problému: design se nedá dělat naslepo.
 * Vývojové prostředí, kde tahle appka vzniká, se do nasazené verze nedostane
 * (egress proxy) a emulátor byl nestabilní, takže vizuální kontrola dřív
 * závisela výhradně na tom, že uživatel pošle screenshot.
 *
 * Služby jsou v `vite.preview.config.ts` nahrazené stuby ze `stubs/` —
 * stránky samotné se NEUPRAVUJÍ, takže náhled nemůže ukazovat něco jiného
 * než produkce. `scripts/design-shots.mjs` z toho dělá screenshoty (světlý
 * i tmavý režim, desktop i mobil).
 *
 * Do produkčního bundlu se nic z `src/preview/` nedostane — `src/main.tsx`
 * to neimportuje.
 */

const auth: AuthContextValue = {
  firebaseUser: { uid: currentUser.uid, email: currentUser.email } as never,
  userDoc: currentUser,
  loading: false,
  canPreviewRoles: false,
  previewRole: null,
  setPreviewRole: () => {},
}

/**
 * Motiv podle `?theme=` v URL. Musí se zapsat do localStorage POD stejným
 * klíčem, jaký čte `useTheme` — ten totiž při připojení `TopBar`u s volbou
 * „system" atribut `data-theme` z <html> zase SMAZAL, takže tmavý screenshot
 * vycházel světlý (odhaleno hned na prvních screenshotech).
 */
function applyThemeFromQuery() {
  const theme = new URLSearchParams(window.location.search).get('theme')
  if (theme === 'dark' || theme === 'light') {
    localStorage.setItem('doprovazeni.theme', theme)
    document.documentElement.dataset.theme = theme
  }
}

applyThemeFromQuery()

/** Otevře pravý panel / záložku podle `?panel=` a `?tab=`, ať se dají
 * nafotit i stavy, ke kterým se jinak musí kliknout. */
function AutoInteract() {
  const location = useLocation()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) return
    const params = new URLSearchParams(window.location.search)
    const clickText = params.get('click')
    const tab = params.get('tab')
    const timer = setTimeout(() => {
      if (tab) {
        const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === tab)
        el?.click()
      }
      if (clickText) {
        const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim().includes(clickText))
        el?.click()
      }
      setDone(true)
    }, 400)
    return () => clearTimeout(timer)
  }, [location, done])

  return null
}

/**
 * Stejné přepnutí mobil/desktop jako v `App.tsx` — bez něj by náhled na
 * 390 px kreslil DESKTOPOVOU stránku do 390 px (odhaleno na prvním
 * mobilním screenshotu: sidebar 240 px + obsah 150 px = nesmysl, který
 * uživatel nikdy nevidí, protože skutečná appka tam servíruje mobilní
 * stránku).
 */
function Responsive({ mobile, desktop }: { mobile: ReactElement; desktop: ReactElement }) {
  return useIsMobile() ? mobile : desktop
}

/** Designové návrhy (`?lab=spis|faces|rail`) — samostatné vizuální jazyky
 * mimo appku, viz `lab/lab.css`. Nechodí přes router ani AuthContext,
 * protože nic z appky nepoužívají; to je celý smysl. */
const LAB_DIRECTIONS: Record<string, () => ReactElement> = {
  spis: DirectionSpis,
  faces: DirectionFaces,
  rail: DirectionRail,
  // Vybraný směr („Osa" v routine.co povrchu) na čtyřech různých
  // obrazovkách — vizuální jazyk se posuzuje na celku, ne na jedné stránce.
  'osa-dnes': OsaToday,
  'osa-rodiny': OsaFamilies,
  'osa-rodina': OsaFamily,
  'osa-kalendar': OsaCalendar,
  // Varianta „co nejblíž Routine" — dvoupanel úkoly + den s časem.
  'rt-dnes': RoutineToday,
}

function PreviewApp() {
  const lab = new URLSearchParams(window.location.search).get('lab')
  const Direction = lab ? LAB_DIRECTIONS[lab] : undefined
  if (Direction) return <Direction />

  const initial = new URLSearchParams(window.location.search).get('route') ?? '/rodiny'

  return (
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[initial]}>
        <AutoInteract />
        <Routes>
          <Route path="/" element={<Responsive mobile={<MobileHomePage />} desktop={<DashboardPage />} />} />
          <Route path="/rodiny" element={<Responsive mobile={<MobileFamiliesPage />} desktop={<FamilyListPage />} />} />
          <Route
            path="/rodiny/:familyUid"
            element={<Responsive mobile={<MobileFamilyDetailPage />} desktop={<FamilyDetailPage />} />}
          />
          <Route path="/deti" element={<Responsive mobile={<MobileChildListPage />} desktop={<ChildListPage />} />} />
          <Route
            path="/pestouni"
            element={<Responsive mobile={<MobileFosterPersonListPage />} desktop={<FosterPersonListPage />} />}
          />
          <Route path="/zamestnanci" element={<StaffPage />} />
          <Route path="/zamestnanci/:uid" element={<StaffDetailPage />} />
          <Route path="/kalendar" element={<Responsive mobile={<MobileCalendarPage />} desktop={<CalendarPage />} />} />
          <Route path="/ukoly" element={<Responsive mobile={<MobileTaskListPage />} desktop={<TaskListPage />} />} />
          <Route path="/zpravy" element={<MessengerPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>,
)
