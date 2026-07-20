import { cn } from '@/lib/utils'

/**
 * CapacityRing — DOPLNENI_ZADANI-DO-M5 §1 bod 4, nová primitivum, Dodatek
 * do DESIGN_SYSTEM.md §6.x (ne úprava existujícího `ProgressBar`, ten
 * zůstává beze změny — jde o samostatný, kruhový tvar pro jiný účel).
 * Stejná konstrukce jako `ProgressBar` (`role="progressbar"`,
 * monochromní `--primary` fill v běžném stavu — "barva jen na
 * badge/subjekt" princip), ALE nad `threshold` přepíná na `--danger-solid`
 * (NE `--crisis`, ta je podle DESIGN_SYSTEM.md §2.3 vyhrazená výhradně
 * pro rodinnou krizovou agendu) a jemně pulzuje (`animate-pulse`), aby
 * upoutala pozornost v hustě obsazené tabulce zaměstnanců.
 */
export function CapacityRing({
  value,
  max,
  size = 32,
}: {
  value: number
  max: number
  size?: number
}) {
  const overThreshold = max > 0 && value >= max
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const strokeWidth = 3
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`Vytížení: ${value} z ${max}`}
      title={`${value} / ${max}`}
      className={cn('relative inline-flex shrink-0 items-center justify-center', overThreshold && 'animate-pulse')}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-soft"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('transition-all duration-300', overThreshold ? 'stroke-danger-solid' : 'stroke-primary')}
        />
      </svg>
      <span className="absolute text-[9px] font-medium leading-none text-text-secondary">{value}</span>
    </div>
  )
}
