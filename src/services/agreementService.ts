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
import { actorFields, recordAudit } from '@/services/auditLogService'
import type { AuditActor } from '@/types/auditLog'
import { retentionReviewDueDate } from '@/lib/retentionPolicy'
import { isTestData } from '@/types/dataClass'
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
import { assertCanOpenTitle, claimTitle, setTitleEnd } from '@/services/titleRegistryService'

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
 * UID pěstounů rodiny. Rejstřík titulů je vedený na OSOBĚ PEČUJÍCÍ, ne na
 * rodině — výlučnost je zákonná vlastnost člověka, ne domácnosti.
 */
async function fosterUidsOfFamily(familyDocId: string): Promise<string[]> {
  const familySnap = await getDoc(doc(db, 'families', familyDocId))
  const refs = (familySnap.data()?.fosterPersonRefs as string[] | undefined) ?? []
  const uids = await Promise.all(
    refs.map(async (fosterId) => {
      const snap = await getDoc(doc(db, 'fosterPersons', fosterId))
      return snap.data()?.uid as string | undefined
    }),
  )
  return uids.filter((u): u is string => !!u)
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
    const applied = {
      status: 'ended' as const,
      validTo: data.pendingEndDate,
      pendingEndDate: null,
      // Skončením Dohody se rozbíhá třicetiletá archivační doba. Termín se
      // ZAPISUJE, ne dopočítává při každém čtení: kdyby se lhůta v zákoně
      // změnila, u téhle Dohody má platit ta, která platila při ukončení.
      // Testovacích dat se lhůty netýkají (zadání 2026-07-25).
      ...(isTestData(data) ? {} : { retentionReviewDueAt: retentionReviewDueDate(data.pendingEndDate) }),
    }
    await updateDoc(ref, applied)
    return { ...data, ...applied }
  }
  return data
}

/**
 * ARCHIVACE SEGMENTU — spis zmizí organizaci z cesty, ale nikam se
 * neztratí. Viz `AgreementDoc.archivedAt` pro to, proč sedí na Dohodě
 * a ne na Spisu.
 *
 * Archivovat jde jen UKONČENOU Dohodu. Archivovat rodinu, se kterou
 * organizace pořád pracuje, nedává smysl a byla by to nejrychlejší cesta,
 * jak si omylem schovat živý případ.
 */
export async function archiveSegment(
  familyDocId: string,
  organizationId: string,
  audit: { actor: AuditActor; familyLabel: string },
): Promise<void> {
  const agreement = await getActiveAgreement(familyDocId, organizationId)
  if (!agreement) throw new Error('Dohoda neexistuje.')
  if (agreement.status !== 'ended') {
    throw new Error('Archivovat lze jen spis s ukončenou Dohodou.')
  }
  const now = new Date().toISOString()
  await updateDoc(agreementRef(familyDocId, organizationId), {
    archivedAt: now,
    archivedBy: audit.actor.uid,
  })
  await recordAudit({
    organizationId,
    action: 'segment_archived',
    ...actorFields(audit.actor),
    subject: { kind: 'family', id: familyDocId, label: audit.familyLabel },
    detail: 'Spis přesunut do archivu. Data zůstávají beze změny.',
  })
}

/** Vrácení z archivu do běžného provozu. */
export async function unarchiveSegment(
  familyDocId: string,
  organizationId: string,
  audit: { actor: AuditActor; familyLabel: string },
): Promise<void> {
  await updateDoc(agreementRef(familyDocId, organizationId), { archivedAt: null, archivedBy: null })
  await recordAudit({
    organizationId,
    action: 'segment_unarchived',
    ...actorFields(audit.actor),
    subject: { kind: 'family', id: familyDocId, label: audit.familyLabel },
  })
}

/** Naplánuje budoucí ukončení Dohody — `status` zůstává `'active'` po
 * celou dobu čekací lhůty, viz `AgreementDoc.pendingEndDate` komentář. */
