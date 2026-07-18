import { ENTITY_TYPE_CODES, type EntityType } from '@/types/identity'

/**
 * EAN-13 kontrolní číslice nad 12místným základem. Žádný vlastní algoritmus
 * (001-IDENTITY_MODEL.md §6) — standardní váhy 1/3 střídavě zleva.
 */
export function ean13CheckDigit(twelveDigits: string): number {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error(`EAN-13 base musí mít přesně 12 číslic, dostal jsem "${twelveDigits}"`)
  }
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number(twelveDigits[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10
}

export const MAX_SEQUENCE = 999_999

/**
 * Sestaví finální 13místné UID. `orgCode` (4 číslice) a `sequence`
 * (1–999999) dodává volající — tenhle modul o organizacích ani čítačích nic
 * neví, jen skládá a validuje tvar (viz counters.ts pro přidělení sequence).
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
  const base12 = `${typeCode}${orgCode}${seqPart}`
  const check = ean13CheckDigit(base12)
  return `${base12}${check}`
}

/** Ověří tvar (13 číslic, nezačíná nulou) a kontrolní číslici existujícího UID. */
export function isValidUid(uid: string): boolean {
  if (!/^[1-9]\d{12}$/.test(uid)) return false
  const base12 = uid.slice(0, 12)
  const check = Number(uid[12])
  return ean13CheckDigit(base12) === check
}

export function uidEntityTypeCode(uid: string): string {
  return uid.slice(0, 2)
}
