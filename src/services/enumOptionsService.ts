import { arrayUnion, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { EnumOption, EnumOptionsDoc } from '@/types/enumOptions'

function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** `"Doprovod k lékaři"` -> `"doprovod-k-lekari"` — stabilní, čitelný klíč
 * odvozený z popisku (ne náhodné ID), ať se dá případně použít i jako
 * i18n-friendly identifikátor někde jinde v appce. Kolize dvou různých
 * popisků na stejný klíč jsou nepravděpodobné a neškodné (viz
 * `enumOptionsService.ts` doc komentář u `addEnumOption`). */
function slugify(label: string): string {
  const slug = stripDiacritics(label.trim())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'polozka'
}

/** Vlastní (org-scoped) položky číselníku — viz `types/enumOptions.ts`
 * pro plné zdůvodnění tvaru. Prázdné pole, pokud organizace ještě žádnou
 * vlastní položku nepřidala (dokument ani nemusí existovat). */
export async function listEnumOptions(organizationId: string, listId: string): Promise<EnumOption[]> {
  const snap = await getDoc(doc(db, 'organizations', organizationId, 'enumOptions', listId))
  return snap.exists() ? (snap.data() as EnumOptionsDoc).options : []
}

/** Přidá novou položku — ATOMICKY (`arrayUnion` + `setDoc merge`, funguje
 * i když dokument číselníku ještě vůbec neexistuje), žádné čtení celého
 * pole předem. Klíč se generuje ze zadaného popisku (`slugify`) — pokud
 * dva zaměstnanci ve stejný okamžik zadají stejný popisek, obě položky
 * (s různým `createdByUid`/`createdAt`) se prostě obě uloží vedle sebe;
 * mírně nadbytečné, ale neškodné pro nízko-rizikový číselník typu "Typ
 * události" (žádná byznys logika na konkrétní hodnotě nezávisí). */
export async function addEnumOption(
  organizationId: string,
  listId: string,
  label: string,
  createdByUid: string,
): Promise<EnumOption> {
  const trimmed = label.trim()
  const option: EnumOption = {
    key: slugify(trimmed),
    label: trimmed,
    createdByUid,
    createdAt: new Date().toISOString(),
  }
  await setDoc(
    doc(db, 'organizations', organizationId, 'enumOptions', listId),
    { options: arrayUnion(option) },
    { merge: true },
  )
  return option
}
