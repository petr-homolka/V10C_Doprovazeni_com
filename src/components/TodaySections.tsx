import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarCheck, Cake, NotebookPen, PartyPopper } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { FamilyCard } from '@/components/FamilyCard'
import { useAuth } from '@/hooks/useAuth'
import {
  listBirthdayAlerts,
  listFamiliesAwaitingVisit,
  listOperationalAlerts,
  type FamilyAwaitingVisit,
  type OperationalAlert,
} from '@/services/dashboardService'

function initialsFor(label: string): string {
  const parts = label.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function lastContactText(lastVisitAt: string | null): string {
  if (!lastVisitAt) return 'Zatím žádná návštěva'
  return `Poslední návštěva ${new Date(lastVisitAt).toLocaleDateString('cs-CZ')}`
}

/**
 * "Čeká na vás" — §A3 bod 5, M3.4: nahrazuje dřívější ukázková data
 * skutečným dotazem (viz dashboardService.listFamiliesAwaitingVisit).
 *
 * Chyba dotazu se zobrazí jako text, NE potichu jako "žádná rodina nečeká"
 * (živě odhaleno 2026-07-19 recenzí — `.catch(() => setFamilies([]))`
 * dřív obojí splynulo, což je přesně opačný selhání-režim pro obrazovku,
 * jejíž smysl je upozornit na zpožděné návštěvy).
 *
 * "Poslední zápisy" ZŮSTÁVÁ placeholder — SEAM, mimo rozsah M3.4 (potřebuje
 * vlastní collectionGroup dotaz nad `timeline` napříč rodinami + nový
 * složený index, plánováno na samostatný průchod, ne izolovaně tady).
 */
export function TodaySections() {
  const { userDoc } = useAuth()
  const navigate = useNavigate()
  const [families, setFamilies] = useState<FamilyAwaitingVisit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<OperationalAlert[] | null>(null)
  const [alertsError, setAlertsError] = useState<string | null>(null)

  useEffect(() => {
    if (!userDoc?.organizationId) return
    listFamiliesAwaitingVisit(userDoc.organizationId)
      .then(setFamilies)
      .catch(() => setError('Přehled čekajících návštěv se nepodařilo načíst.'))
    // Narozeninová/jmeninová upozornění jsou OSOBNÍ preference, KAŽDÁ
    // NEZÁVISLE vypínatelná (`UserDoc.notifyBirthdays`/`notifyNameDays`,
    // výchozí obě zapnuté — `/nastaveni/kalendar`), proto samostatné
    // volání vedle `listOperationalAlerts` — ne jeho součást (ta funkce
    // nezná přihlášeného uživatele, jen organizaci).
    const includeBirthdays = userDoc.notifyBirthdays !== false
    const includeNameDays = userDoc.notifyNameDays !== false
    Promise.all([
      listOperationalAlerts(userDoc.organizationId),
      includeBirthdays || includeNameDays
        ? listBirthdayAlerts(userDoc.organizationId, { includeBirthdays, includeNameDays })
        : Promise.resolve([]),
    ])
      .then(([operational, birthdays]) => setAlerts([...birthdays, ...operational]))
      .catch(() => setAlertsError('Provozní upozornění se nepodařilo načíst.'))
  }, [userDoc?.organizationId, userDoc?.notifyBirthdays, userDoc?.notifyNameDays])

  return (
    <>
      <section className="mt-8">
        <h2 className="font-heading text-lg font-bold leading-tight text-text-primary">Čeká na vás</h2>
        <div className="mt-3 flex flex-col gap-3">
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : families === null ? (
            <p className="text-sm text-text-secondary">Načítám…</p>
          ) : families.length === 0 ? (
            <EmptyState icon={CalendarCheck} text="Žádná rodina teď nečeká na návštěvu." />
          ) : (
            families.map(({ docId, family, primaryFosterName, lastVisitAt, visitStatus, divergentFosterPerson }) => (
              <FamilyCard
                key={docId}
                onClick={() => navigate(`/rodiny/${family.uid}`)}
                initials={initialsFor(primaryFosterName ?? family.address ?? family.uid)}
                name={primaryFosterName ?? family.address ?? family.uid}
                lastContactText={lastContactText(lastVisitAt)}
                secondaryWarning={
                  divergentFosterPerson
                    ? `${divergentFosterPerson.name}: lhůta běží zvlášť (${lastContactText(divergentFosterPerson.lastVisitAt)})`
                    : undefined
                }
                visitStatus={visitStatus === 'waiting' ? undefined : visitStatus}
                badgeKind="foster"
                badgeLabel="Pěstounská rodina"
              />
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-bold leading-tight text-text-primary">Provozní upozornění</h2>
        <div className="mt-3 flex flex-col gap-2">
          {alertsError ? (
            <p className="text-sm text-danger" role="alert">
              {alertsError}
            </p>
          ) : alerts === null ? (
            <p className="text-sm text-text-secondary">Načítám…</p>
          ) : alerts.length === 0 ? (
            <EmptyState icon={AlertTriangle} text="Žádná provozní upozornění." />
          ) : (
            alerts.map((alert, i) => {
              // Narozeniny/svátek jsou milá připomínka, ne problém — vlastní
              // ikona a NEUTRÁLNÍ (ne žlutá "warning") barva, ať nepůsobí
              // jako chyba/prodlení mezi skutečnými provozními upozorněními.
              const isCelebration = alert.kind === 'birthday' || alert.kind === 'nameDay'
              const Icon = alert.kind === 'birthday' ? Cake : alert.kind === 'nameDay' ? PartyPopper : AlertTriangle
              return (
                <div
                  key={`${alert.kind}-${i}`}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    isCelebration ? 'bg-primary-soft text-primary' : alert.overdue ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{alert.text}</span>
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-bold leading-tight text-text-primary">Poslední zápisy</h2>
        <div className="mt-3">
          <EmptyState
            icon={NotebookPen}
            text="Zatím žádné záznamy z návštěv. Po první návštěvě je najdete tady."
            actionLabel="Přidat záznam"
          />
        </div>
      </section>
    </>
  )
}
