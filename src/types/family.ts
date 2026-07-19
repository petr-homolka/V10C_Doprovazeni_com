/**
 * families/{familyId} — SPIS (rodinná složka), ZADANI §3/§4.1/§4.5.
 *
 * `orgAccessList` (M2) NAHRAZUJE M1 dočasné `createdByOrgId` — je to
 * denormalizovaný seznam VŠECH organizací, které kdy měly s rodinou
 * Dohodu (aktivní i skončenou), aktualizovaný `agreementService.ts` při
 * založení Dohody (`arrayUnion`, nikdy se neodebírá — jednou přítomná
 * organizace vidí Spis navždy, i po skončení Dohody, §4.5: "vlastní
 * období: vidí VŠE... natrvalo, i po skončení vlastní Dohody"). Tohle
 * pole řeší JEN přístup k samotnému Spisu (identita/adresa/pěstouni).
 *
 * Jemnější 3-úrovňové pravidlo pro historii (timeline/documents/
 * historyDigest, §4.5 "Pravidlo čtení": "načíst vlastní Dohodu organizace
 * O pro daný Spis") čte PŘÍMO dokument `families/{familyId}/agreements/
 * {organizationId}` — Dohoda má deterministické ID (= organizationId, viz
 * AgreementDoc), takže nepotřebuje žádnou denormalizovanou kopii tady;
 * jeden zdroj pravdy, ne dva sesynchronizovaná pole.
 */
export interface FamilyDoc {
  uid: string
  orgAccessList: string[]
  fosterPersonRefs: string[]
  address?: string
  createdAt: string
  /**
   * Vyplněné JEN pokud tenhle Spis vznikl hromadným importem (§5.5, M1.5)
   * — Firestore document ID rodičovského `importJobs/{jobId}`. Jediný účel:
   * `firestore.rules` na tohle pole navazuje NARROW delete výjimku pro
   * rollback (§5.5 "30denní okno na kompletní vrácení") — jinak by import
   * omylem nešel vůbec vrátit zpět, protože `families`/`fosterPersons`/
   * `children` mají jinak `delete: if false` natvrdo (audit stopa, §5).
   * Ručně založené entity tohle pole nikdy nemají.
   */
  createdByImportJobRef?: string
}
