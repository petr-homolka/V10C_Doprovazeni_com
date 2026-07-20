/**
 * §6 A9 / DOPLNENI_ZADANI-DO-M5 §1 — efektivní práh kapacity KO se počítá
 * kaskádou (první nalezená hodnota vyhrává): per-KO `capacityThresholdOverride`
 * → per-organizace `koCapacityThreshold` → platformní
 * `platformDefaults.koCapacityThreshold`. Výsledek se násobí FTE dané KO
 * (0,1–1,0) a zaokrouhluje DOLŮ — konzervativně, menší efektivní práh
 * znamená dřívější upozornění, ne pozdější (zadání: "zaokrouhlení nech na
 * implementační detail, konzervativně dolů").
 */
export function computeEffectiveCapacityThreshold(
  fte: number | null | undefined,
  override: number | null | undefined,
  orgThreshold: number | null | undefined,
  platformThreshold: number,
): number {
  const base = override ?? orgThreshold ?? platformThreshold
  const effectiveFte = fte ?? 1
  return Math.floor(base * effectiveFte)
}
