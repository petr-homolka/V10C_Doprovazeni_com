/**
 * ZADANI §7.4 — jeden sdílený model viditelnosti napříč `timeline` (M3),
 * budoucím chatem (`messages.audience`, M9) a dokumenty (`visibleToFoster`,
 * M5 — tam se sémanticky sjednotí, ne hned teď). Jeden mentální model
 * "úroveň sdílení", ne tři různé koncepty pro tři funkce.
 */
export type SharingLevel = 'private' | 'internal' | 'foster' | 'ospod'

export const DEFAULT_SHARING_LEVEL: SharingLevel = 'internal'

export const SHARING_LEVEL_LABELS: Record<SharingLevel, string> = {
  private: 'Soukromé',
  internal: 'Tým',
  foster: 'Pěstoun',
  ospod: 'OSPOD',
}
