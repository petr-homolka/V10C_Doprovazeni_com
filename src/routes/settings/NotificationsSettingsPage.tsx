import { useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { updateNotifyBirthdays } from '@/services/staffService'

/**
 * Nastavení / Oznámení — třetí REÁLNÁ stránka Nastavení (Dodatek 13).
 * Struktura a typografie přeměřena přímo na referenční "Notifications"
 * sekci: sub-label 14px/medium, popisek vedle Switch 14px/secondary,
 * drobný právní odstavec 12px/secondary s tučným --accent inline odkazem.
 * Obsah odstavce je VLASTNÍ text o e-mailových upozorněních tohoto
 * produktu (ne převzatý cizí text o zpracování dat pro reklamu/newsletter
 * — to by pro CRM pěstounské agentury nedávalo smysl a bylo by věcně
 * nepravdivé), jen typografický STYL je převzatý přesně.
 *
 * "E-mailová upozornění" zůstává jen lokální UI stav (appka nemá e-mail
 * infrastrukturu — SEAM). Narozeninový/jmeninový přepínač NÍŽE je oproti
 * tomu SKUTEČNĚ persistovaný (`UserDoc.notifyBirthdays`, 2026-07-23,
 * Petrovo zadání "vypnutelné v Nastavení") — řídí `listBirthdayAlerts`
 * volání v `TodaySections.tsx`/`MobileHomePage.tsx`.
 */
export default function NotificationsSettingsPage() {
  const { userDoc } = useAuth()
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [birthdayNotifications, setBirthdayNotifications] = useState(userDoc?.notifyBirthdays !== false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleBirthdayToggle(checked: boolean) {
    setBirthdayNotifications(checked)
    setSaveError(null)
    if (!userDoc) return
    try {
      await updateNotifyBirthdays(userDoc.uid, checked)
    } catch {
      setBirthdayNotifications(!checked)
      setSaveError('Uložení se nezdařilo, zkuste to prosím znovu.')
    }
  }

  return (
    <AppShell
      breadcrumb={[{ label: 'Nastavení' }, { label: 'Oznámení' }]}
      secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}
    >
      <h1 className="text-lg font-normal leading-normal text-text-primary">Oznámení</h1>

      <div className="mt-6 max-w-[560px]">
        <p className="text-sm font-medium text-text-primary">E-mailová upozornění</p>
        <div className="mb-4 mt-3 flex items-center justify-between gap-5">
          <span className="text-sm text-text-secondary">
            Dostávat e-mail při novém úkolu, komentáři nebo blížícím se termínu.
          </span>
          <Switch
            checked={emailNotifications}
            onChange={setEmailNotifications}
            label="E-mailová upozornění"
          />
        </div>
        <p className="text-xs text-text-secondary">
          Upozornění se řídí{' '}
          <a href="/pravni/zasady-ochrany-osobnich-udaju" className="font-bold text-accent">
            zásadami ochrany osobních údajů
          </a>
          . Vypnutím přepínače přestanete dostávat e-maily — systémová upozornění v appce zůstanou
          beze změny.
        </p>

        <p className="mt-6 text-sm font-medium text-text-primary">Narozeniny a svátky</p>
        <div className="mt-3 flex items-center justify-between gap-5">
          <span className="text-sm text-text-secondary">
            Upozornit v Provozních upozorněních na blížící se narozeniny a dnešní svátek dětí a
            pěstounů ve vaší péči.
          </span>
          <Switch
            checked={birthdayNotifications}
            onChange={handleBirthdayToggle}
            label="Narozeninová a jmeninová upozornění"
          />
        </div>
        {saveError && (
          <p className="mt-2 text-xs text-danger" role="alert">
            {saveError}
          </p>
        )}
      </div>
    </AppShell>
  )
}
