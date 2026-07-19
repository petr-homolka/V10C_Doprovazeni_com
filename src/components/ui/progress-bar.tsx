/**
 * ProgressBar — přeměřeno 2026-07-19 na Magnific People stránce (credits
 * pruh): track --bg-surface-soft, výška 10px (h-2.5), radius-lg, fill šířka
 * přes inline style percento. **Vědomě NEpřevzato:** jejich fill je jejich
 * brand modrá (#4F69F2 — mimochodem stejný odstín jako naše --subject-
 * ospod, což by kolidovalo s významem). Fill je tu monochromní --primary,
 * podle vlastního principu "barva jen na badge/subjekt", ne na chrome.
 */
export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2.5 w-full overflow-hidden rounded-lg bg-surface-soft"
    >
      <div
        className="h-full rounded-lg bg-primary transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
