/**
 * families/{familyId}/historyDigest/{id} — "nutné minimum", ZADANI §4.5.
 * SAMOSTATNÝ redukovaný záznam, ne filtr nad plným `timeline`/`documents`
 * dokumentem (Firestore rules umí jen povolit/zakázat CELÝ dokument).
 * Vzniká automaticky (M3/M5 job, viz historyDigest.ts service — zatím jen
 * typ + rules, generování se zapojí až existují reálné timeline/dokumenty):
 * - `timeline` záznam `visit` → zkopírují se JEN fakta (`durationSeconds`,
 *   `location`), NIKDY text poznámky/zápisu.
 * - `timeline` záznam `system` → celý (je to compliance).
 * - `documents/{docId}.status` dosáhne `odeslano_ospod`/`odeslano_soud`.
 * Poznámky (`note`), hlasové zápisy (`voice_entry`) a dokumenty ve stavu
 * konceptu NIKDY nemají digest — pro ně tahle kolekce neexistuje vůbec.
 */
export type HistoryDigestDoc =
  | {
      kind: 'visit'
      createdByOrgId: string
      segmentValidTo: string | null
      occurredAt: string
      durationSeconds: number
      location?: string
    }
  | {
      kind: 'system'
      createdByOrgId: string
      segmentValidTo: string | null
      occurredAt: string
      eventType: string
      refIds: string[]
    }
  | {
      kind: 'document_sent'
      createdByOrgId: string
      segmentValidTo: string | null
      sentAt: string
      title: string
      sentTo: 'ospod' | 'soud'
      fileRef: string
    }
