/**
 * children/{childId}/supportExpenses/{id} — původní ZADANI §4.4.E. Profil
 * dítěte NIKDY nezobrazuje procenta/grafy čerpání SPVPP — jen tabulka
 * dokladů s aktivní možností nový doklad vložit.
 *
 * `poradenstvi`/`terapie`/`supervizePodpurna` — DOPLNENI_ZADANI-DO-M5
 * §B.10.3 doporučení (podpůrná supervize pěstouna, prevence vyhoření,
 * NEPOČÍTÁ se do 24/18h vzdělávání) — přidáno jako doporučeno v zadání,
 * i když koncept ještě "nedomyšlen" (viz CourseDoc.supervisionKind pro
 * alternativní/vzdělávací variantu).
 */
export type SupportExpenseCategory = 'doucovani' | 'hlidani' | 'tabor' | 'jine' | 'poradenstvi' | 'terapie' | 'supervizePodpurna'
export type SupportExpenseSource = 'interni' | 'smluvni' | 'rucni'

export interface SupportExpenseDoc {
  organizationId: string
  category: SupportExpenseCategory
  source: SupportExpenseSource
  providerRef?: string | null // typ 70/80 institituce, nebo interní uid
  amount: number
  periodFrom: string
  periodTo: string
  documentRef?: string | null // POVINNÉ pro source='rucni'
  createdBy: 'system' | string
  note?: string
  createdAt: string
}
