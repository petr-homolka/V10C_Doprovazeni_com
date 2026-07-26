import { ENTITY_TYPE_CODES, type EntityType } from '@/types/identity'

/**
 * UID — TT OOOO SSSSSS C.
 *
 * ─── KAPACITA A CO S NÍ, 2026-07-26 ───────────────────────────────────
 *
 * Petr se ptal, jestli 13 míst bude stačit. Odpověď je „ano, ale jeden
 * ze tří segmentů je jednosměrné dveře" — a proto je tenhle soubor
 * napsaný tak, aby delší UID uměl PŘEČÍST, i když je zatím nevydává.
 *
 *   TT     2 místa, 89 volných kódů, využito 11.       Není problém.
 *   OOOO   4 místa = 9 999 ORGANIZACÍ, nikdy se nerecyklují.
 *   SSSSSS 6 míst = 999 999 entit na organizaci A TYP (viz counters.ts —
 *          čítač je `{orgId}_{typeCode}`, ne jeden na organizaci).
 *
 * Nejrychleji rostou DOKUMENTY (TT=95). Organizace s 500 rodinami a 50
 * dokumenty na rodinu ročně spotřebuje 25 000 čísel za rok → 40 let.
 * Pěstounů a dětí je o dva řády míň. SSSSSS tedy problém není.
 *
 * PROBLÉM JE OOOO. V ČR je pověřených osob řádově dvě stě, takže 9 999 je
 * čtyřicetinásobná rezerva — ale je to segment UPROSTŘED čísla. Rozšířit
 * ho znamená změnit délku celého UID, a to se dotkne všeho, co je už
 * vytištěné a naskenované.
 *
 * ─── CO S TÍM DĚLÁME TEĎ ──────────────────────────────────────────────
 *
 * Nic se nepřečíslovává. Dělají se jen dvě laciné věci, které z budoucí
 * změny udělají drobnost místo přestavby:
 *
 *   1. Kontrolní číslice je GS1, ne „EAN-13". Stejný algoritmus, ale
 *      počítaný pro LIBOVOLNOU délku základu (váhy 3/1 zprava). Přechod
 *      na GTIN-14 tím nevyžaduje nový kód, jen jinou konstantu.
 *   2. `isValidUid` přijímá 13 i 14 míst. Staré UID zůstanou třináctimístné
 *      NAVŽDY; kdyby se jednou začalo vydávat čtrnáctimístné, musí obojí
 *      koexistovat. Připravit to teď stojí pár řádků, dodělávat později
 *      by znamenalo hledat všechna místa, kde je napsané `13`.
 *
 * Kdyby OOOO někdy docházelo, cesta je GTIN-14 (jedna číslice navíc,
 * pořád standard GS1, pořád se naskenuje) a OOOOO = 99 999 organizací.
 * Druhá možnost, levnější a asi správnější, je NEDÁVAT UID dokumentům —
 * dokument není osoba ani právní subjekt a trvalé UID nepotřebuje.
 * Rozhodovat to teď ale nemá smysl.
 */

/** Délka UID, které se právě VYDÁVAJÍ. */
export const UID_LENGTH = 13
/** Délky, které se musí umět PŘEČÍST. Viz hlavička. */
export const SUPPORTED_UID_LENGTHS = [13, 14] as const

/** Kolik míst zabírá kód organizace v UID dané délky. */
export function orgCodeLength(uidLength: number): number {
  // TT (2) + OOOO (?) + SSSSSS (6) + C (1)
  return uidLength - 9
}

/**
 * Kontrolní číslice podle GS1 — váhy 3 a 1 střídavě OD PRAVÉHO KRAJE
 * základu. Pro dvanáctimístný základ to je přesně EAN-13; pro
 * třináctimístný GTIN-14. Jeden algoritmus, žádná varianta pro každou
 * délku.
 */
export function gs1CheckDigit(base: string): number {
  if (!/^\d+$/.test(base) || base.length === 0) {
    throw new Error(`Základ kontrolní číslice musí být samé číslice, dostal jsem "${base}"`)
  }
  let sum = 0
  for (let i = 0; i < base.length; i++) {
    const fromRight = base.length - 1 - i
    sum += Number(base[i]) * (fromRight % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10
}

/**
 * EAN-13 kontrolní číslice nad 12místným základem.
 *
 * Zůstává jako pojmenovaný vstup s kontrolou délky — volající, který
 * skládá dnešní třináctimístné UID, má dostat chybu hned, ne až se mu
 * kontrolní číslice nesejde.
 */
export function ean13CheckDigit(twelveDigits: string): number {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error(`EAN-13 base musí mít přesně 12 číslic, dostal jsem "${twelveDigits}"`)
  }
  return gs1CheckDigit(twelveDigits)
}

export const MAX_SEQUENCE = 999_999

/**
 * Sestaví finální UID. `orgCode` (4 číslice) a `sequence` (1–999999)
 * dodává volající — tenhle modul o organizacích ani čítačích nic neví,
 * jen skládá a validuje tvar (viz counters.ts pro přidělení sequence).
 */
export function buildUid(entityType: EntityType, orgCode: string, sequence: number): string {
  const typeCode = ENTITY_TYPE_CODES[entityType]
  if (!/^\d{4}$/.test(orgCode)) {
    throw new Error(`orgCode musí mít přesně 4 číslice, dostal jsem "${orgCode}"`)
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_SEQUENCE) {
    throw new Error(`sequence musí být celé číslo 1–${MAX_SEQUENCE}, dostal jsem ${sequence}`)
  }
  const seqPart = String(sequence).padStart(6, '0')
  const base = `${typeCode}${orgCode}${seqPart}`
  return `${base}${gs1CheckDigit(base)}`
}

/**
 * Ověří tvar a kontrolní číslici. Bere 13 i 14 míst — viz hlavička, staré
 * UID musí projít i po případném přechodu na delší.
 */
export function isValidUid(uid: string): boolean {
  if (!(SUPPORTED_UID_LENGTHS as readonly number[]).includes(uid.length)) return false
  if (!/^[1-9]\d*$/.test(uid)) return false
  const base = uid.slice(0, -1)
  return gs1CheckDigit(base) === Number(uid[uid.length - 1])
}

export function uidEntityTypeCode(uid: string): string {
  return uid.slice(0, 2)
}

/** Kód organizace z UID. Funguje pro obě podporované délky. */
export function uidOrgCode(uid: string): string {
  return uid.slice(2, 2 + orgCodeLength(uid.length))
}

/**
 * Srovnání zápisu UID od uživatele. Lidi ho opisují z papíru a přidávají
 * mezery a pomlčky — odmítnout „1000 0100 00013" jako neplatné by bylo
 * puntičkářství, ne kontrola.
 */
export function normalizeUidInput(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}
