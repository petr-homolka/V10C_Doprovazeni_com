import type { CareLimit } from '@/lib/spisInsights'

/**
 * ŘÁDEK LHŮTY — popisek, pruh, odkud limit je, a co to znamená.
 *
 * Pruh znamená vždycky totéž: KOLIK Z LIMITU JE PRYČ. Jeho barvu určuje tón
 * (`spisInsights.ts`), ne délka — splněná lhůta je klidná šedá, i když je
 * pruh plný, propadlá je červená. Červená je na téhle stránce jediná barva
 * a používá se jen tady a u propadlého data.
 *
 * Řádek `source` („Dohoda: každých 60 dní · naposledy 27. 5.") tam je proto,
 * aby lhůta nevypadala jako naše vymyšlené pravidlo. Kdo ji chce změnit, ví
 * z toho řádku, kde ji změnit.
 */
export function LimitRow({ limit }: { limit: CareLimit }) {
  const pct = Math.min(100, Math.round((limit.done / limit.target) * 100))
  return (
    <div className="sp__row sp__row--lhuta">
      <div className="sp__lim-label">
        <p className="text-sm text-text-primary">{limit.label}</p>
      </div>

      <div className="sp__lim-state">
        <p className={`text-sm ${limit.tone === 'po' ? 'text-accent' : 'text-text-primary'}`}>{limit.state}</p>
        <p className="text-xs text-text-faint">
          {limit.done} / {limit.target} {limit.unit}
        </p>
      </div>

      <div className="sp__lim-bar">
        <div className="sp__meter max-w-[420px]">
          <span className={`sp__meterfill sp__meterfill--${limit.tone}`} style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-text-faint">{limit.source}</p>
      </div>
    </div>
  )
}
