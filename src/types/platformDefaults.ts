/**
 * platformDefaults/global — jediný globální singleton dokument,
 * DOPLNENI_ZADANI-DO-M5 §1 bod 3 (nejnižší priorita v kaskádě prahu KO
 * kapacity, superadmin-only zápis). Zatím jedno pole, ale vlastní
 * kolekce, ne příznak na `organizations/{orgId}` — platformní, ne
 * per-organizace.
 */
export interface PlatformDefaultsDoc {
  koCapacityThreshold: number
}

export const DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD = 19

export const PLATFORM_DEFAULTS_DOC_ID = 'global'
