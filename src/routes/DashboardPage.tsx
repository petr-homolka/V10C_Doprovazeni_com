import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

/**
 * Placeholder pro M0 — jen dokazuje, že Auth + role z users/{uid} + routing
 * fungují od začátku do konce. Skutečná obrazovka „Dnes" (přehled rodin,
 * upozornění na blížící se lhůty) vzniká až v M1+/M3.
 */
export default function DashboardPage() {
  const { firebaseUser, userDoc } = useAuth()

  return (
    <div className="min-h-screen bg-app px-6 py-8">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="font-serif text-[28px] font-semibold text-text-primary">
          Dnes
        </h1>
        <div className="mt-4 rounded-lg border border-border bg-surface p-5">
          <p className="text-[15px] text-text-primary">
            Přihlášen jako <strong>{userDoc?.displayName ?? firebaseUser?.email}</strong>
          </p>
          <p className="mt-1 text-[13px] text-text-secondary">
            Role: {userDoc?.role ?? '(profil users/{uid} zatím neexistuje)'}
          </p>
        </div>
        <Button variant="ghost" className="mt-6" onClick={() => signOut(auth)}>
          Odhlásit se
        </Button>
      </div>
    </div>
  )
}
