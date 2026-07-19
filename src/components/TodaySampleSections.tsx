import { NotebookPen } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { FamilyCard } from '@/components/FamilyCard'

/**
 * "Čeká na vás" + "Poslední zápisy" — ukázková data sdílená mezi
 * DashboardPage a DesignPreviewPage (§11 "vzorek před sweepem"). Nahradit
 * skutečným dotazem nad Dohodami/timeline, jakmile existují (M2/M3) —
 * viz ZADANI §6 A3 bod 5.
 */
export function TodaySampleSections() {
  return (
    <>
      <section className="mt-8">
        <h2 className="text-lg font-normal leading-tight text-text-primary">Čeká na vás</h2>
        <div className="mt-3 flex flex-col gap-3">
          <FamilyCard
            initials="NK"
            name="Rodina Novákových"
            lastContactText="Poslední kontakt 12. 7. 2026 · klíčová pracovnice Jana M."
            badgeKind="foster"
            badgeLabel="Pěstounská rodina"
          />
          <FamilyCard
            initials="SV"
            name="Rodina Svobodových"
            lastContactText="Poslední kontakt 2. 6. 2026 · klíčová pracovnice Jana M."
            badgeKind="foster"
            badgeLabel="Pěstounská rodina"
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-normal leading-tight text-text-primary">Poslední zápisy</h2>
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
