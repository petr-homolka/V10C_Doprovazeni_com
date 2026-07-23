/**
 * Sdílená "hoří?" logika (UX zpětná vazba 2026-07-21, seznam Rodin) —
 * čtyřstupňová škála podle CRM praxe (šedá/žádná → žlutá "blíží se" →
 * červená PULZUJÍCÍ "naléhavé, ještě stihneš" → statický červený štítek
 * "Po termínu", už bez pulzování — pulz patří k "ještě je čas reagovat",
 * ne k "už je pozdě", `prefers-reduced-motion` navíc dostává statickou
 * náhradu i za pulz samotný, viz FamilyListPage).
 *
 * `computeVisitAlertTier` je PŘESNĚ stejný práh jako `dashboardService.ts`
 * (`WAITING_BUFFER_DAYS`/`WARNING_THRESHOLD_DAYS`, §A3 bod 5/§B.8) — přesunuto
 * sem jako jediný zdroj pravdy, dashboardService teď importuje odsud místo
 * vlastní kopie stejných čísel.
 */
export type AlertTier = 'ok' | 'waiting' | 'warning' | 'crisis'

export const WAITING_BUFFER_DAYS = 15
export const WARNING_THRESHOLD_DAYS = 45
const DAY_MS = 24 * 60 * 60 * 1000

export function daysSince(isoDate: string | null | undefined, now: number): number {
  return isoDate ? (now - Date.parse(isoDate)) / DAY_MS : Infinity
}

export function computeVisitAlertTier(daysSinceVisit: number, visitIntervalDays: number): AlertTier {
  if (daysSinceVisit > visitIntervalDays) return 'crisis'
  if (daysSinceVisit >= WARNING_THRESHOLD_DAYS) return 'warning'
  if (daysSinceVisit > visitIntervalDays - WAITING_BUFFER_DAYS) return 'waiting'
  return 'ok'
}

/** Na rozdíl od návštěvy (zákonná lhůta, §3) nemá konec Dohody dvoustupňový
 * předstih podložený zadáním — jeden 30denní práh na "blíží se konec",
 * nastavitelný podle zkušenosti z provozu, ne legislativní číslo. */
const AGREEMENT_EXPIRY_WARNING_DAYS = 30

export function computeAgreementExpiryTier(validTo: string | null | undefined, now: number): AlertTier {
  if (!validTo) return 'ok'
  const daysUntil = (Date.parse(validTo) - now) / DAY_MS
  if (daysUntil < 0) return 'crisis'
  if (daysUntil <= AGREEMENT_EXPIRY_WARNING_DAYS) return 'warning'
  return 'ok'
}

const TIER_RANK: Record<AlertTier, number> = { ok: 0, waiting: 1, warning: 2, crisis: 3 }

export interface FamilyAlert {
  tier: AlertTier
  reason: string
  action: string
}

export interface ActiveFamilyAlert {
  tier: Exclude<AlertTier, 'ok'>
  reason: string
  action: string
}

/** Vybere nejzávažnější z víc alertů pro jeden řádek seznamu Rodin — řádek
 * ukazuje jen JEDEN štítek (nejhorší), ne všechny najednou. */
export function pickWorstAlert(alerts: FamilyAlert[]): ActiveFamilyAlert | null {
  const active = alerts.filter((a): a is ActiveFamilyAlert => a.tier !== 'ok')
  return active.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])[0] ?? null
}

export const ALERT_TIER_LABELS: Record<Exclude<AlertTier, 'ok'>, string> = {
  waiting: 'Blíží se',
  warning: 'Naléhavé',
  crisis: 'Po termínu',
}
