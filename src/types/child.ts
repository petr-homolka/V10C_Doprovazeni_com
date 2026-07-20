/**
 * children/{childId} — TOP-LEVEL, TT=20, ZADANI §3/§4.1/§4.2 bod 7. RČ je
 * primární identifikátor (dopočet data narození), jméno jen fallback —
 * `birthDate` odvození z RČ NENÍ v M1 implementováno (jen uloženo, pokud
 * ho uživatel zadá zvlášť), viz TODO v childService.ts.
 *
 * `organizationId` je dle §4.2 bodu 7 denormalizace z AKTIVNÍ DOHODY —
 * od M2 to `agreementService.ts` skutečně dělá (přepíše `organizationId`
 * na všech dětech rodiny při založení/skončení Dohody), NE už M1
 * statické pole nastavené jen při vzniku dítěte. JEDNA aktuální hodnota,
 * ne historický seznam jako `FamilyDoc.orgAccessList` — dítě má vždy
 * přesně jednu "současnou" organizaci, na rozdíl od Spisu, který si
 * pamatuje VŠECHNY organizace v historii.
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
  /** Viz stejnojmenné pole na FamilyDoc — import rollback (§5.5, M1.5). */
  createdByImportJobRef?: string
  /** Viz stejnojmenné pole na FamilyDoc — Cloud Storage avatar URL (M3). */
  avatarUrl?: string | null
  /** M7 §4.4.B — respit je NEZÁVISLÝ na počtu pěstounů rodiny, žije PER
   * DÍTĚ, ne na rodině/pěstounovi. Klíč = kalendářní rok (string, ne
   * rolující 12 měsíců), hodnota = počet vykázaných dnů toho roku. */
  respitDaysUsed?: Record<string, number>
}
