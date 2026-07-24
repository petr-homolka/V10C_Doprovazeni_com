import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Třítečkové „overflow" menu na konci řádku (Woorkroom reference — každý
 * řádek seznamu má vpravo ⋮ s akcemi). Stejný outside-click/Escape vzor
 * jako `AccountMenu`. `items` = akce; klik na položku ji spustí a zavře.
 */
export interface RowMenuItem {
  label: string
  onSelect: () => void
  icon?: ReactNode
  danger?: boolean
}

export function RowMenu({ items, className }: { items: RowMenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        aria-label="Další akce"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex size-8 items-center justify-center rounded-full text-text-tertiary transition-colors duration-150 hover:bg-overlay-active hover:text-text-primary"
      >
        <MoreVertical size={18} strokeWidth={2} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg bg-surface-soft p-1.5 shadow-overlay"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-overlay-active',
                item.danger ? 'text-danger' : 'text-text-primary',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
