import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Obecný modální kontejner (centrovaná karta na tlumeném pozadí, Escape
 * zavře) — první použití je VoiceRecorderModal (M3), stavěno rovnou jako
 * znovupoužitelný primitiv, ne jednorázová komponenta. */
export function Modal({
  onClose,
  children,
  className,
}: {
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'max-h-[85vh] w-full max-w-[520px] overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-raised',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
