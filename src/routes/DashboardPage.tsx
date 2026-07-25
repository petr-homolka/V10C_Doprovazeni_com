import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/shell/AppShell'
import { PageHead } from '@/components/spis/PageBody'
import { SpisSection } from '@/components/spis/SpisSection'
import { TodaySections } from '@/components/TodaySections'
import { PersonLink } from '@/components/ui/person-link'
import { TeamWidget } from '@/components/TeamWidget'
import { listOverCapacityKos, type OverCapacityKo } from '@/services/agreementService'
import { isReadOnlyManagerRole } from '@/types/user'

/**
 * "Dnes" — DESIGN_SYSTEM.md vzorová obrazovka (§1, §4, §14). "Čeká na vás"
 * (TodaySections) je od M3.4 reálný dotaz nad Dohodami/`lastVisitAt`, viz
 * ZADANI §6 A3 bod 5 a dashboardService.ts.
 *
 * Souhrnný banner o přeplněné kapacitě KO (DOPLNENI_ZADANI-DO-M5 §1 bod
 * 5) — viditelný jen org_adminovi/vedení (§5.7 matice), NIKDY blokující,
 * jen upozornění (stejný princip jako `FamilyDetailPage`'s per-KO
 * upozornění při zakládání Dohody).
 *
 * Cesta D — přivítání nad titulkem + "Tým" widget (`TeamWidget`,
 * Woorkroom "Workload" vzor ze SPEC.md) doplněny nad stávající reálná
 * data `TodaySections`.
 */
export default function DashboardPage() {
  const { userDoc, firebaseUser } = useAuth()
  const [overCapacity, setOverCapacity] = useState<OverCapacityKo[]>([])

  const canSeeCapacityBanner =
    userDoc?.role === 'org_admin' || (userDoc && isReadOnlyManagerRole(userDoc.role))

  useEffect(() => {
    if (!canSeeCapacityBanner || !userDoc?.organizationId) return
    listOverCapacityKos(userDoc.organizationId).then(setOverCapacity).catch(() => setOverCapacity([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeCapacityBanner, userDoc?.organizationId])

  const firstName = (userDoc?.displayName ?? firebaseUser?.email ?? '').split(' ')[0]

  return (
    <AppShell>
      <PageHead title="Dnes" description={firstName ? `Vítejte zpět, ${firstName}.` : undefined}>
        {canSeeCapacityBanner && overCapacity.length > 0 && (
          <div className="border-l-2 border-accent pl-4">
            <p className="text-base text-text-primary">
            {overCapacity.length === 1
              ? '1 klíčová osoba má překročenou kapacitu'
              : `${overCapacity.length} klíčových osob má překročenou kapacitu`}
          </p>
            <p className="mt-1 text-sm text-text-tertiary">
              {/* Jména KO jsou prokliky na jejich profil — odtud se řeší,
               * proč mají překročenou kapacitu. */}
              {overCapacity.map((k, i) => (
                <span key={k.uid}>
                  {i > 0 && ', '}
                  <PersonLink kind="staff" id={k.uid} name={k.displayName} muted />
                  {` (${k.activeCaseload}/${k.threshold})`}
                </span>
              ))}
            </p>
          </div>
        )}
      </PageHead>

      {userDoc?.organizationId && (
        <SpisSection id="tym" title="Tým" description="Kdo je v organizaci a co má na sobě." lazy padded>
          <TeamWidget organizationId={userDoc.organizationId} />
        </SpisSection>
      )}

      <TodaySections />
    </AppShell>
  )
}
