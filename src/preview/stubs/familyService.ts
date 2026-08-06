import { families, fosterPersons, children } from '../fixtures'
export const listFamilies = async () => families.map((f) => f.family)
export const listFamiliesWithDocIds = async () => families
/**
 * Neznámé `uid` vrací `null`, ne první rodinu v poli.
 *
 * Dřív tu bylo `?? families[0]`, takže náhled ukázal profil VŽDYCKY — a cesta
 * „spis nenalezen" se tím nedala vyfotit ani otestovat. Právě na ní 2026-07-25
 * spadla produkce (hooky pod podmíněným `return`, React #300) a screenshoty to
 * nemohly odhalit, protože se do toho stavu nikdy nedostaly.
 */
export const getFamilyByUid = async (uid: string) => families.find((f) => f.family.uid === uid) ?? null
export const createFamily = async () => families[0] as never
export const updateFamilyPartnerSharingDefault = async () => {}
export const updateFamilyDisplayName = async () => {}
export const listFosterPersonsByRefs = async (refs: string[]) =>
  fosterPersons.filter((f) => refs.includes(f.docId))
export const getFosterPerson = async (id: string) => fosterPersons.find((f) => f.docId === id)?.fosterPerson ?? null
export const listChildrenForOrg = async () => children
export const listFosterPersonsForOrg = async () => fosterPersons
export const addFosterPersonToFamily = async () => fosterPersons[0] as never
export const updateFosterPersonBirthDate = async () => {}
export const listChildrenForFamily = async (familyDocId: string) =>
  children.filter((c) => c.child.familyId === familyDocId)
export const getChild = async (id: string) => children.find((c) => c.docId === id)?.child ?? null
export const addChildToFamily = async () => children[0] as never
export const updateChildBirthDate = async () => {}
