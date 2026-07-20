/**
 * UID identity model — 001-IDENTITY_MODEL.md + ZADANI §4.3 (autoritativní,
 * rozšiřuje 001 o TT=80 přejmenování a TT=99). Struktura: TT OOOO SSSSSS C
 * (13 číslic, nikdy nezačíná nulou, C = EAN-13 kontrolní číslice).
 *
 * Závazné pro celý systém (databázi, API, dokumenty, audit, QR, hledání) —
 * nikde nevytvářej alternativní ID schéma pro entitu, která má kód níže.
 */
export const ENTITY_TYPE_CODES = {
  fosterPerson: '10', // Pěstoun
  child: '20', // Dítě svěřené do pěstounské péče
  keyWorker: '30', // Klíčová osoba
  staffMember: '40', // Zaměstnanec doprovázející organizace
  externalCollaborator: '50', // Externí spolupracovník
  externalOrganization: '60', // Externí organizace
  educationProvider: '70', // Poskytovatel vzdělávání pěstounů
  childServiceProvider: '80', // Poskytovatel služby dítěti (přejmenováno z "respitní péče")
  agreement: '90', // Dohoda o výkonu pěstounské péče
  document: '95', // Dokument (schvalovací workflow, §6 A1) — M5, mezera mezi 90/99 dle §4.3 "prostor pro budoucí rozšíření"
  familyFile: '99', // Spis (rodinná složka)
} as const

export type EntityType = keyof typeof ENTITY_TYPE_CODES
export type EntityTypeCode = (typeof ENTITY_TYPE_CODES)[EntityType]
