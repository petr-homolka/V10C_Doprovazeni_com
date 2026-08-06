import { useCallback, useState } from 'react'

const MIN_LOADING_MS = 2000
const SUCCESS_FLASH_MS = 1200

/**
 * Zaručí, že "ukládám" stav tlačítka trvá aspoň MIN_LOADING_MS (i když je
 * zápis rychlejší), pak krátce ukáže potvrzovací stav — jinak rychlé
 * zápisy jen "prokliknou" a uživatel neví, jestli se akce vůbec stala.
 * Chyby PROPADÁVAJÍ ven (caller si je odchytí a nastaví vlastní chybovou
 * hlášku) — tenhle hook se stará jen o loading/success vizuál tlačítka.
 *
 * Použití: `const { loading, success, run } = useAsyncSubmit()` a
 * `<Button loading={loading} success={success} onClick={() =>
 * run(() => doSomething())}>Uložit</Button>`.
 *
 * `run()` se vrátí (resolvne) TEPRVE PO doběhnutí celého cyklu (loading →
 * success záblesk), ne hned po dokončení akce — jinak by kód volaný
 * "po run()" (typicky zavření formuláře/reset polí) zavřel formulář ve
 * STEJNÉM okamžiku, kdy se fajfka objeví, a uživatel by ji nikdy neviděl
 * (živě odhaleno testem v prohlížeči). Díky tomuhle to funguje správně na
 * všech volajících místech bez úpravy — je to jediné místo, kde se to
 * musí ošetřit.
 */
export function useAsyncSubmit() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (loading) return
      setLoading(true)
      setSuccess(false)
      const startedAt = Date.now()
      try {
        await action()
      } catch (e) {
        setLoading(false)
        throw e
      }
      const elapsed = Date.now() - startedAt
      if (elapsed < MIN_LOADING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed))
      }
      setLoading(false)
      setSuccess(true)
      await new Promise((resolve) => setTimeout(resolve, SUCCESS_FLASH_MS))
      setSuccess(false)
    },
    [loading],
  )

  return { loading, success, run }
}
