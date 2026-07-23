import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { Baby, CheckSquare, ChevronRight, LogOut, UserRound } from 'lucide-react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { GroupedList, GroupedListRow } from '@/components/mobile/GroupedList'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/firebase'
import { STAFF_ROLE_LABELS } from '@/types/user'

const SHORTCUTS = [
  { to: '/pestouni', label: 'Pěstouni', icon: UserRound },
  { to: '/deti', label: 'Děti', icon: Baby },
  { to: '/ukoly', label: 'Úkoly', icon: CheckSquare },
] as const

/** Mobilní "Účet" tab — minimum nutné (jméno, role, odhlášení). Zbytek
 * Nastavení (vzhled/oznámení/…) zůstává jen na desktopu — SEAM, mobilní
 * appka je zatím cíleně jen na rychlé zachycení zápisu z terénu.
 *
 * "Odhlásit se" jako VLASTNÍ červená sekce seznamu, ne sekundární
 * tlačítko — stejná konvence jako iOS Nastavení (Sign Out vždy samostatná
 * skupina dole, ne tlačítko vedle textu). */
export default function MobileAccountPage() {
  const navigate = useNavigate()
  const { userDoc, firebaseUser } = useAuth()
  const displayName = userDoc?.displayName ?? firebaseUser?.email ?? ''
  const roleLabel = userDoc?.role ? (STAFF_ROLE_LABELS[userDoc.role as keyof typeof STAFF_ROLE_LABELS] ?? userDoc.role) : ''

  return (
    <MobileShell>
      <div className="flex flex-col gap-6 px-5 pb-6 pt-8">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-text-primary">Účet</h1>

        <GroupedList>
          <GroupedListRow as="div">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[16px] font-medium text-text-primary">{displayName}</span>
              <span className="truncate text-[14px] text-text-secondary">{userDoc?.email ?? firebaseUser?.email}</span>
            </span>
          </GroupedListRow>
          {roleLabel && (
            <GroupedListRow as="div">
              <span className="text-[14px] text-text-tertiary">Role</span>
              <span className="ml-auto text-[16px] text-text-primary">{roleLabel}</span>
            </GroupedListRow>
          )}
        </GroupedList>

        {/* Zkratky (2026-07-23) — Pěstouni/Děti/Úkoly nemají vlastní tab
         * (dolní lišta má jen 4 pevné sloty, `MobileShell.tsx`), a dřív
         * neměly na mobilu ŽÁDNÝ vstupní bod vůbec (jen skryté routy) —
         * tahle sekce je poprvé zpřístupňuje. */}
        <GroupedList>
          {SHORTCUTS.map(({ to, label, icon: Icon }) => (
            <GroupedListRow key={to} onClick={() => navigate(to)}>
              <Icon size={20} strokeWidth={1.75} className="shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1 text-[16px] text-text-primary">{label}</span>
              <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
            </GroupedListRow>
          ))}
        </GroupedList>

        <GroupedList>
          <GroupedListRow onClick={() => signOut(auth)} className="justify-center text-danger active:bg-danger-bg">
            <LogOut size={18} strokeWidth={1.75} />
            <span className="text-[16px] font-medium">Odhlásit se</span>
          </GroupedListRow>
        </GroupedList>
      </div>
    </MobileShell>
  )
}
