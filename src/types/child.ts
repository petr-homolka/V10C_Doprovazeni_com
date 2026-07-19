/**
 * children/{childId} — TOP-LEVEL, TT=20, ZADANI §3/§4.1/§4.2 bod 7. RČ je
 * primární identifikátor (dopočet data narození), jméno jen fallback —
 * `birthDate` odvození z RČ NENÍ v M1 implementováno (jen uloženo, pokud
 * ho uživatel zadá zvlášť), viz TODO v childService.ts.
 *
 * SEAM: `organizationId` je podle §4.2 bodu 7 má být denormalizace z
 * AKTIVNÍ DOHODY — Dohoda ještě neexistuje (M2), takže M1 ho nastavuje
 * přímo při založení. Až M2 přinese Dohodu/assignedTo, přepsat na
 * skutečnou denormalizaci při každé změně přiřazení.
 */
export interface ChildDoc {
  uid: string
  /** Firestore document ID rodiny (interní odkaz), NE family.uid — human-facing
   * `uid` pravidlo (§4.3 pozn. 1) platí pro URL/PDF/QR, ne pro interní
   * odkazy mezi dokumenty. */
  familyId: string
  organizationId: string
  firstName: string
  lastName: string
  birthNumber: string
  birthDate?: string
  createdAt: string
}
