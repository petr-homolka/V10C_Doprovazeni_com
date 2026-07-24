import { families, agreementsByFamilyId, staff } from '../fixtures'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'

/**
 * Data pro designové návrhy (`src/preview/lab/`) — jeden a tentýž vstup pro
 * všechny směry, aby se porovnával DESIGN, ne obsah.
 *
 * Odvozené hodnoty (dny od poslední návštěvy, naléhavost) tady počítáme
 * jednoduše a natvrdo; skutečnou logiku má `familyAlertStatus.ts` a
 * návrh se o ni v téhle fázi nemusí opírat.
 */
export type Urgency = 'overdue' | 'soon' | 'ok'

export interface LabRow {
  id: string
  name: string
  address: string
  keyWorker: string | null
  keyWorkerAvatar?: string | null
  avatarUrl?: string | null
  lastVisit: string | null
  daysSince: number | null
  /** Kolik dní PO termínu (kladné) — pro směry, které to chtějí říct číslem. */
  daysOverdue: number | null
  urgency: Urgency
  children: number
  /** Rodina bez názvu i bez pěstouna spadne na adresu — pak se adresa nesmí
   * zobrazit ještě podruhé jako podtext (na screenshotu byla dvakrát). */
  nameIsAddress: boolean
}

const NOW = new Date('2026-07-24T10:00:00.000Z').getTime()

function daysBetween(iso: string): number {
  return Math.round((NOW - Date.parse(iso)) / 86_400_000)
}

export const labRows: LabRow[] = families
  .map(({ docId, family }) => {
    const agreement = agreementsByFamilyId[docId]
    const worker = staff.find((s) => s.uid === agreement?.assignedTo)
    const last = agreement?.lastVisitAt ?? null
    const daysSince = last ? daysBetween(last) : null
    const interval = agreement?.visitIntervalDays ?? 60
    const daysOverdue = daysSince != null ? daysSince - interval : null
    const urgency: Urgency =
      daysOverdue == null ? 'ok' : daysOverdue > 0 ? 'overdue' : daysOverdue > -14 ? 'soon' : 'ok'
    const name = resolveFamilyDisplayName(family, null)
    const address = family.address ?? 'Adresa neuvedena'
    return {
      id: docId,
      name,
      address,
      nameIsAddress: name === address,
      keyWorker: worker?.displayName ?? null,
      keyWorkerAvatar: worker?.avatarUrl ?? null,
      avatarUrl: family.avatarUrl,
      lastVisit: last,
      daysSince,
      daysOverdue,
      urgency,
      children: docId === 'f1' ? 2 : docId === 'f4' ? 2 : docId === 'f2' ? 1 : 0,
    }
  })
  .sort((a, b) => (b.daysOverdue ?? -999) - (a.daysOverdue ?? -999))

export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '—'
}

/** Iniciály pro případ, kdy fotka chybí — v návrzích běžný stav. */
export function initials(name: string): string {
  return name
    .replace(/^Rodina\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export const NAV_ITEMS = [
  'Dnes',
  'Rodiny',
  'Pěstouni',
  'Děti',
  'Zaměstnanci',
  'Úkoly',
  'Kalendář',
  'Zprávy',
  'Dokumenty',
]

export const currentUserName = 'Hana Procházková-Nováková'
