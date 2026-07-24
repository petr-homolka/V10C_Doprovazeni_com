import type { IconComponent } from '@/components/ui/icons'
import { Button } from './button'

/** DESIGN_SYSTEM.md §6.7 — ikona 32px tertiary + jedna věta + sekundární akce. */
export function EmptyState({
  icon: Icon,
  text,
  actionLabel,
  onAction,
}: {
  icon: IconComponent
  text: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-10 text-center">
      <Icon size={32} strokeWidth={1.75} className="text-text-tertiary" />
      <p className="max-w-[320px] text-base text-text-secondary">{text}</p>
      {actionLabel && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
