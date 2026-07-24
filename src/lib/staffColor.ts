/**
 * Barva zaměstnance v kalendáři — jeden zdroj pravdy pro desktop i mobil
 * (do 2026-07-24 byla paleta i hashovací funkce zduplikovaná v obou
 * kalendářích a komentář v nich to sám označoval za dluh; rozejít se dvě
 * kopie mohly kdykoli, a "Eva je zelená" je věc, kterou si lidé pamatují).
 *
 * Kategorická paleta VĚDOMĚ vynechává modrou (`--primary`, konfliktovala by
 * s barvou appky samotné) a čistě červenou (`--danger`, ta znamená krizi) —
 * zbytek spektra, ať zaměstnanci zůstanou vzájemně rozlišitelní.
 *
 * Barva se počítá z `uid`, ne z pozice v seznamu — jinak by se všem
 * zaměstnancům barvy přeskládaly, kdykoli někdo nový přijde nebo odejde.
 */
const STAFF_PALETTE = [
  '#8B5CF6', '#DB2777', '#EA580C', '#0D9488',
  '#65A30D', '#0891B2', '#D97706', '#9333EA',
]

export function staffColor(uid: string): string {
  let hash = 0
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0
  return STAFF_PALETTE[Math.abs(hash) % STAFF_PALETTE.length]
}

/** Barva připomínky návštěvy z Dohody — není čí, patří rodině, ne osobě. */
export const AGREEMENT_VISIT_COLOR = '#7587A8'
