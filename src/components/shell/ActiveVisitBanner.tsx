import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActiveVisit } from '@/hooks/useActiveVisit'
import { formatElapsedClock } from '@/lib/utils'

/** DESIGN_SYSTEM §8.2 "Perzistentní banner rozjeté návštěvy" — vždy
 * viditelný napříč obrazovkami, dokud návštěva běží (§A3 bod 2), tap →
 * zpět na Giant Timer (VisitTimerPage). Živý uvnitř AppShell, ne
 * per-stránka — objeví se automaticky kdekoli v appce. */
export function ActiveVisitBanner() {
  const visit = useActiveVisit()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!visit) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [visit])

  if (!visit) return null

  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(visit.startedAt)) / 1000))

  return (
    <button
      type="button"
      onClick={() => navigate(`/rodiny/${visit.familyUid}/navsteva`)}
      className="flex shrink-0 items-center justify-center gap-2 bg-primary-soft px-4 py-1.5 text-sm text-text-primary transition-colors duration-150 hover:bg-primary-soft-hover"
    >
      <span className="size-1.5 rounded-full bg-primary" />
      Probíhá návštěva · {formatElapsedClock(elapsedSeconds)}
    </button>
  )
}
