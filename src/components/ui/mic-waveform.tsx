import { cn } from '@/lib/utils'

/** Živý sloupcový graf hlasitosti (viz `useMicLevels`) — Claude Code
 * dikto­vací lišta jako inspirace (Petr, 2026-07-24): malé tlačítko +
 * waveform + živý text, místo obrazovku zabírajícího pulzujícího kruhu. */
export function MicWaveform({ levels, className }: { levels: number[]; className?: string }) {
  return (
    <div className={cn('flex items-end gap-0.5', className)} aria-hidden>
      {levels.map((level, i) => (
        <span
          key={i}
          className="w-1 shrink-0 rounded-full bg-danger-solid transition-[height] duration-75"
          style={{ height: `${Math.round(Math.max(10, level * 100))}%` }}
        />
      ))}
    </div>
  )
}
