import { formatDateValue } from './dateGrid'

/**
 * České rodné číslo → datum narození (2026-07-24, Petrova přímá poznámka
 * "z rodného čísla jde narození poznat" — dřív jen manuálně editovatelné
 * pole, i když `child.ts` tenhle dopočet zmiňoval jako TODO už od M1).
 * Formát RRMMDD(/)XXXX — měsíc +50 u žen, dál +20/+70 navíc u čísel
 * vyčerpaných po roce 2004 (přetečení sekvence). Kontrolní číslice (mod
 * 11) se NEOVĚŘUJE — historické výjimky (čísla před ~1985) ji nemají
 * konzistentní, a pro dopočet DATA to není potřeba, jen by to zbytečně
 * odmítalo jinak platná čísla.
 *
 * Století samo o sobě RČ neurčuje (RRMMDD je stejné pro 1926 i 2026) — pro
 * tuhle appku (evidence DĚTÍ ve pěstounské péči, typicky narozené
 * v posledních ~20 letech) zkusíme 2000+RR i 1900+RR a vezmeme tu
 * variantu, co dá platné datum NEJPOZDĚJI v minulosti (dítě narozené
 * "zítra" by bylo zjevně špatně přečtené RČ, ne reálný případ).
 */
export function birthDateFromBirthNumber(birthNumber: string): string | null {
  const digits = birthNumber.replace(/\D/g, '')
  if (digits.length !== 9 && digits.length !== 10) return null

  const rr = Number(digits.slice(0, 2))
  let mm = Number(digits.slice(2, 4))
  const dd = Number(digits.slice(4, 6))

  if (mm > 70) mm -= 70
  else if (mm > 50) mm -= 50
  else if (mm > 20) mm -= 20
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null

  const now = new Date()
  for (const year of [2000 + rr, 1900 + rr]) {
    const d = new Date(year, mm - 1, dd)
    const isRealDate = d.getFullYear() === year && d.getMonth() === mm - 1 && d.getDate() === dd
    if (isRealDate && d.getTime() <= now.getTime()) {
      return formatDateValue(year, mm - 1, dd)
    }
  }
  return null
}

/** Explicitně zadané `birthDate` má vždy přednost (umožňuje ruční opravu u
 * cizinců/neobvyklých RČ) — jinak se datum narození dopočítá z rodného
 * čísla za běhu, BEZ nutnosti cokoli zpětně migrovat/ukládat. */
export function resolveChildBirthDate(child: { birthDate?: string | null; birthNumber: string }): string | null {
  return child.birthDate || birthDateFromBirthNumber(child.birthNumber)
}

/** Pohlaví z rodného čísla — u žen je měsíc +50 (u čísel vyčerpaných po
 * roce 2004 +70). Vrací null u neobvyklých/cizineckých čísel. */
export function genderFromBirthNumber(birthNumber: string): 'muž' | 'žena' | null {
  const digits = birthNumber.replace(/\D/g, '')
  if (digits.length !== 9 && digits.length !== 10) return null
  const mm = Number(digits.slice(2, 4))
  if (mm >= 51 && mm <= 62) return 'žena'
  if (mm >= 71 && mm <= 82) return 'žena'
  if ((mm >= 1 && mm <= 12) || (mm >= 21 && mm <= 32)) return 'muž'
  return null
}

/** Věk v celých letech z data narození (YYYY-MM-DD), nebo null. */
export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const d = new Date(birthDate)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

/** Datum narození ve formátu „12. 4. 1995" (cs), nebo pomlčka. */
export function formatBirthDateCs(birthDate: string | null | undefined): string {
  if (!birthDate) return '—'
  const d = new Date(birthDate)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('cs-CZ')
}
