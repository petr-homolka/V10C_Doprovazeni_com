import { signOut } from 'firebase/auth'
import { LogOut } from 'lucide-react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { IosList, IosListRow } from '@/components/mobile/IosList'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/firebase'
import { STAFF_ROLE_LABELS } from '@/types/user'

/** Mobilní "Účet" tab — minimum nutné (jméno, role, odhlášení). Zbytek
 * Nastavení (vzhled/oznámení/…) zůstává jen na desktopu — SEAM, mobilní
 * appka je zatím cíleně jen na rychlé zachycení zápisu z terénu.
 *
 * "Odhlásit se" jako VLASTNÍ červená sekce seznamu, ne sekundární
 * tlačítko — stejná konvence jako iOS Nastavení (Sign Out vždy samostatná
 * skupina dole, ne tlačítko vedle textu). */
export default function MobileAccountPage() {
  const { userDoc, firebaseUser } = useAuth()
  const displayName = userDoc?.displayName ?? firebaseUser?.email ?? ''
  const roleLabel = userDoc?.role ? (STAFF_ROLE_LABELS[userDoc.role as keyof typeof STAFF_ROLE_LABELS] ?? userDoc.role) : ''

  return (
    <MobileShell>
      <div className="flex flex-col gap-6 px-5 pb-6 pt-8">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-text-primary">Účet</h1>

        <IosList>
          <IosListRow as="div">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[16px] font-medium text-text-primary">{displayName}</span>
              <span className="truncate text-[14px] text-text-secondary">{userDoc?.email ?? firebaseUser?.email}</span>
            </span>
          </IosListRow>
          {roleLabel && (
            <IosListRow as="div">
              <span className="text-[14px] text-text-tertiary">Role</span>
              <span className="ml-auto text-[16px] text-text-primary">{roleLabel}</span>
            </IosListRow>
          )}
        </IosList>

        <IosList>
          <IosListRow onClick={() => signOut(auth)} className="justify-center text-danger active:bg-danger-bg">
            <LogOut size={18} strokeWidth={1.75} />
            <span className="text-[16px] font-medium">Odhlásit se</span>
          </IosListRow>
        </IosList>
      </div>
    </MobileShell>
  )
}
