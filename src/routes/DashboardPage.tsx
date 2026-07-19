import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/shell/AppShell'
import { TodaySampleSections } from '@/components/TodaySampleSections'

/**
 * "Dnes" — DESIGN_SYSTEM.md vzorová obrazovka (§1, §4, §14). Obsah sekcí
 * (TodaySampleSections) je zatím ukázková data pro ověření vizuálu, ne
 * reálný dotaz — viz ZADANI §6 A3 bod 5, přijde s M2/M3.
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

      <TodaySampleSections />
    </AppShell>
  )
}
