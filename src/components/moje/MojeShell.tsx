import type { ReactNode } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

/**
 * `/moje/*` — vlastní, VÝRAZNĚ zúženější shell pro pěstouna (§2: "vlastní
 * omezená appka"), NE staffový `AppShell` (žádný sidebar s Rodiny/
 * Zaměstnanci/Úkoly — pěstoun na ně nemá přístup ani ho nepotřebuje).
 * Stejné vizuální tokeny jako zbytek appky (§1 "jeden systém, ne dva
 * jazyky"), jen jednodušší struktura — jeden sloupec, žádný postranní
 * panel.
 */
export function MojeShell({ children }: { children: ReactNode }) {
  const { userDoc } = useAuth()

  return (
    <div className="sp min-h-screen bg-void">
      <header className="flex h-14 items-center justify-between border-b border-border bg-app px-6">
        <span className="text-sm font-medium text-text-primary">Doprovázení.com</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{userDoc?.displayName}</span>
          <Button variant="ghost" size="sm" onClick={() => signOut(auth)}>
            Odhlásit se
          </Button>
        </div>
      </header>
      {/* Stejná osnova jako zbytek platformy: šedá plocha, na ní bílé
          karty (`sp__sections`). Pěstounův portál není druhý design. */}
      <main className="sp__sections" style={{ maxWidth: 760 }}>
        {children}
      </main>
    </div>
  )
}
