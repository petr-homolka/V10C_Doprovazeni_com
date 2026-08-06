import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

/**
 * „JE TU NOVÁ VERZE" — jinak lidi sedí na starém buildu a nevědí o tom.
 *
 * Odhaleno 27. 7.: nasadila se nová sekce na profilu dítěte, deploy hlásil
 * hotovo, a Petr ji neviděl. Nebyla to chyba nasazení — appka je PWA
 * a workbox si předcachovává celý balík souborů, takže prohlížeč dál
 * obsluhoval starou verzi.
 *
 * TO JE HORŠÍ NEŽ ROZBITÉ NASAZENÍ. Rozbité nasazení je vidět. Tohle vypadá
 * jako chybějící funkce, a hledá se pak v kódu něco, co v kódu chybět nemůže.
 *
 * ─── PROČ PTÁT, A NE OBNOVIT SAMA ─────────────────────────────────────
 *
 * Dřív tu bylo `registerType: 'autoUpdate'`. Znělo to líp, ale nedělalo to,
 * co si člověk představí: nová verze se stáhla na pozadí, jenže OTEVŘENÁ
 * STRÁNKA dál běžela na starých souborech — projevilo se to až po dalším
 * načtení, někdy až po druhém. Tichá aktualizace problém neřešila, jen ho
 * odsunula a schovala.
 *
 * Obnovit stránku automaticky taky nejde. Klíčová osoba tady píše zápis
 * z návštěvy nebo vyplňuje Dohodu — obnovení uprostřed by jí sebralo
 * rozepsaný text. Proto se ptáme a čekáme na kliknutí.
 *
 * ─── PROČ SE PTÁT AKTIVNĚ ─────────────────────────────────────────────
 *
 * Service worker se po nové verzi kouká sám jen při načtení stránky. Tahle
 * appka se ale používá tak, že se ráno otevře a zavře večer — bez pobídky
 * by se na jedné otevřené záložce nová verze neobjevila celý den. Proto se
 * kontroluje po půl hodině a při každém návratu k záložce.
 */

/** Jak často se ptát serveru, jestli nevyšla nová verze. */
const UPDATE_CHECK_MS = 30 * 60 * 1000

export function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, reg) {
      setRegistration(reg ?? null)
    },
  })

  useEffect(() => {
    if (!registration) return

    // `update()` sahá na síť a offline vyhodí — spadnout kvůli kontrole
    // aktualizace by bylo absurdní, tak se chyba spolkne a zkusí se příště.
    const check = () => void registration.update().catch(() => {})

    const timer = setInterval(check, UPDATE_CHECK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [registration])

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-[100] flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 shadow-lg"
    >
      <p className="text-sm text-text-primary">
        Je tu nová verze aplikace.
        <span className="ml-1 text-text-tertiary">Obnovením se načte.</span>
      </p>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>
        Obnovit
      </Button>
    </div>
  )
}
