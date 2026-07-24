import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Centrovaná karta pro malá, jednorázová rozhodnutí (potvrzení, krátký
 * formulář) — na rozdíl od `Drawer` (obsah potřebující víc výšky/prostoru,
 * kde klik na pozadí záměrně nezavírá) klik na tlumené pozadí i Escape
 * TADY zavírají, protože ztráta rozdělané práce je nepravděpodobná/levná
 * (viz drawer.tsx doc komentář pro rozlišení obou primitiv).
 */
export function Modal({
  onClose,
  children,
  className,
}: {
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 10)
    return () => clearTimeout(timer)
  }, [])

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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'flex w-full max-w-[480px] flex-col rounded-lg border border-border bg-surface p-5 shadow-overlay transition-all duration-150 ease-out',
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
