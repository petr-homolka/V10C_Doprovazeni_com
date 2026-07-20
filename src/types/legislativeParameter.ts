/**
 * legislativeParameters/{parameterKey}/history/{entryId} — M7 §B.1.
 * Platformní, superadmin-spravovaná vrstva (nejnižší priorita ve VŠECH
 * kaskádách sazeb/politik, viz cascadeResolution.ts) — i jednohodnotové
 * konstanty (kategorie témat vzdělávání) žijí tady, pro konzistenci se
 * zbytkem systému sazeb.
 */
export interface LegislativeParameterHistoryEntry<T = unknown> {
  value: T
  effectiveFrom: string
  effectiveTo: string | null
  managedBy: 'superadmin'
  notifyBeforeEffective: boolean
  setBy: string
  setAt: string
  note?: string
}

/** §5 vyhlášky — kategorie témat vzdělávání pěstounů (a–g + jiné). */
export const EDUCATION_TOPIC_CATEGORIES = [
  { code: 'a', label: 'Teorie a psychologie výchovy' },
  { code: 'b', label: 'Práva dítěte a náhradní rodinná péče' },
  { code: 'c', label: 'Zdravotní specifika svěřených dětí' },
  { code: 'd', label: 'Vzdělávací a výchovné obtíže' },
  { code: 'e', label: 'Attachment a vztahová vazba' },
  { code: 'f', label: 'Práce s biologickou rodinou dítěte' },
  { code: 'g', label: 'Syndrom vyhoření a sebepéče pečující osoby' },
  { code: 'jine', label: 'Jiné' },
] as const

/** Klíče legislativeParameters — sazby (číslo/Kč) používané v §B.5. */
export const RATE_PARAMETER_KEYS = [
  'stravaCelodenni',
  'obed',
  'ubytovaniDen',
  'vzdelavaniUbytovaniDen',
  'hlidaniHodina',
  'doucovaniHodina',
] as const
export type RateParameterKey = (typeof RATE_PARAMETER_KEYS)[number]

/** Klíče legislativeParameters — politiky (zakazano/povoleno) používané v §B.5.1. */
export const POLICY_PARAMETER_KEYS = ['kurzovneRefundace'] as const
export type PolicyParameterKey = (typeof POLICY_PARAMETER_KEYS)[number]

export type PolicyValue = 'zakazano' | 'povoleno'

/** SPVPP koše (§4.4.C) — min/max % rozsah, žádná kaskáda (jen platformní úroveň). */
export const SPVPP_BUCKET_KEYS = [
  'spvppOsobniPeceARespit',
  'spvppPoradenstviPsychoKontakt',
  'spvppVzdelavani',
] as const
export type SpvppBucketKey = (typeof SPVPP_BUCKET_KEYS)[number]
export interface SpvppBucketRange {
  minPct: number
  maxPct: number
}

/** Platformní výchozí hodnoty (seed/fallback, pokud legislativeParameters
 * ještě nemá žádný záznam — v praxi se vždy má seedovat aspoň jeden).
 * POZOR: jen `obed: 90` je přímo doložené (vyhláška §5f, zmíněno v zadání).
 * `stravaCelodenni`/`ubytovaniDen`/`hlidaniHodina`/`doucovaniHodina` jsou
 * ROZUMNÉ ODHADY (zadání jejich přesnou Kč hodnotu neuvádí) — `vymysli to`
 * svolení použito, ale superadmin by je měl před ostrým provozem ověřit a
 * případně upravit přes `/platforma` (stejný mechanismus jako
 * `koCapacityThreshold`), ne je brát jako ověřenou právní hodnotu.
 * `vzdelavaniUbytovaniDen: 1500` JE přímo doložené (Instrukce VŘ SRP a SS
 * č. 3/2025, str. 11–12 — "do 1 500 Kč za dospělou osobu na den"). */
export const DEFAULT_RATE_VALUES: Record<RateParameterKey, number> = {
  stravaCelodenni: 190,
  obed: 90,
  ubytovaniDen: 260,
  vzdelavaniUbytovaniDen: 1500,
  hlidaniHodina: 150,
  doucovaniHodina: 200,
}
export const DEFAULT_POLICY_VALUES: Record<PolicyParameterKey, PolicyValue> = {
  kurzovneRefundace: 'zakazano',
}
export const DEFAULT_SPVPP_BUCKETS: Record<SpvppBucketKey, SpvppBucketRange> = {
  spvppOsobniPeceARespit: { minPct: 5, maxPct: 15 },
  spvppPoradenstviPsychoKontakt: { minPct: 10, maxPct: 20 },
  spvppVzdelavani: { minPct: 5, maxPct: 10 },
}
