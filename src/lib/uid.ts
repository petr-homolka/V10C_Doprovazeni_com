import { ENTITY_TYPE_CODES, type EntityType } from '@/types/identity'

/**
 * UID — TŘINÁCTIMÍSTNÉ ČÍSLO S KONTROLNÍ ČÍSLICÍ GS1.
 *
 * ─── ZMĚNA POLITIKY, 2026-07-26 večer ─────────────────────────────────
 *
 * UID UŽ NEMÁ STRUKTURU. Dřív to bylo `TT OOOO SSSSSS C` (typ, organizace,
 * pořadí) a tenhle soubor to skládal. Od teď je UID NÁHODNÉ třináctimístné
 * číslo — viz `uidAllocator.ts` pro to, proč a co tím padá.
 *
 * Co tady zbylo a proč:
 *   • `gs1CheckDigit` / `isValidUid` — kontrolní číslice zůstává, ať se
 *     překlep pozná bez dotazu do databáze.
 *   • `buildUid` — už se NEPOUŽÍVÁ k vydávání nových čísel, jen ke stavbě
 *     testovacích dat a k ověření, že stará strukturovaná UID pořád projdou.
 *   • `uidEntityTypeCode` / `uidOrgCode` — platí VÝHRADNĚ pro čísla vydaná
 *     do 26. 7. U nových nevrací nic smysluplného. V aplikaci je nevolá
 *     ani jedno místo (ověřeno) a nové volání by byla chyba.
 *
 * STARÁ ČÍSLA SE NEPŘEČÍSLOVÁVAJÍ. Jsou platná napořád — kontrolní číslice
 * sedí, takže obojí prochází stejnou validací a nikdo nepozná rozdíl.
 */

/** Délka UID, které se právě VYDÁVAJÍ. */
export const UID_LENGTH = 13
/** Délky, které se musí umět PŘEČÍST. Viz hlavička. */
export const SUPPORTED_UID_LENGTHS = [13, 14] as const

/** Kolik míst zabíral kód organizace ve STARÝCH, strukturovaných UID. */
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
 * Sestaví UID ve STARÉM strukturovaném tvaru.
 *
 * Nová čísla se takhle už nevydávají (viz `uidAllocator.randomUid`). Zůstává
 * pro testy a pro případ, že by bylo potřeba přepočítat historické číslo.
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
