/**
 * organizations/{orgId} — ZADANI §4.1/§4.3. `orgCode` je 4místný OOOO
 * segment UID (přiděleno jednorázově při registraci, viz
 * src/lib/orgCode.ts) — jiná věc než Firestore document ID `orgId`.
 * `capacityWarningThreshold` — §6 A9: orientační práh (výchozí 25 rodin
 * na KO), NIKDY tvrdý limit, jen jemné upozornění vedení. Skutečné
 * počítání zatížení KO čeká na `assignedTo` z M2 (Dohoda) — zatím jen pole
 * pro budoucí použití.
 */
export interface OrganizationDoc {
  orgCode: string
  name: string
  createdByUid: string
  createdAt: string
  capacityWarningThreshold: number
}

export const DEFAULT_CAPACITY_WARNING_THRESHOLD = 25
