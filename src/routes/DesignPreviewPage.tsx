import { AppShell } from '@/components/shell/AppShell'
import { TodaySampleSections } from '@/components/TodaySampleSections'
import { AuthContext } from '@/contexts/auth-context'
import { Tag } from '@/components/ui/tag'
import { Input } from '@/components/ui/input'

const MOCK_AUTH_VALUE = {
  firebaseUser: null,
  loading: false,
  userDoc: {
    uid: 'preview',
    role: 'klicova_osoba' as const,
    displayName: 'Jana Málková',
    email: 'jana@example.com',
    organizationId: 'preview-org',
    createdAt: 'preview',
  },
}

/**
 * DOČASNÁ stránka pro vizuální review (§11 "vzorek před sweepem") —
 * NEPROCHÁZÍ RequireAuth, protože v tuhle chvíli neexistuje žádný fungující
 * backend (Auth emulátor na tomhle stroji nestartuje), přes který by šlo
 * ukázat reálně přihlášenou obrazovku. AuthContext se tu lokálně přepíše
 * mock hodnotou, ať Sidebar/Dashboard vidí "přihlášeného" uživatele stejně
 * jako v ostrém provozu. Přepínač Světlý/Tmavý je teď součást TopBaru
 * (useTheme), tahle stránka ho jen dědí. Smazat, jakmile M1 přinese reálná
 * data a přihlášení přes tenhle shell jde ověřit normální cestou (/login).
 */
export default function DesignPreviewPage() {
  return (
    <AuthContext.Provider value={MOCK_AUTH_VALUE}>
      <AppShell breadcrumb={[{ label: 'Rodiny', href: '/rodiny' }, { label: 'Rodina Novákových' }]}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-semibold leading-tight text-text-primary">
              Dnes
            </h1>
            <Tag>Prémiové</Tag>
          </div>
          <p className="mt-1 text-[13px] text-text-secondary">
            Přihlášen jako Jana Málková · klicova_osoba (ukázková data pro review)
          </p>
          <div className="mt-4 max-w-80">
            <Input placeholder="Ukázkový vstup (nové pozadí/border/focus)" />
          </div>
        </div>

        <TodaySampleSections />
      </AppShell>
    </AuthContext.Provider>
  )
}
