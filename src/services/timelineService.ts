import { collection, doc, getDocs, orderBy, query, setDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SubjectRef, TimelineEntryDoc, TimelineEntryKind } from '@/types/timelineEntry'
import type { SharingLevel } from '@/types/sharing'
import type { HistoryDigestDoc } from '@/types/historyDigest'

/**
 * Barrel service (ZADANI §11 bod 3) pro `families/{familyId}/timeline` —
 * M3. `createVoiceTimelineEntry` — cesta "avatar + mikrofon → rychlý
 * hlasový zápis" (viz VoiceRecorderPanel.tsx). `createVisitTimelineEntry`
 * — cesta §A3 Giant Timer (GPS, `startedAt`/`endedAt`), viz
 * useActiveVisit.ts + VisitTimerPage.tsx.
 *
 * `firestore.rules` vyžaduje AKTIVNÍ Dohodu volající organizace pro tenhle
 * Spis (`hasActiveAgreementFor`) — zápis pro rodinu bez aktivní Dohody
 * spadne na permission-denied, volající (panel) na to musí počítat.
 *
 * `listTimelineEntries` filtruje na `createdByOrgId` ze STEJNÉHO důvodu
 * jako jinde v projektu (§5 "List dotaz vs. pole v pravidle") —
 * `firestore.rules` `timeline` read čte `resource.data.createdByOrgId`,
 * dotaz ho musí zrcadlit, jinak Firestore zamítne CELÝ list dotaz.
 * Vyžaduje složený index (`createdByOrgId` + `occurredAt`), viz
 * firestore.indexes.json.
 *
 * SEAM (§7.4 "private (sobě)"): `listTimelineEntries` navíc KLIENTSKY
 * odfiltruje cizí `sharingLevel: 'private'` zápisy (`currentUid` parametr).
 * Firestore `firestore.rules` `timeline` read TOHLE samo nevynucuje —
 * živě ověřeno 2026-07-19, přidání `sharingLevel`/`createdByUid` podmínky
 * přímo do pravidla shodilo CELÝ list dotaz (Firestore u `list` operace
 * zamítne celý dotaz, pokud pravidlo čte pole mimo dotazovy vlastní
 * filtry — §5 past, viz firestore.rules komentář u `timeline` matche).
 * "Soukromá poznámka" je tak dnes vynucená jen na klientovi (stejná
 * důvěra ve staff jako jinde v appce), NE jako tvrdá Firestore hranice —
 * technicky zdatný kolega stejné organizace by ji přímým SDK voláním
 * pořád přečetl. Skutečná oprava (Firestore `or()` query filtr zrcadlený
 * v pravidle, nebo `private` poznámky v samostatné podkolekci) je SEAM
 * pro budoucí průchod.
 */
export interface CreateVoiceEntryInput {
  familyDocId: string
  organizationId: string
  createdByUid: string
  subjectRefs: SubjectRef[]
  sharingLevel: SharingLevel
  body: string
}

export async function createVoiceTimelineEntry(input: CreateVoiceEntryInput): Promise<void> {
  const ref = doc(collection(db, 'families', input.familyDocId, 'timeline'))
  const data: TimelineEntryDoc = {
    type: 'voice_entry' satisfies TimelineEntryKind,
    createdByOrgId: input.organizationId,
    createdByUid: input.createdByUid,
    occurredAt: new Date().toISOString(),
    subjectRefs: input.subjectRefs,
    sharingLevel: input.sharingLevel,
    body: input.body,
  }
  await setDoc(ref, data)
}

export interface CreateVisitEntryInput {
  familyDocId: string
  organizationId: string
  createdByUid: string
  subjectRefs: SubjectRef[]
  sharingLevel: SharingLevel
  body: string
  startedAt: string
  endedAt: string
  durationSeconds: number
  location: { lat: number; lng: number } | null
  /** DOPLNENI_ZADANI-DO-M5 §2 — `fosterPersons/{id}.lastVisitAt` per OSOBU,
   * NEZÁVISLE na `sharingLevel` (jestli o návštěvě pěstoun uvidí zápis, je
   * jiná otázka než komu se návštěva reálně týkala). Volající
   * (VoiceRecorderPanel) je odvodí ze STEJNÉ logiky, co postavila
   * `subjectRefs` — oba pěstouni při "Sdílet s oběma" (výchozí), jen
   * vybraný jeden při vypnutém přepínači. */
  stampFosterPersonIds?: string[]
}

