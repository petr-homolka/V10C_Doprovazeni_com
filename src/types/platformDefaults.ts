/**
 * platformDefaults/global — jediný globální singleton dokument,
 * DOPLNENI_ZADANI-DO-M5 §1 bod 3 (nejnižší priorita v kaskádě prahu KO
 * kapacity, superadmin-only zápis). Platformní, ne per-organizace.
 *
 * `agreementDefaultDurationMonths` — stejná kaskáda jako u KO kapacity
 * (per-Dohoda ruční datum > per-organizace výchozí > platformní výchozí,
 * viz src/lib/agreementDuration.ts), jen pro předvyplnění "Platí do" při
 * založení Dohody — NIKDY tvrdý limit, KO/vedení může datum kdykoli
 * změnit (§47b zákona 359/1999 Sb. — reálná doba platnosti záleží na typu
 * péče, appka jen nabízí rozumný výchozí odhad, nevynucuje ho).
 */
export interface PlatformDefaultsDoc {
  koCapacityThreshold: number
  agreementDefaultDurationMonths?: number
}

export const DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD = 19
export const DEFAULT_PLATFORM_AGREEMENT_DURATION_MONTHS = 24

export const PLATFORM_DEFAULTS_DOC_ID = 'global'
