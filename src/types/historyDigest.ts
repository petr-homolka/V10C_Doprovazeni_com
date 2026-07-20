/**
 * families/{familyId}/historyDigest/{id} — "nutné minimum", ZADANI §4.5.
 * SAMOSTATNÝ redukovaný záznam, ne filtr nad plným `timeline`/`documents`
 * dokumentem (Firestore rules umí jen povolit/zakázat CELÝ dokument).
 * - `timeline` záznam `visit` → zkopírují se JEN fakta (`durationSeconds`,
 *   `location`), NIKDY text poznámky/zápisu — M3 tohle generování skutečně
 *   staví, viz `timelineService.createVisitTimelineEntry` (JEDEN atomický
 *   batch s timeline zápisem samotným, ne samostatný job).
 * - `timeline` záznam `system` → celý (je to compliance) — zatím SEAM,
 *   `type: 'system'` timeline záznamy se v žádné dávce práce nezakládají.
 * - `documents/{docId}.status` dosáhne `odeslano_ospod`/`odeslano_soud` —
 *   SEAM, přijde s M5 (schvalovací automat dokumentů).
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
