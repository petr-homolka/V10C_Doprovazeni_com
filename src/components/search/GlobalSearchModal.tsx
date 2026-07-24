import { useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { EntitySearch } from '@/components/search/EntitySearch'

/**
 * Globální hledání — dostupné z hlavičky na KTERÉKOLI stránce, ne jen
 * v kalendáři. Hledání osoby je nejčastější první krok práce (volá pěstoun,
 * přijde e-mail, ptá se OSPOD) a proklikávat se k němu přes kalendář je
 * zbytečná zacházka.
 *
 * Zkratka Ctrl/Cmd+K je vědomě stejná jako v editorech a ostatních
 * nástrojích, které tady lidé používají — nic nového k učení.
 */
export function GlobalSearchModal({
  organizationId,
  onClose,
}: {
  organizationId: string
  onClose: () => void
}) {
  return (
    <Modal onClose={onClose} className="w-full max-w-[560px]">
      <div className="flex h-[min(70vh,560px)] flex-col p-4">
        <h2 className="mb-3 shrink-0 text-[15px] font-semibold text-text-primary">Hledat</h2>
        <EntitySearch organizationId={organizationId} onNavigated={onClose} />
      </div>
    </Modal>
  )
}

/**
 * Ctrl/Cmd+K otevře hledání. Záměrně NEreaguje, když se právě píše do pole
 * jinde na stránce — jinak by zkratka kradla stisk uprostřed vyplňování
 * formuláře. Escape zavírá `Modal` sám.
 */
export function useGlobalSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return
      const el = document.activeElement
      const tag = el?.tagName
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement | null)?.isContentEditable
      if (typing) return
      e.preventDefault()
      onOpen()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onOpen])
}
