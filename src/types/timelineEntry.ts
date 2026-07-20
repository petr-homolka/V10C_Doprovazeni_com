import type { SharingLevel } from './sharing'

/**
 * families/{familyId}/timeline/{id} — ZADANI §4.1/§7/§4.5. M2 postavilo jen
 * `createdByOrgId` scoping pro §4.5 rules testy — tenhle plný tvar (M3)
 * přidává `subjectRefs`/`sharingLevel`/obsah zápisu, per §7 hlasového
 * zápisníku.
 *
 * `subjectRefs` (§7.3) — JEDEN dokument, ne víc záznamů "za entitu": zápis
 * se týká víc entit najednou (rodina + konkrétní pěstoun/dítě), filtrování
 * "zápisy o dítěti X" = `subjectRefs array-contains {kind:'child', id:X}`.
 * `agreement` jako subjekt (Dohoda samotná, ne osoba) je rozšíření nad
 * rámec §7.3 příkladu, ale stejný princip — potřebné pro rychlý záznam
 * spuštěný z avataru Dohody (M3, avatar+mikrofon feature).
 *
 * `sharingLevel` (§7.4) výchozí `internal`, viz sharing.ts pro sdílený
 * model napříč timeline/chatem/dokumenty.
 *
 * `type: 'visit'` (GPS Giant Timer, §A3) — M3 stavěla postupně: nejdřív jen
 * `type: 'voice_entry'` (spontánní záznam z avataru), pak `startedAt`/
 * `endedAt`/`durationSeconds`/`location` skutečně naplnil Giant Timer flow
 * (VisitTimerPage.tsx + timelineService.createVisitTimelineEntry) — obě
 * cesty jsou teď plně postavené, ne jen jedna z nich.
 *
 * Editace existujícího zápisu (§7.7 "immutabilita pozastavena, ale audit
 * stopa povinná") NENÍ součástí týhle dávky — `firestore.rules` má pořád
 * `update: if false` (M2 placeholder), protože avatar+mikrofon vždy jen
 * ZAKLÁDÁ nový zápis, nikdy needituje starý. Až přijde skutečná editace
 * (časová osa/detail zápisu, §7.6), potřebuje se rozšířit `update` pravidlo
 * + append-only `history` podkolekce — SEAM, ne zapomenuté.
 */
export type TimelineEntryKind = 'note' | 'visit' | 'voice_entry' | 'system' | 'document'

export type SubjectRefKind = 'family' | 'fosterPerson' | 'child' | 'agreement'

export interface SubjectRef {
  kind: SubjectRefKind
  id: string
}

export interface TimelineEntryDoc {
  type: TimelineEntryKind
  createdByOrgId: string
  createdByUid: string
  occurredAt: string
  subjectRefs: SubjectRef[]
  sharingLevel: SharingLevel
  body: string
  /** Doslovný přepis PŘED AI úpravou — vyplněné, jen pokud zápis prošel AI
   * krokem (§7.5). Nikdy se nemaže, i když se v hlavním zobrazení
   * nepoužívá. AI krok samotný (§7.1 generating/done stavy) je zatím SEAM
   * (žádný AI backend v tomhle buildu, viz M10) — pole je tu připravené
   * pro budoucí použití, tahle dávka práce ho nikdy nezapisuje. */
  originalTranscript?: string | null
  // ---- jen type === 'visit' (§A3 Giant Timer, zatím nepostaveno) ----
  startedAt?: string
  endedAt?: string
  durationSeconds?: number
  location?: { lat: number; lng: number } | null
}
