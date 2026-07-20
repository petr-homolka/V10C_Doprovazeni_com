import type { FamilyDoc } from '@/types/family'

/**
 * Jednotný fallback řetězec pro zobrazovaný název rodiny (UX zpětná vazba
 * 2026-07-20) — použij VŠUDE, kde se rodina jmenuje (FamilyListPage,
 * FamilyDetailPage, breadcrumb na Dohodě/pěstounovi/dítěti), ať se
 * fallback nikdy nerozejde mezi místy. `primaryFosterName` je jméno
 * PRVNÍHO pěstouna Spisu (`fosterPersonRefs[0]`) — stejná konvence jako
 * `dashboardService.listFamiliesAwaitingVisit` už dřív používal, jen
 * vytažená do jednoho místa, aby se `displayName` editace mohla zapojit
 * bez duplicitní fallback logiky.
 */
export function resolveFamilyDisplayName(family: FamilyDoc, primaryFosterName?: string | null): string {
  return family.displayName || primaryFosterName || family.address || family.uid
}
