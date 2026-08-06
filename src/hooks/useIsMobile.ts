import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)'

/**
 * Mobil/PWA odlišení (M11, 2026-07-22) — KO v terénu potřebuje ÚPLNĚ JINOU
 * appku na telefonu, ne zmenšenou responzivní verzi desktopu (výslovné
 * zadání: "nejedná se o žádnou responzivní variantu"). Detekce podle
 * ŠÍŘKY okna (`matchMedia`, ne User-Agent sniffing — to je křehké a appka
 * musí fungovat i v mobilním prohlížeči bez instalace PWA, ne jen po
 * instalaci na plochu).
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY)
    function handleChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches)
    }
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  return isMobile
}
