import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Mic } from 'lucide-react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { VoiceCaptureSheet } from '@/components/mobile/VoiceCaptureSheet'
import { IosList, IosListRow } from '@/components/mobile/IosList'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { listCalendarEvents } from '@/services/calendarEventService'
import type { CalendarEventDoc } from '@/types/calendarEvent'

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

/**
 * `/` na mobilu/PWA (M11) — ÚPLNĚ jiná domovská obrazovka než desktopová
 * `DashboardPage` (viz `useIsMobile.ts`/`MobileShell.tsx` komentáře pro
 * proč). Petrovo přímé zadání: KO v terénu "nezajímá seznam klientů",
 * hlavní akce je nadiktovat zprávu → AI souhrn → poslat do osy — proto
 * velké kolo s mikrofonem je vizuálně DOMINANTNÍ prvek obrazovky, ne malé
 * tlačítko v rohu. Dnešní naplánované vlastní události (z Kalendáře,
 * `assignedToUid === já`) jsou jen kontext pod tím, ne hlavní obsah.
 */
export default function MobileHomePage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const [todayEvents, setTodayEvents] = useState<Array<{ docId: string; event: CalendarEventDoc }> | null>(null)
  const [capturing, setCapturing] = useState(false)

  async function reload() {
    if (!organizationId || !userDoc) return
    try {
      const all = await listCalendarEvents(organizationId)
      setTodayEvents(
        all
          .filter(
            ({ event }) =>
              event.status === 'planovano' && event.assignedToUid === userDoc.uid && isToday(event.start),
          )
          .sort((a, b) => Date.parse(a.event.start) - Date.parse(b.event.start)),
      )
    } catch {
      setTodayEvents([])
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Dobré ráno'
    if (hour < 18) return 'Dobrý den'
    return 'Dobrý večer'
  }, [])

  return (
    <MobileShell>
      <div className="relative flex min-h-full flex-col px-5 pb-28 pt-8">
        <p className="text-[32px] font-bold leading-tight tracking-tight text-text-primary">
          {greeting}, {userDoc?.displayName?.split(' ')[0] ?? ''}
        </p>

        <button
          type="button"
          onClick={() => setCapturing(true)}
          className="mx-auto mt-10 flex size-40 shrink-0 items-center justify-center rounded-full bg-danger-solid text-white shadow-overlay transition-transform duration-150 active:scale-95"
          aria-label="Nahrát hlasový zápis"
        >
          <Mic size={56} strokeWidth={1.75} />
        </button>
        <p className="mt-4 text-center text-[15px] text-text-secondary">Ťukněte a nadiktujte zápis</p>

        <div className="mt-10">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">Dnes máte</h2>
          <div className="mt-2">
            {todayEvents === null ? (
              <p className="text-[15px] text-text-secondary">Načítám…</p>
            ) : todayEvents.length === 0 ? (
              <EmptyState icon={CalendarClock} text="Dnes nemáte v kalendáři žádnou vlastní událost." />
            ) : (
              <IosList>
                {todayEvents.map(({ docId, event }) => (
                  <IosListRow key={docId} as="div">
                    <span className="shrink-0 text-[15px] font-medium text-text-primary">
                      {new Date(event.start).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-text-secondary">{event.title}</span>
                  </IosListRow>
                ))}
              </IosList>
            )}
          </div>
        </div>
      </div>

      {capturing && organizationId && userDoc && (
        <VoiceCaptureSheet
          organizationId={organizationId}
          createdByUid={userDoc.uid}
          onClose={() => setCapturing(false)}
          onSaved={reload}
        />
      )}
    </MobileShell>
  )
}
