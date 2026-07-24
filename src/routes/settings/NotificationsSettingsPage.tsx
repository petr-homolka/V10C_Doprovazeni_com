import { useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { PageHeader } from '@/components/ui/page-header'
import { Switch } from '@/components/ui/switch'

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
 * infrastrukturu — SEAM). Narozeninový/jmeninový přepínač byl PŮVODNĚ tady
 * (2026-07-23), ale PŘESUNUT na vlastní `/nastaveni/kalendar`
 * (`CalendarSettingsPage.tsx`, 2026-07-24, Petrovo zadání "speciální
 * nastavení PRO KALENDÁŘE") — logicky patří ke Kalendáři, ne k obecným
 * e-mailovým Oznámením.
 */
export default function NotificationsSettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState(true)

  return (
    <AppShell
      breadcrumb={[{ label: 'Nastavení' }, { label: 'Oznámení' }]}
      secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}
    >
      <PageHeader title="Oznámení" variant="settings" />

      <div className="max-w-[560px]">
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
      </div>
    </AppShell>
  )
}