export async function scheduleAgreementEndAudited(
  familyDocId: string,
  organizationId: string,
  pendingEndDate: string,
  audit: { actor: AuditActor; familyLabel: string },
): Promise<void> {
  await scheduleAgreementEnd(familyDocId, organizationId, pendingEndDate)
  await recordAudit({
    organizationId,
    action: 'agreement_end_scheduled',
    ...actorFields(audit.actor),
    subject: { kind: 'family', id: familyDocId, label: audit.familyLabel },
    detail: `Ukončení naplánováno na ${pendingEndDate.slice(0, 10)}.`,
  })
}

export async function cancelPendingAgreementEndAudited(
  familyDocId: string,
  organizationId: string,
  audit: { actor: AuditActor; familyLabel: string },
): Promise<void> {
  await cancelPendingAgreementEnd(familyDocId, organizationId)
  await recordAudit({
    organizationId,
    action: 'agreement_end_cancelled',
    ...actorFields(audit.actor),
    subject: { kind: 'family', id: familyDocId, label: audit.familyLabel },
  })
}

export async function scheduleAgreementEnd(
  familyDocId: string,
  organizationId: string,
  endDate: string,
): Promise<void> {
  await updateDoc(agreementRef(familyDocId, organizationId), { pendingEndDate: endDate })

  // Konec se PROMÍTNE DO REJSTŘÍKU hned při naplánování, ne až při ukončení.
  //
  // Je to schválně tady a ne v `getActiveAgreement`: tam se ukončení sice
  // fyzicky uplatní, jenže ta funkce běží při každém otevření spisu a
  // dotahovat v ní UID pěstounů by znamenalo dva dotazy navíc na každé
  // zobrazení. Rejstřík si díky `validTo` uvolní sám — uplynulý titul
  // neběží, i když už na něj nikdo nesáhne. Kdyby uvolnění záviselo na
  // zápisu, jeden zapomenutý by UID zablokoval napořád.
  const uids = await fosterUidsOfFamily(familyDocId)
  await Promise.all(uids.map((uid) => setTitleEnd(uid, endDate, organizationId)))
}

/** Zruší naplánované ukončení (dostupné, dokud naplánované datum
 * neuplyne — po uplynutí `getActiveAgreement` ukončení už NEVRATNĚ uplatní). */
export async function cancelPendingAgreementEnd(familyDocId: string, organizationId: string): Promise<void> {
  await updateDoc(agreementRef(familyDocId, organizationId), { pendingEndDate: null })

  const agreement = await getActiveAgreement(familyDocId, organizationId)
  const uids = await fosterUidsOfFamily(familyDocId)
  await Promise.all(
    uids.map((uid) =>
      claimTitle({
        uid,
        holderOrgId: organizationId,
        validFrom: agreement?.validFrom ?? new Date().toISOString(),
        validTo: agreement?.validTo ?? null,
      }),
    ),
  )
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
  /**
   * Auditní kontext. POVINNÝ: založení Dohody je okamžik, kdy spis (a s ním
   * údaje o dítěti) vstupuje do organizace — přesně to, co musí být
   * doložitelné. `null` smí předat JEN import, který běží dávkově pod
   * jedním jobem a má vlastní stopu (`importJobs`).
   */
  audit: { actor: AuditActor; familyLabel: string } | null
  /**
   * Jediná zákonná výjimka z „nejvýš jeden titul" (metodika MPSV): manželé,
   * kteří spolu NEŽIJÍ, každý s dítětem ve výlučné péči.
   *
   * Volitelné schválně — a je to bezpečné, protože výchozí `false` je ta
   * PŘÍSNĚJŠÍ varianta. Kdo na parametr zapomene, dostane blokaci, ne
   * povolení. (Auditní kontext je naopak povinný, protože tam zapomenutí
   * znamená chybějící stopu — opačný směr chyby.)
   */
  spousesLivingApart?: boolean
  /**
   * Přeskočí kontrolu výlučnosti. JEN PRO IMPORT historických dat, kde se
   * zakládají už zaniklé Dohody a rejstřík by je vyhodnotil jako konflikt.
   */
  skipExclusivityCheck?: boolean
}

