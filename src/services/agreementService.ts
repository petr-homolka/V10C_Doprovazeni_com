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
import { getOrganization } from '@/services/organizationService'
import {
  DEFAULT_NOTE_DEADLINE_HOURS,
  DEFAULT_VISIT_INTERVAL_DAYS,
  EDUCATION_HOURS_TARGET,
  type AgreementDoc,
  type CareType,
} from '@/types/agreement'

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

export async function getActiveAgreement(
  familyDocId: string,
  organizationId: string,
): Promise<AgreementDoc | null> {
  const snap = await getDoc(agreementRef(familyDocId, organizationId))
  return snap.exists() ? (snap.data() as AgreementDoc) : null
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
  /** Viz FamilyDoc stejnojmenné pole — import rollback (§5.5, M1.5). */
  createdByImportJobRef?: string
}

export async function createAgreement(input: CreateAgreementInput): Promise<AgreementDoc> {
  const { familyDocId, organizationId, orgCode, careType, assignedTo, validFrom, createdByImportJobRef } = input
  const uid = await allocateUid(organizationId, orgCode, 'agreement')
  const data: AgreementDoc = {
    uid,
    familyId: familyDocId,
    organizationId,
    careType,
    status: 'active',
    validFrom: validFrom ?? new Date().toISOString(),
    validTo: null,
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

export async function endAgreement(familyDocId: string, organizationId: string): Promise<void> {
  await updateDoc(agreementRef(familyDocId, organizationId), {
    status: 'ended',
    validTo: new Date().toISOString(),
  })
}

/**
 * §6 A9: kapacita KO je orientační (výchozí 25 rodin), NIKDY tvrdý limit
 * — vrací jen počet + práh, volající (UI) rozhodne, jestli zobrazí jemné
 * upozornění. Collection-group dotaz MUSÍ filtrovat i na `organizationId`
 * (ne jen `assignedTo`+`status`) ze STEJNÉHO důvodu jako jinde v tomhle
 * souboru — firestore.rules `agreements` read čte `organizationId`,
 * dotaz ho musí zrcadlit.
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
  const [org, snap] = await Promise.all([
    getOrganization(organizationId),
    getDocs(
      query(
        collectionGroup(db, 'agreements'),
        where('organizationId', '==', organizationId),
        where('assignedTo', '==', koUid),
        where('status', '==', 'active'),
      ),
    ),
  ])
  const threshold = org?.capacityWarningThreshold ?? 25
  const activeCaseload = snap.size
  return { activeCaseload, threshold, overThreshold: activeCaseload >= threshold }
}
