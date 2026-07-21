import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { allocateUid } from '@/lib/counters'
import { getOrganization, getPlatformDefaults } from '@/services/organizationService'
import { getStaffMember, listStaff } from '@/services/staffService'
import { computeEffectiveCapacityThreshold } from '@/lib/capacityThreshold'
import { DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD } from '@/types/platformDefaults'
import {
  DEFAULT_NOTE_DEADLINE_HOURS,
  DEFAULT_VISIT_INTERVAL_DAYS,
  EDUCATION_HOURS_TARGET,
  type AgreementDoc,
  type CareType,
} from '@/types/agreement'
import { resetEducationWindowForNewAgreement } from '@/services/courseService'

/**
 * Barrel service (ZADANI §11 bod 3) pro Dohodu — M2. Dohoda má
 * DETERMINISTICKÉ Firestore document ID (= organizationId, viz
 * AgreementDoc komentář) — `firestore.rules` na tom staví celé §4.5
 * "Pravidlo čtení", nikdy tohle neměň bez souběžné úpravy pravidel.
 *
 * `createAgreement` zakládá Dohodu jako PRVNÍ zápis, teprve POTOM
 * rozšiřuje family/fosterPersons `orgAccessList` a cascaduje
 * `children.organizationId` — stejný sekvenční vzor jako M1 self-
 * registrace, a `firestore.rules` tuhle posloupnost teď i vyžadují
 * (`hasOwnAgreementFor` kontroluje, že Dohoda už existuje, než dovolí
 * orgAccessList rozšířit).
 *
 * WF-3 (Předání rodiny jiné organizaci, §12 backlog) NENÍ v M2 postaveno
 * — `createAgreement` počítá jen s PRVNÍ Dohodou na Spis pro danou
 * organizaci (zjednodušující předpoklad §4.5). Transfer na JINOU
 * organizaci (ukončit starou Dohodu jinde + založit novou tady) je mimo
 * rozsah M2, i když to `firestore.rules` už strukturálně unesou.
 */

export function agreementRef(familyDocId: string, organizationId: string) {
  return doc(db, 'families', familyDocId, 'agreements', organizationId)
}

/**
 * UX zpětná vazba 2026-07-20 — Dohoda se nikdy neukončuje okamžitě
 * (`scheduleAgreementEnd` jen naplánuje budoucí `pendingEndDate`). Žádný
 * cron/Cloud Function v týhle appce neexistuje, takže přechod na
 * `status:'ended'` provádí LÍNĚ tenhle čtecí endpoint — jakmile naplánované
 * datum uplyne, PRVNÍ příští čtení Dohody (odkudkoli) transakčně dopíše
 * `status`/`validTo` a vrátí už aktualizovaný stav, ne stará data.
 */
