import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Right-hand panel for "+ Add…" actions app-wide. Non-overlay (unlike
 * `Drawer`/`Modal`) — rendered via `AppShell`'s `sidePanel` prop as a
 * sibling of the sidebar/main column, so it spans the full viewport
 * height and edge instead of just the area below the TopBar. The rest
 * of the app stays interactive; only the main column's width shrinks.
 *
 * Field text size inside is scoped down via `.side-panel-fields` (see
 * index.css) rather than changing the shared `Input`/`Select` default,
 * which stays larger elsewhere to avoid iOS Safari's auto-zoom-on-focus.
 */
export function SidePanel({
  title,
  actions,
  onClose,
  children,
  className,
}: {
  title: string
  actions?: ReactNode
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full w-[380px] shrink-0 flex-col overflow-hidden bg-surface-soft shadow-overlay',
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-4">
        <h2 className="truncate text-[15px] font-semibold text-text-primary">{title}</h2>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít panel"
            title="Zavřít panel"
            className="flex size-8 items-center justify-center rounded-sm text-text-secondary transition-colors duration-150 hover:bg-overlay-active hover:text-text-primary"
          >
            <X size={17} strokeWidth={1.9} />
          </button>
        </div>
      </div>
      <div className="side-panel-fields min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  )
}
