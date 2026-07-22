import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Vyjížděcí panel ODSPODU (mobil/PWA, M11) — Petrovo explicitní zadání
 * ("vyjížděcí panely odspoda stránky", inspirace Things 3/Routine.co).
 * Samostatný primitiv od `Drawer` (zprava, desktop) a `Modal` (centrovaný,
 * desktop) — na mobilu je "vyjet odspoda" ten přirozený, palcem
 * ovladatelný gesto-vzor, ne boční panel.
 *
 * Táhne se přes `env(safe-area-inset-bottom)` (iPhone home indicator),
 * zavírá se klikem na tlumené pozadí i Escape (krátké interakce, ne
 * víceminutový diktát jako `Drawer` — ztráta rozdělané práce je tu levná).
 *
 * `overflow-y-auto`+`min-h-0` — bez toho dlouhý obsah (dlouhý přepis v
 * `VoiceCaptureSheet`) jen přetekl přes `max-h-[88vh]` beze scrollu, takže
 * tlačítko na konci (Zastavit/Odeslat) bylo neviditelné a nedosažitelné
 * (živě nahlášeno Petrem 2026-07-22).
 */
export function BottomSheet({
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
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'flex max-h-[88vh] w-full min-h-0 flex-col overflow-y-auto rounded-t-2xl bg-surface shadow-overlay transition-transform duration-300 ease-out',
          entered ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex shrink-0 justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-border-strong" />
        </div>
        {children}
      </div>
    </div>
  )
}