export async function getActiveAgreement(
  familyDocId: string,
  organizationId: string,
): Promise<AgreementDoc | null> {
  const ref = agreementRef(familyDocId, organizationId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as AgreementDoc
  if (data.status === 'active' && data.pendingEndDate && new Date(data.pendingEndDate) <= new Date()) {
    const applied = { status: 'ended' as const, validTo: data.pendingEndDate, pendingEndDate: null }
    await updateDoc(ref, applied)
    return { ...data, ...applied }
  }
  return data
}

/** Naplánuje budoucí ukončení Dohody — `status` zůstává `'active'` po
 * celou dobu čekací lhůty, viz `AgreementDoc.pendingEndDate` komentář. */
export async function scheduleAgreementEnd(
  familyDocId: string,
  organizationId: string,
  endDate: string,
): Promise<void> {
  await updateDoc(agreementRef(familyDocId, organizationId), { pendingEndDate: endDate })
}

/** Zruší naplánované ukončení (dostupné, dokud naplánované datum
 * neuplyne — po uplynutí `getActiveAgreement` ukončení už NEVRATNĚ uplatní). */
export async function cancelPendingAgreementEnd(familyDocId: string, organizationId: string): Promise<void> {
  await updateDoc(agreementRef(familyDocId, organizationId), { pendingEndDate: null })
}

/** "Předat" (UX zpětná vazba 2026-07-21) — přeřazení klíčové osoby na
 * VLASTNÍ Dohodě volající organizace (`assignedTo`). Protože `agreementId
 * === organizationId` (viz AgreementDoc), je vždy jednoznačné, kterou
 * Dohodu rodiny přeřazujeme — žádné hledání "aktivní" mezi víc dokumenty. */
export async function updateAgreementAssignedTo(
  familyDocId: string,
  organizationId: string,
  assignedTo: string | null,
): Promise<void> {
  await updateDoc(agreementRef(familyDocId, organizationId), { assignedTo })
}

export interface CreateAgreementInput {
  familyDocId: string
  organizationId: string
  orgCode: string
  careType: CareType
  assignedTo?: string
  /** Import (§5.5, M1.5) často zakládá historickou Dohodu — bez tohohle
   * by `createAgreement` vždy natvrdo použilo "teď", což by ztratilo
   * skutečné datum ze zdrojových dat organizace. Ruční založení (UI) tohle
   * pole nepředává, chová se tedy přesně jako dřív (výchozí "teď"). */
  validFrom?: string
  /** §47b zákona 359/1999 Sb. — Dohoda se standardně uzavírá na dobu
   * určitou (viz src/lib/agreementDuration.ts pro odhad délky), ale appka
   * nikdy nevynucuje konkrétní datum — `null` = zatím bez plánovaného
   * konce (stejné chování jako dřív, když tohle pole neexistovalo). */
  validTo?: string | null
  /** Viz FamilyDoc stejnojmenné pole — import rollback (§5.5, M1.5). */
  createdByImportJobRef?: string
}

export async function createAgreement(input: CreateAgreementInput): Promise<AgreementDoc> {
  const { familyDocId, organizationId, orgCode, careType, assignedTo, validFrom, validTo, createdByImportJobRef } = input
  const uid = await allocateUid(organizationId, orgCode, 'agreement')
  const data: AgreementDoc = {
    uid,
    familyId: familyDocId,
    organizationId,
    careType,
    status: 'active',
    validFrom: validFrom ?? new Date().toISOString(),
    validTo: validTo ?? null,
    assignedTo: assignedTo ?? null,
    visitIntervalDays: DEFAULT_VISIT_INTERVAL_DAYS,
    educationHoursTarget: EDUCATION_HOURS_TARGET[careType],
    noteDeadlineHours: DEFAULT_NOTE_DEADLINE_HOURS,
    createdAt: new Date().toISOString(),
    ...(createdByImportJobRef ? { createdByImportJobRef } : {}),
  }
  // 1) Dohoda VŽDY první — firestore.rules na její existenci staví
  // rozšíření orgAccessList níž (hasOwnAgreementFor).
  await setDoc(agreementRef(familyDocId, organizationId), data)

  // 2) Family + fosterPersons orgAccessList — teprve TEĎ, kdy Dohoda už
  // existuje a rules ji uznají jako důkaz oprávněnosti.
  const familyRef = doc(db, 'families', familyDocId)
  const familySnap = await getDoc(familyRef)
  await updateDoc(familyRef, { orgAccessList: arrayUnion(organizationId) })

  const fosterPersonRefs = (familySnap.data()?.fosterPersonRefs as string[] | undefined) ?? []
  await Promise.all(
    fosterPersonRefs.map((fosterId) =>
      updateDoc(doc(db, 'fosterPersons', fosterId), { orgAccessList: arrayUnion(organizationId) }),
    ),
  )

  // 2b) §47a odst. 3 ZSPOD: nová Dohoda resetuje vzdělávací okno KAŽDÉHO
  // pěstouna rodiny (přebytek hodin se "bankuje" do nového okna) — viz
  // courseService.resetEducationWindowForNewAgreement komentář.
  await Promise.all(
    fosterPersonRefs.map((fosterId) =>
      resetEducationWindowForNewAgreement(
        fosterId,
        `families/${familyDocId}/agreements/${organizationId}`,
        careType,
        data.validFrom,
      ),
    ),
  )

  // 3) Dětem rodiny se cascaduje `organizationId` (§4.2 bod 7: denormalizace
  // z AKTIVNÍ Dohody). M2 řeší jen "první Dohoda" scénář (viz komentář
  // nahoře) — děti tu ještě nemají organizationId nastavené na JINOU
  // organizaci, takže tohle je vždy stejnoorganizační zápis.
  const childrenSnap = await getDocs(
    query(collection(db, 'children'), where('familyId', '==', familyDocId)),
  )
  await Promise.all(
    childrenSnap.docs.map((childDoc) => updateDoc(childDoc.ref, { organizationId })),
  )

  return data
}

/**
 * SEAM (M3.3, viz timelineService.createVisitTimelineEntry komentář):
 * `getActiveAgreement`'s líný přechod na `status:'ended'` výš
 * NEDOROVNÁVÁ zpětně `historyDigest.segmentValidTo` z `null` na
 * `validTo` pro digesty, co tahle organizace pro tenhle Spis vytvořila —
 * `historyDigest` je append-only (`update: if false`), takže dokud tahle
 * reconciliace neexistuje (a s ní úzká rules výjimka pro přesně tenhle
 * jeden přechod null→validTo, ne libovolný update), zůstávají všechny
 * digesty téhle organizace pro tenhle Spis čitelné JEN jí samotné, i po
 * skončení Dohody — §4.5 bod 2 (cizí organizace čte digest dřívějšího
 * segmentu) se tak zatím nikdy neaktivuje. Bezpečně přísná odchylka
 * (míň sdílení, ne víc), ne díra — ale patří sem zpět, až přijde WF-3
 * (Předání rodiny jiné organizaci, §12).
 */

/**
 * §6 A9 / DOPLNENI_ZADANI-DO-M5 §1: kapacita KO je orientační (NIKDY
 * tvrdý limit) — vrací jen počet + efektivní práh, volající (UI)
 * rozhodne, jestli zobrazí jemné upozornění. Efektivní práh = kaskáda
 * (per-KO override ?? org práh ?? platformní výchozí) × FTE dané KO,
 * viz `computeEffectiveCapacityThreshold`. Collection-group dotaz MUSÍ
 * filtrovat i na `organizationId` (ne jen `assignedTo`+`status`) ze
 * STEJNÉHO důvodu jako jinde v tomhle souboru — firestore.rules
 * `agreements` read čte `organizationId`, dotaz ho musí zrcadlit.
 */
export interface KoCapacityCheck {
  activeCaseload: number
  threshold: number
  overThreshold: boolean
}

export async function checkKoCapacity(
  organizationId: string,
  koUid: string,
): Promise<KoCapacityCheck> {
  const [org, koUserDoc, platformDefaults, snap] = await Promise.all([
    getOrganization(organizationId),
    getStaffMember(koUid),
    getPlatformDefaults(),
    getDocs(
      query(
        collectionGroup(db, 'agreements'),
        where('organizationId', '==', organizationId),
        where('assignedTo', '==', koUid),
        where('status', '==', 'active'),
      ),
    ),
  ])
  const threshold = computeEffectiveCapacityThreshold(
    koUserDoc?.fte,
    koUserDoc?.capacityThresholdOverride,
    org?.koCapacityThreshold,
    platformDefaults?.koCapacityThreshold ?? DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD,
  )
  const activeCaseload = snap.size
  return { activeCaseload, threshold, overThreshold: activeCaseload >= threshold }
}

/**
 * Souhrnný přehled zatížení VŠECH KO organizace najednou (DOPLNENI_ZADANI-
 * DO-M5 §1 bod 5) — JEDEN dotaz (`organizationId`+`status`, žádný
 * `assignedTo` filtr), seskupení po `assignedTo` proběhne až klientsky
 * (ne N dotazů, jeden na KO — §10 provozní úspornost). Používá už existující
 * composite index (`organizationId`+`status`, `firestore.indexes.json`) —
 * žádný nový index není potřeba.
 */
export async function listActiveCaseloadByKo(organizationId: string): Promise<Record<string, number>> {
  const snap = await getDocs(
    query(
      collectionGroup(db, 'agreements'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'active'),
    ),
  )
  const counts: Record<string, number> = {}
  for (const d of snap.docs) {
    const assignedTo = (d.data() as AgreementDoc).assignedTo
    if (assignedTo) counts[assignedTo] = (counts[assignedTo] ?? 0) + 1
  }
  return counts
}

export interface OverCapacityKo {
  uid: string
  displayName: string
  activeCaseload: number
  threshold: number
}

/** Souhrnné varování org_adminovi/vedení (DOPLNENI_ZADANI-DO-M5 §1 bod
 * 5) — kdo z organizace má PRÁVĚ TEĎ přeplněnou kapacitu, efektivní práh
 * počítaný stejnou kaskádou jako `checkKoCapacity`. */
export async function listOverCapacityKos(organizationId: string): Promise<OverCapacityKo[]> {
  const [staff, caseloadByKo, org, platformDefaults] = await Promise.all([
    listStaff(organizationId),
    listActiveCaseloadByKo(organizationId),
    getOrganization(organizationId),
    getPlatformDefaults(),
  ])
  const platformThreshold = platformDefaults?.koCapacityThreshold ?? DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD
  return staff
    .map((member) => {
      const activeCaseload = caseloadByKo[member.uid] ?? 0
      const threshold = computeEffectiveCapacityThreshold(
        member.fte,
        member.capacityThresholdOverride,
        org?.koCapacityThreshold,
        platformThreshold,
      )
      return { uid: member.uid, displayName: member.displayName, activeCaseload, threshold }
    })
    .filter((k) => k.activeCaseload > 0 && k.activeCaseload >= k.threshold)
}

/** Seznam Rodin (UX zpětná vazba 2026-07-21) — vlastní AKTIVNÍ Dohoda pro
 * KAŽDÝ Spis organizace, klíčováno `familyId` (stejný `collectionGroup`
 * dotaz/index jako `listFamiliesAwaitingVisit` v dashboardService.ts, jen
 * bez následného filtrování na "už přehledné" — tady se dál rozhoduje
 * podle KO/termínu/stavu pro VŠECHNY, ne jen pro overdue). Spisy bez
 * aktivní Dohody týhle organizace (jen historická návaznost, §4.5) v
 * mapě chybí — volající to čte jako "žádná KO, žádný termín ke sledování". */
export async function listActiveAgreementsForOrg(organizationId: string): Promise<Record<string, AgreementDoc>> {
  const snap = await getDocs(
    query(
      collectionGroup(db, 'agreements'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'active'),
    ),
  )
  const byFamilyId: Record<string, AgreementDoc> = {}
  for (const d of snap.docs) {
    const agreement = d.data() as AgreementDoc
    byFamilyId[agreement.familyId] = agreement
  }
  return byFamilyId
}
