/**
 * families/{familyId} — SPIS (rodinná složka), ZADANI §3/§4.1/§4.5.
 *
 * SEAM (M1 základ, viz firestore.rules komentář u `families`):
 * `createdByOrgId` je DOČASNÉ scoping pole. Podle §4.5 je Spis
 * architektonicky org-NEZÁVISLÝ — příslušnost k organizaci má určovat
 * aktivní Dohoda (M2), ne pole na Spisu. Nepřidávej na tohle pole další
 * závislosti (např. filtrování v UI mimo tenhle dočasný účel) — M2 ho
 * nahradí `historyDigest`/`assignedTo` mechanismem.
 */
export interface FamilyDoc {
  uid: string
  createdByOrgId: string
  fosterPersonRefs: string[]
  address?: string
  createdAt: string
}
