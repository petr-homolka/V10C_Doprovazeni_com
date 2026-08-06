import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Šipky zpět / vpřed pro hlavičku (jako v Routine).
 *
 * Problém, který tenhle hook řeší: prohlížeč neumí říct „je kam jít vpřed?".
 * `window.history.length` počítá i záznamy z jiných stránek a nedá se z něj
 * nic odvodit. Dvě šipky, které jsou vždycky aktivní a někdy nedělají nic,
 * jsou přitom horší než žádné — uživatel jednou klikne, nic se nestane
 * a přestane jim věřit.
 *
 * React Router si do `history.state` ukládá `idx` = pořadí záznamu v rámci
 * NAŠÍ historie (ověřeno v `node_modules/react-router`: `idx: index`).
 * Z toho se dá poznat:
 *   - zpět jde, když `idx > 0`,
 *   - vpřed jde, když `idx` je menší než nejvyšší `idx`, který jsme viděli.
 *
 * Nejvyšší viděný index žije v modulové proměnné, ne ve stavu komponenty:
 * hlavička se při přechodu překresluje a při odmontování by se počítadlo
 * resetovalo — historie prohlížeče odmontování nezná, takže by se rozešlo
 * se skutečností.
 *
 * `idx` nastavuje jen `BrowserRouter`. V designovém náhledu je
 * `MemoryRouter`, takže tam jsou obě šipky správně ztlumené.
 */
let maxSeenIndex = 0

/** Čistá část rozhodnutí, ať se dá otestovat bez routeru a prohlížeče. */
export function historyArrowState(index: number, maxSeen: number): {
  canGoBack: boolean
  canGoForward: boolean
} {
  return { canGoBack: index > 0, canGoForward: index < maxSeen }
}

function currentIndex(): number {
  const state = window.history.state as { idx?: number } | null
  return typeof state?.idx === 'number' ? state.idx : 0
}

export function useHistoryArrows(): {
  canGoBack: boolean
  canGoForward: boolean
  goBack: () => void
  goForward: () => void
} {
  const navigate = useNavigate()
  const location = useLocation()
  const [index, setIndex] = useState(currentIndex)
  const [maxSeen, setMaxSeen] = useState(maxSeenIndex)

  useEffect(() => {
    const idx = currentIndex()
    maxSeenIndex = Math.max(maxSeenIndex, idx)
    setIndex(idx)
    setMaxSeen(maxSeenIndex)
  }, [location])

  return {
    ...historyArrowState(index, maxSeen),
    goBack: () => navigate(-1),
    goForward: () => navigate(1),
  }
}
