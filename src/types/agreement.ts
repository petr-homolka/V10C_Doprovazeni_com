import type { DataClassed } from '@/types/dataClass'

/**
 * families/{familyId}/agreements/{agreementId} — DOHODA, TT=90, ZADANI
 * §3/§4.1/§4.5/M2. Smluvní vztah mezi JEDNOU organizací a rodinou —
 * na rozdíl od Spisu má vlastní životnost (`validFrom`/`validTo`).
 *
 * **`agreementId` (Firestore document ID) JE `organizationId`** — vědomá
 * designová volba, ne náhoda. §4.5 předpokládá "jedna organizace má k
 * danému Spisu nejvýš jednu Dohodu v čase" (zjednodušující předpoklad pro
 * MVP) — deterministické ID z toho dělá strukturální vlastnost, ne
 * runtime kontrolu: druhý pokus o založení Dohody pro stejnou dvojici
 * (Spis, organizace) je automaticky UPDATE existujícího dokumentu (reálný
 * návrat organizace po přestávce = nová `validFrom`/`status: active` na
 * TOMTÉŽ dokumentu), ne kolize dvou různých dokumentů. Hlavní přínos:
 * `firestore.rules` (§4.5 "Pravidlo čtení") tak umí přímým `get()`/`exists()`
 * na `families/{familyId}/agreements/{organizationId}` ověřit "má
 * organizace O vlastní Dohodu na tenhle Spis" BEZ dotazu (rules dotaz nad
 * podkolekcí neumí) a BEZ jakékoli denormalizované kopie na Spisu — jeden
 * zdroj pravdy.
 *
 * `careType` určuje zákonný limit vzdělávání (§3): zprostředkovaná = 24 h/
 * 12 měsíců, nezprostředkovaná (příbuzenská) = 18 h — `educationHoursTarget`
 * se PŘEDVYPLNÍ podle typu při založení, ale zůstává editovatelné pole
 * (vedení smí lhůty prodloužit, §6 A9).
 *
 * `familyId` je Firestore document ID rodiče (interní odkaz, ne human-facing
 * uid) — uloženo redundantně, aby šlo číst i z collection-group dotazu
 * (`assignedTo`/kapacita KO), kde parent ID není jinak dostupné bez
 * dalšího čtení.
 */
export type CareType = 'zprostredkovana' | 'nezprostredkovana'
export type AgreementStatus = 'active' | 'ended'

export const EDUCATION_HOURS_TARGET: Record<CareType, number> = {
  zprostredkovana: 24,
  nezprostredkovana: 18,
}

export const DEFAULT_VISIT_INTERVAL_DAYS = 60 // "min. 1x za 2 měsíce"
export const DEFAULT_NOTE_DEADLINE_HOURS = 72

export interface AgreementDoc extends DataClassed {
  uid: string
  familyId: string
  organizationId: string
  careType: CareType
  status: AgreementStatus
  validFrom: string
  validTo?: string | null
  assignedTo?: string | null
  visitIntervalDays: number
  educationHoursTarget: number
  noteDeadlineHours: number
  createdAt: string
  /** Viz FamilyDoc stejnojmenné pole — import rollback (§5.5, M1.5). */
  createdByImportJobRef?: string

  /**
   * ARCHIVACE SEGMENTU — zadání 2026-07-25.
   *
   * Archivovaný spis se organizaci nezobrazuje v seznamech, nepracuje se
   * s ním a fulltext ho nenabízí; dostat se k němu jde jen vědomě, přes
   * sekci Archivováno. NENÍ to mazání ani zkrácení lhůty — data zůstávají
   * nedotčená, jen uklizená z cesty.
   *
   * Proč to sedí TADY a ne na `families/{id}`: Spis je sdílená entita
   * napříč organizacemi. Kdyby archivaci nesl Spis, jedna organizace by
   * schovala rodinu i té druhé, která s ní má živou Dohodu. Dohoda je
   * naopak přesně „vztah TÉHLE organizace k tomuhle spisu" (má
   * deterministické ID = organizationId), takže archivace je automaticky
   * per-organizace, bez nové kolekce a bez nových pravidel.
   */
  archivedAt?: string | null
  archivedBy?: string | null

  /**
   * Kdy se má vedení zeptat, co se spisem dál. Nastavuje se při ukončení
   * Dohody na `validTo` + 30 let (`lib/retentionPolicy.ts`). Ukládá se
   * jako HODNOTA, ne dopočet: kdyby se lhůta v budoucnu změnila, u už
   * ukončených Dohod má platit ta, která platila při ukončení.
   *
   * Uplynutí NIC nespouští automaticky — jen se objeví výzva.
   */
  retentionReviewDueAt?: string | null
  /** Viz FamilyDoc stejnojmenné pole — Cloud Storage avatar URL (M3). */
  avatarUrl?: string | null
  /**
   * §A3 bod 4: denormalizace z poslední `timeline` návštěvy (`type:
   * 'visit'`) TÉTO organizace, nastavuje `createVisitTimelineEntry` v
   * JEDNOM batchi se zápisem samotným. Základ pro "Čeká na vás" (§A3
   * bod 5) — M3.4.
   *
   * ŽIJE na Dohodě, NE na `FamilyDoc` (kde bydlelo v prvním návrhu M3.4,
   * živě opraveno 2026-07-19) — `families/{familyId}` čte NAVŽDY celá
   * `orgAccessList` (i organizace, jejichž Dohoda dávno skončila, §4.5),
   * takže poslední-návštěva ČASOVÝ ÚDAJ jiné, aktivní organizace by
   * unikal organizaci, která už s rodinou nemá vůbec nic společného —
   * přesně to, čemu má segmentovaný `historyDigest` model zabránit pro
   * VŠECHNA historická fakta. Dohoda (`families/{familyId}/agreements/
   * {organizationId}`) je čitelná JEN vlastní organizací
   * (`sameOrg(resource.data.organizationId)`), takže je to tady
   * strukturálně bezpečné bez jakékoli další rules změny.
   */
  lastVisitAt?: string | null
  /** UX zpětná vazba 2026-07-20 — Dohoda se nikdy neukončuje okamžitě.
   * Nastavené = ukončení je NAPLÁNOVANÉ k tomuhle budoucímu datu, `status`
   * mezitím zůstává `'active'` (Dohoda dál platí). Do tohoto data lze
   * naplánované ukončení kdykoli zrušit (`cancelPendingAgreementEnd`).
   * Skutečný přechod na `status:'ended'` provede LÍNĚ (bez cronu/Cloud
   * Function, žádné v týhle appce nejsou) `getActiveAgreement` při
   * dalším čtení, jakmile datum uplyne — viz agreementService.ts. */
  pendingEndDate?: string | null
}
