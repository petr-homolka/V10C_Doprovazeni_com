import type { EducationOfficialWindow, StateBenefitsMap } from './course'

/**
 * fosterPersons/{fosterId} — TOP-LEVEL, TT=10, ZADANI §4.4.A. Pěstoun jako
 * OSOBA nezávislá na Dohodě/rodině — M1 ho zatím zakládá jen jako záznam
 * (ještě bez Auth účtu, ten přichází s M4 přes pozvánku).
 *
 * `orgAccessList` (M2) NAHRAZUJE M1 dočasné `createdByOrgId`, stejný
 * princip jako `FamilyDoc.orgAccessList` — organizace, které kdy měly
 * Dohodu s rodinou obsahující tohoto pěstouna, ho vidí navždy (§4.4.A:
 * pěstoun přežívá změnu Dohody/organizace).
 *
 * `familyId` (Firestore document ID rodiny, ne human-facing uid) — back-
 * odkaz potřebný, aby `firestore.rules` mohlo ověřit rozšíření
 * `orgAccessList` proti skutečné Dohodě (`families/{familyId}/agreements/
 * {organizationId}`), stejným mechanismem jako u `FamilyDoc` samotného.
 * Pokud pěstoun časem patří k VÍCE rodinám (mimo rozsah M2), bude nutné
 * tohle rozšířit na seznam — teď je to vždy přesně jedna rodina.
 */
export interface FosterPersonDoc {
  uid: string
  orgAccessList: string[]
  familyId: string
  firstName: string
  lastName: string
  phone?: string
  email?: string
  createdAt: string
  /** Viz stejnojmenné pole na FamilyDoc — import rollback (§5.5, M1.5). */
  createdByImportJobRef?: string
  /** Viz stejnojmenné pole na FamilyDoc — Cloud Storage avatar URL (M3). */
  avatarUrl?: string | null
  /** DOPLNENI_ZADANI-DO-M5 §2 — lhůta osobního kontaktu PER OSOBU, ne jen
   * per Dohoda (`AgreementDoc.lastVisitAt`). Dokud partneři "v souladu"
   * (sdílené návštěvy, výchozí stav), obě hodnoty zůstávají stejné jako
   * Dohoda — teprve když se pracovník rozhodne navštívit/zaznamenat jen
   * JEDNOHO partnera (`partnerSharingDefault` toggle vypnutý), se tohle
   * pole odchýlí a dává smysl samo o sobě. Nenastavené (starší záznamy
   * před tímhle polem) = "stejné jako Dohoda", NE "nikdy navštíven". */
  lastVisitAt?: string | null
  /** M7 §4.4.A — compliance počítadlo, resetuje se s každou novou Dohodou
   * (§47a odst. 3 ZSPOD "bankuje" přebytek). Nenastavené = žádná Dohoda
   * ještě nezaložila okno. */
  educationOfficial?: EducationOfficialWindow
  /** M7 §4.4.A — NEZÁVISLÝ na `educationOfficial`, nikdy se nenuluje. */
  educationLifetimeHours?: number
  /** M7 §3.1/§4.4.D — POUZE stav dávek, nikdy částka. */
  stateBenefits?: StateBenefitsMap
}
