/**
 * fosterPersons/{fosterId} — TOP-LEVEL, TT=10, ZADANI §4.4.A. Pěstoun jako
 * OSOBA nezávislá na Dohodě/rodině — M1 ho zatím zakládá jen jako záznam
 * (ještě bez Auth účtu, ten přichází s M4 přes pozvánku).
 *
 * SEAM (stejný princip jako `families`, viz firestore.rules): §4.4.A
 * počítá s tím, že pěstoun dlouhodobě přežije změnu organizace — cross-org
 * viditelnost ale řeší až historyDigest-styl mechanismus mimo rozsah M1.
 * `createdByOrgId` je dočasné scoping pole, ne finální model vlastnictví.
 */
export interface FosterPersonDoc {
  uid: string
  createdByOrgId: string
  firstName: string
  lastName: string
  phone?: string
  email?: string
  createdAt: string
}
