import { signOut } from 'firebase/auth'
import { LogOut } from 'lucide-react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/firebase'
import { STAFF_ROLE_LABELS } from '@/types/user'

/** Mobilní "Účet" tab — minimum nutné (jméno, role, odhlášení). Zbytek
 * Nastavení (vzhled/oznámení/…) zůstává jen na desktopu — SEAM, mobilní
 * appka je zatím cíleně jen na rychlé zachycení zápisu z terénu. */
export default function MobileAccountPage() {
  const { userDoc, firebaseUser } = useAuth()
  const displayName = userDoc?.displayName ?? firebaseUser?.email ?? ''
  const roleLabel = userDoc?.role ? (STAFF_ROLE_LABELS[userDoc.role as keyof typeof STAFF_ROLE_LABELS] ?? userDoc.role) : ''

  return (
    <MobileShell>
      <div className="flex flex-col gap-6 px-5 pt-8">
        <div>
          <p className="text-2xl font-normal text-text-primary">{displayName}</p>
          <p className="mt-1 text-sm text-text-secondary">{userDoc?.email ?? firebaseUser?.email}</p>
          {roleLabel && <p className="mt-0.5 text-sm text-text-tertiary">{roleLabel}</p>}
        </div>
        <Button variant="secondary" size="default" onClick={() => signOut(auth)} className="h-12 w-fit gap-2">
          <LogOut size={18} strokeWidth={1.75} />
          Odhlásit se
        </Button>
      </div>
    </MobileShell>
  )
}
