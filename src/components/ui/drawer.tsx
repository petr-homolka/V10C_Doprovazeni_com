import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Pravý vyjížděcí panel — ZADANI §7.6 "desktop: drawer zprava" (dřív jen
 * pro detail zápisu, teď i pro nahrávání, M3). Na rozdíl od `Modal` (malá,
 * jednorázová rozhodnutí) je tenhle primitiv pro obsah, co potřebuje víc
 * prostoru/výšky — hlasový zápis se diktuje klidně několik minut, potřebuje
 * plnou výšku obrazovky, ne omezenou výšku centrované karty.
 *
 * Klik na tlumené pozadí ZÁMĚRNĚ nezavírá (na rozdíl od `Modal`) — ztráta
 * několikaminutového diktátu jedním nechtěným kliknutím vedle by byla
 * krutá. Zavření jen přes Escape nebo explicitní akci v obsahu panelu.
 */
export function Drawer({
  onClose,
  children,
  className,
}: {
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const [entered, setEntered] = useState(false)

  // Prázdné pole závislostí ZÁMĚRNĚ — `onClose` bývá nová inline funkce při
  // každém renderu rodiče, a efekt závislý na ní by se přeplánoval dřív,
  // než spouštěč animace vůbec stihl proběhnout. `setTimeout`, NE
  // `requestAnimationFrame` — rAF se na skrytém/pozadím dokumentu
  // (`document.hidden`) nikdy nespustí (běžné chování prohlížeče, ne bug),
  // takže panel by zůstal navždy "za hranou" — reálně odhaleno živým
  // testem (`document.hidden === true` i v aktivní kartě automatizace).
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'flex h-full w-full max-w-[480px] flex-col border-l border-border bg-surface shadow-overlay transition-transform duration-300 ease-out',
          entered ? 'translate-x-0' : 'translate-x-full',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
