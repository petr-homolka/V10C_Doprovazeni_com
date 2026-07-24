import { cn } from '@/lib/utils'

export interface AvatarSubject {
  kind: 'family' | 'fosterPerson' | 'child'
  label: string
  avatarUrl?: string | null
}

function initials(label: string): string {
  return label
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * Překrývající se avatary osob, kterých se událost týká (Petrovo zadání:
 * "V zápisu události se VŽDY zobrazují avatary … mohou se překrývat asi 15 %
 * své šířky"). Kompaktní — sedí i do drobného měsíčního políčka i do širších
 * řádků agendy. Max 4 avatary + "+N" přetečení.
 */
export function EventAvatarStack({
  subjects,
  size = 18,
  className,
}: {
  subjects: AvatarSubject[]
  size?: number
  className?: string
}) {
  if (!subjects.length) return null
  const shown = subjects.slice(0, 4)
  const overflow = subjects.length - shown.length
  const overlap = Math.round(size * 0.15)

  return (
    <div className={cn('flex shrink-0 items-center', className)} aria-hidden>
      {shown.map((s, i) => (
        <span
          key={i}
          title={s.label}
          style={{ width: size, height: size, marginLeft: i === 0 ? 0 : -overlap }}
          className="inline-flex items-center justify-center overflow-hidden rounded-full border border-surface-soft bg-inset text-2xs font-semibold leading-none text-text-secondary"
        >
          {s.avatarUrl ? (
            <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            initials(s.label) || '?'
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: -overlap }}
          className="inline-flex items-center justify-center rounded-full border border-surface-soft bg-primary-soft text-2xs font-semibold leading-none text-primary"
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
