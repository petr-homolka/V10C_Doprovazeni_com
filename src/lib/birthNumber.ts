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
