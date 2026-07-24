import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/shell/AppShell'
import { PageHeader } from '@/components/ui/page-header'
import { TodaySections } from '@/components/TodaySections'
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

  return (
    <AppShell>
      <PageHeader
        title="Dnes"
        description={`Přihlášen jako ${userDoc?.displayName ?? firebaseUser?.email ?? ''}${userDoc?.role ? ` · ${userDoc.role}` : ''}`}
      />

      {canSeeCapacityBanner && overCapacity.length > 0 && (
        <div className="mt-4 max-w-[928px] rounded-lg border border-warning bg-warning-bg p-4">
          <p className="text-sm font-medium text-text-primary">
            {overCapacity.length === 1
              ? '1 klíčová osoba má překročenou kapacitu'
              : `${overCapacity.length} klíčových osob má překročenou kapacitu`}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {overCapacity.map((k) => `${k.displayName} (${k.activeCaseload}/${k.threshold})`).join(', ')}
          </p>
        </div>
      )}

      <TodaySections />
    </AppShell>
  )
}