/**
 * §A3 bod 4: uložení zápisu z návštěvy je JEDEN atomický batch — timeline
 * zápis (`type: 'visit'`) + `historyDigest` (M3.3, jen fakta:
 * `durationSeconds`/`location`, NIKDY text) + denormalizace `lastVisitAt`
 * (§A3 bod 5, "Čeká na vás"). `firestore.rules` vyhodnocuje KAŽDÝ dokument
 * v batchi samostatně (batch není obchvat pravidel) — timeline create
 * vyžaduje `hasActiveAgreementFor`, historyDigest create od živé opravy
 * 2026-07-19 TAKÉ (viz firestore.rules komentář), Dohoda update beze změny
 * `organizationId`/`familyId` je vlastní organizaci vždy povolený — všechny
 * tři projdou nebo batch spadne celý najednou (atomicita).
 *
 * `lastVisitAt` se zapisuje na VLASTNÍ Dohodu volající organizace
 * (`families/{familyId}/agreements/{organizationId}`), NE na `FamilyDoc` —
 * živě opraveno 2026-07-19, viz `AgreementDoc.lastVisitAt` komentář pro
 * proč (cross-org únik časového údaje přes `orgAccessList`, které
 * nevyprší).
 *
 * `historyDigest.segmentValidTo` je VŽDY `null` v okamžiku vzniku (Dohoda
 * volající organizace musí být aktivní, jinak by timeline zápis samotný
 * spadl na permission-denied) — SEAM: zpětné dorovnání na `validTo` při
 * ukončení Dohody (aby cizí organizace po skončení téhle Dohody získala
 * §4.5 bod 2 přístup k digestu) NENÍ v týhle dávce postavené, viz
 * `agreementService.endAgreement` komentář. Než tenhle SEAM existuje,
 * `historyDigest` z aktivní Dohody zůstává čitelný JEN vlastní organizaci —
 * bezpečná (příliš přísná, ne děravá) prozatímní odchylka od §4.5.
 */
export async function createVisitTimelineEntry(input: CreateVisitEntryInput): Promise<void> {
  const entryRef = doc(collection(db, 'families', input.familyDocId, 'timeline'))
  const digestRef = doc(collection(db, 'families', input.familyDocId, 'historyDigest'))
  const agreementRef = doc(db, 'families', input.familyDocId, 'agreements', input.organizationId)

  const entryData: TimelineEntryDoc = {
    type: 'visit' satisfies TimelineEntryKind,
    createdByOrgId: input.organizationId,
    createdByUid: input.createdByUid,
    occurredAt: input.startedAt,
    subjectRefs: input.subjectRefs,
    sharingLevel: input.sharingLevel,
    body: input.body,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationSeconds: input.durationSeconds,
    location: input.location,
  }
  const digestData: HistoryDigestDoc = {
    kind: 'visit',
    createdByOrgId: input.organizationId,
    segmentValidTo: null,
    occurredAt: input.startedAt,
    durationSeconds: input.durationSeconds,
    ...(input.location ? { location: `${input.location.lat.toFixed(4)}, ${input.location.lng.toFixed(4)}` } : {}),
  }

  const batch = writeBatch(db)
  batch.set(entryRef, entryData)
  batch.set(digestRef, digestData)
  batch.update(agreementRef, { lastVisitAt: input.endedAt })
  for (const fosterPersonId of input.stampFosterPersonIds ?? []) {
    batch.update(doc(db, 'fosterPersons', fosterPersonId), { lastVisitAt: input.endedAt })
  }
  await batch.commit()
}

export async function listTimelineEntries(
  familyDocId: string,
  organizationId: string,
  currentUid: string,
): Promise<Array<{ docId: string; entry: TimelineEntryDoc }>> {
  const q = query(
    collection(db, 'families', familyDocId, 'timeline'),
    where('createdByOrgId', '==', organizationId),
    orderBy('occurredAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ docId: d.id, entry: d.data() as TimelineEntryDoc }))
    .filter(({ entry }) => entry.sharingLevel !== 'private' || entry.createdByUid === currentUid)
}