export async function createAgreement(input: CreateAgreementInput): Promise<AgreementDoc> {
  const { familyDocId, organizationId, orgCode, careType, assignedTo, validFrom, validTo, createdByImportJobRef } = input

  // 0) VÝLUČNOST TITULU — dřív než cokoli jiného.
  //
  // Metodika MPSV: osoba pečující smí mít v daném čase jen jeden právní
  // titul doprovázení. Tohle je jediné místo v aplikaci, kde Dohoda vzniká,
  // takže je to jediné místo, kde se to dá skutečně vynutit — kontrola
  // v UI by šla obejít a v pravidlech Firestore se udělat nedá (pravidlo
  // by muselo joinovat přes cizí organizace, což rules neumí).
  //
  // Čte se z `titleRegistry`, ne z cizích Dohod: ty jsou pro nás z principu
  // nečitelné (`sameOrg`), takže bez rejstříku by kontrola „neviděla"
  // přesně ty konflikty, kvůli kterým existuje.
  const familyRef = doc(db, 'families', familyDocId)
  const familySnap = await getDoc(familyRef)
  const fosterPersonRefs = (familySnap.data()?.fosterPersonRefs as string[] | undefined) ?? []

  const fosterUids = (
    await Promise.all(
      fosterPersonRefs.map(async (fosterId) => {
        const snap = await getDoc(doc(db, 'fosterPersons', fosterId))
        return snap.data()?.uid as string | undefined
      }),
    )
  ).filter((u): u is string => !!u)

  if (!input.skipExclusivityCheck) {
    await assertCanOpenTitle(fosterUids, input.spousesLivingApart ?? false, organizationId)
  }

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

  // 1b) Rejstřík obsazených UID — hned po Dohodě, aby další organizace
  // konflikt uviděla. Kdyby se to odložilo, vznikne okno, ve kterém dvě
  // organizace projdou kontrolou obě.
  await Promise.all(
    fosterUids.map((fosterUid) =>
      claimTitle({ uid: fosterUid, holderOrgId: organizationId, validFrom: data.validFrom, validTo: data.validTo }),
    ),
  )

  // 2) Family + fosterPersons orgAccessList — teprve TEĎ, kdy Dohoda už
  // existuje a rules ji uznají jako důkaz oprávněnosti.
  await updateDoc(familyRef, { orgAccessList: arrayUnion(organizationId) })

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

  if (input.audit) {
    await recordAudit({
      organizationId,
      action: 'agreement_created',
      ...actorFields(input.audit.actor),
      subject: { kind: 'family', id: familyDocId, label: input.audit.familyLabel },
      target: { kind: 'other', id: uid, label: `Dohoda ${uid}` },
      detail: `Typ péče: ${careType}. Platí od ${data.validFrom.slice(0, 10)}.`,
    })
  }

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
/**
 * VŠECHNY segmenty organizace (aktivní i ukončené, archivované i ne).
 * `listActiveAgreementsForOrg` níž filtruje na `status: 'active'` a
 * archivované tím pádem nikdy nevrátí — jenže právě ty potřebujeme umět
 * najít, abychom je mohli ze seznamů a z hledání VYNECHAT.
 */
export async function listSegmentsForOrg(organizationId: string): Promise<Record<string, AgreementDoc>> {
  const snap = await getDocs(
    query(collectionGroup(db, 'agreements'), where('organizationId', '==', organizationId)),
  )
  const byFamilyId: Record<string, AgreementDoc> = {}
  for (const d of snap.docs) {
    const agreement = d.data() as AgreementDoc
    byFamilyId[agreement.familyId] = agreement
  }
  return byFamilyId
}

/**
 * Spisy, které si organizace uklidila do archivu. Vrací množinu, protože
 * jediná otázka, kterou o nich seznamy a hledání kladou, zní „je tenhle
 * familyId archivovaný?".
 */
export async function listArchivedFamilyIds(organizationId: string): Promise<Set<string>> {
  const segments = await listSegmentsForOrg(organizationId)
  return new Set(Object.values(segments).filter((a) => !!a.archivedAt).map((a) => a.familyId))
}

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
