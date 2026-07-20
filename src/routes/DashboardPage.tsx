import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/shell/AppShell'
import { TodaySections } from '@/components/TodaySections'

/**
 * "Dnes" — DESIGN_SYSTEM.md vzorová obrazovka (§1, §4, §14). "Čeká na vás"
 * (TodaySections) je od M3.4 reálný dotaz nad Dohodami/`lastVisitAt`, viz
 * ZADANI §6 A3 bod 5 a dashboardService.ts.
 */
export default function DashboardPage() {
  const { userDoc, firebaseUser } = useAuth()

  return (
    <AppShell>
      <div>
        <h1 className="text-lg font-normal leading-normal text-text-primary">
          Dnes
        </h1>
        <p className="mt-1 text-[13px] text-text-secondary">
          Přihlášen jako {userDoc?.displayName ?? firebaseUser?.email}
          {userDoc?.role ? ` · ${userDoc.role}` : ''}
        </p>
      </div>

      <TodaySections />
    </AppShell>
  )
}
