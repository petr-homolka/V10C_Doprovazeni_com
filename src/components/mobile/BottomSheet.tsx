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
 *
 * Křivka `cubic-bezier(0.32,0.72,0,1)` — stejný "spring" tvar, jaký iOS
 * používá na vyjíždění modálních panelů (Petrovo zadání 2026-07-22, "styl
 * aktuálního iOS") — výchozí `ease-out` působilo mechaničtěji/trhaněji.
 * Zavření přes pozadí/Escape si samo přehraje zpětnou animaci
 * (`requestClose`), než zavolá skutečné `onClose` — okamžité zavření po
 * úspěšném uložení (`VoiceCaptureSheet` po odeslání) jde mimo tenhle
 * primitiv a zůstává bez animace, to je přijatelná výjimka (fajfka úspěchu
 * už sama dává uzavírací pocit).
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
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 10)
    return () => clearTimeout(timer)
  }, [])

  function requestClose() {
    setClosing(true)
    setTimeout(onClose, 320)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  const visible = entered && !closing

  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-end transition-colors duration-300', visible ? 'bg-black/50' : 'bg-black/0')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'flex max-h-[88vh] w-full min-h-0 flex-col overflow-y-auto rounded-t-[var(--radius-lg)] bg-surface shadow-overlay transition-transform duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
          visible ? 'translate-y-0' : 'translate-y-full',
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
