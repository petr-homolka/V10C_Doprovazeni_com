import { AppShell } from '@/components/shell/AppShell'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/**
 * Nastavení / Účet — druhá REÁLNÁ stránka nové struktury Nastavení
 * (Dodatek 9). E-mail jako prostý text, ne input (naměřeno na Magnific
 * Profile stránce, Dodatek 8) — e-mail je identita přihlášení, needituje
 * se tady stejnou cestou jako jméno.
 */
export default function AccountSettingsPage() {
  return (
    <AppShell breadcrumb={[{ label: 'Nastavení' }, { label: 'Účet' }]}>
      <h1 className="text-[28px] font-semibold leading-tight text-text-primary">Účet</h1>

      <div className="mt-6">
        <SettingsLayout navGroups={SETTINGS_NAV_GROUPS}>
          <div className="max-w-[480px] space-y-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-text-primary">Jméno</span>
              <Input defaultValue="Jana Málková" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-text-primary">E-mail</span>
              <p className="text-[15px] text-text-secondary">jana.malkova@doprovazeni.cz</p>
            </label>

            <Button variant="secondary" size="sm">
              Uložit změny
            </Button>
          </div>
        </SettingsLayout>
      </div>
    </AppShell>
  )
}
