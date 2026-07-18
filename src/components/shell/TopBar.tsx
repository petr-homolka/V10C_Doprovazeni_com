import { Bell } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/**
 * NOVÝ vzorek (2026-07-19, inspirace Magnific.ai top-right cluster) —
 * zvonek na notifikace je reálná plánovaná funkce (ZADANI §6 A5, poll
 * 60s), avatar je zatím jen vizuální stub (neotevírá menu). Čeká na
 * schválení, jestli má appka mít účet dostupný na DVOU místech
 * (sidebar dole + tady), nebo se má topbar omezit jen na notifikace a
 * účet nechat výhradně v sidebaru.
 */
export function TopBar() {
  const { userDoc, firebaseUser } = useAuth()
  const displayName = userDoc?.displayName ?? firebaseUser?.email ?? ''
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center justify-end gap-2 px-8 py-3">
      <button
        type="button"
        aria-label="Oznámení"
        className="flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-soft"
      >
        <Bell size={18} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label="Účet"
        className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary"
      >
        {initials || '?'}
      </button>
    </div>
  )
}
