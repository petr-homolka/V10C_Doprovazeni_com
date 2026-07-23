/**
 * Spolupracovník (UX zpětná vazba 2026-07-21, M9) — interní staff role
 * (`spolupracovnik`, viz src/types/user.ts) s VYSOCE zúženým přístupem:
 * na rozdíl od ostatních staff rolí NEVIDÍ celou organizaci, jen konkrétní
 * děti/pěstouny, co jim KO/vedení výslovně přiřadí. Architekturou
 * podobné M8 (external_participants grant engine), ale pro INTERNÍHO
 * zaměstnance (např. lektora doučování), ne externí osobu — proto
 * samostatný, jednodušší model: žádný schvalovací řetězec (KO/vedení
 * spolupracovníkovi už interně důvěřuje, jen mu omezuje rozsah), jen
 * přímé zapnutí/vypnutí modulů + přiřazení konkrétních osob.
 */

export type CollaboratorEntityType = 'child' | 'fosterPerson'

/** Katalog modulů, co může KO/vedení spolupracovníkovi zapnout/vypnout —
 * přesně seznam ze zadání (jméno, adresa, whatsapp, klíčová osoba, zápisy
 * do časové osy — čtení i zápis zvlášť, zápis hlavně pro výkaz práce). */
export const COLLABORATOR_MODULE_KEYS = [
  'viewName',
  'viewAddress',
  'viewPhone',
  'viewKeyPerson',
  'viewTimeline',
  'writeTimeline',
] as const
export type CollaboratorModuleKey = (typeof COLLABORATOR_MODULE_KEYS)[number]

export const COLLABORATOR_MODULE_LABELS: Record<CollaboratorModuleKey, string> = {
  viewName: 'Jméno',
  viewAddress: 'Adresa',
  viewPhone: 'Telefon / WhatsApp',
  viewKeyPerson: 'Klíčová osoba',
  viewTimeline: 'Číst časovou osu',
  writeTimeline: 'Zapisovat do časové osy (výkaz práce)',
}

/**
 * collaboratorAssignments/{collaboratorUid}_{entityType}_{entityId} —
 * deterministické ID (stejný vzor jako `AgreementDoc`, viz agreementService.ts)
 * umožňuje `firestore.rules` ověřit "má TENHLE spolupracovník přiřazenou
 * TUHLE osobu" přímým `exists()`, bez dotazu.
 *
 * `addressSnapshot`/`keyPersonNameSnapshot` — VĚDOMÝ snapshot z okamžiku
 * přiřazení, ne živý odkaz. Adresa žije jen na `FamilyDoc`, klíčová osoba
 * jen na Dohodě (`families/{id}/agreements/{orgId}`) — obojí by
 * spolupracovníkovi vyžadovalo další rules carve-out a řetězený `get()`
 * jen kvůli dvěma zobrazovacím polím. Stejná "provozní úspornost" jako
 * `primaryFosterName`/`historyDigest` jinde v appce — obnoví se
 * přepřiřazením, ne živě. Moduly (`viewAddress`/`viewKeyPerson`) řídí jen
 * to, jestli se snapshot zobrazí, ne jestli je čerstvý.
 */
export interface CollaboratorAssignmentDoc {
  organizationId: string
  collaboratorUid: string
  entityType: CollaboratorEntityType
  entityId: string
  entityName: string
  familyDocId: string
  familyUid: string
  addressSnapshot?: string | null
  /** Jen `entityType: 'fosterPerson'` — děti v týhle appce vlastní telefon
   * nemají (kontakt jde přes pěstouna), viz src/types/child.ts. */
  phoneSnapshot?: string | null
  keyPersonNameSnapshot?: string | null
  createdAt: string
  createdBy: string
}

/**
 * collaboratorAssignments/{assignmentId}/entries/{entryId} — spolupracovníkův
 * VLASTNÍ pracovní zápis (§"výkaz práce"), ZÁMĚRNĚ ne zápis do rodinné
 * `families/{id}/timeline` (ta má vlastní audit/OSPOD váhu a scoping —
 * míchat do ní zápisy od role s tak úzkým přístupem by ho rozostřilo).
 * KO/vedení organizace ho vidí pro kontrolu (stejné čtecí pravidlo jako
 * rodičovský `collaboratorAssignments` dokument), spolupracovník sám vidí
 * a zakládá jen svoje — nikdy needituje/nemaže (append-only, stejný
 * princip jako `GrantDoc`/`TimelineEntryDoc` jinde v appce).
 */
export interface CollaboratorEntryDoc {
  body: string
  occurredAt: string
  createdByUid: string
}
