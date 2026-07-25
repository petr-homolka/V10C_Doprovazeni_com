import { useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { PageHeader } from '@/components/ui/page-header'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { updateNotifyBirthdays, updateNotifyNameDays } from '@/services/staffService'

/**
 * Nastavení / Kalendář (2026-07-24) — Petrovo přímé zadání: "musí
 * existovat speciální nastavení PRO KALENDÁŘE... možnost zobrazování
 * narozenin a jmenin vypnout". Dřív byl jediný společný přepínač na
 * `/nastaveni/oznameni` ("Narozeniny a svátky") — přesunuto sem jako
 * VLASTNÍ stránka a rozdělené na DVA nezávislé přepínače (narozeniny/
 * jmeniny zvlášť, ne jeden společný), protože se logicky týkají
 * Kalendáře (zdroj upozornění na Dnes stránce i mobilu), ne obecných
 * e-mailových Oznámení. Rychlý odkaz sem je i přímo na `CalendarPage.tsx`/
 * `MobileCalendarPage.tsx` (gear ikona) — nemá být schované jen za
 * obecným Nastavení menu.
 */
export default function CalendarSettingsPage() {
  const { userDoc } = useAuth()
  const [birthdayNotifications, setBirthdayNotifications] = useState(userDoc?.notifyBirthdays !== false)
  const [nameDayNotifications, setNameDayNotifications] = useState(userDoc?.notifyNameDays !== false)
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

  async function handleNameDayToggle(checked: boolean) {
    setNameDayNotifications(checked)
    setSaveError(null)
    if (!userDoc) return
    try {
      await updateNotifyNameDays(userDoc.uid, checked)
    } catch {
      setNameDayNotifications(!checked)
      setSaveError('Uložení se nezdařilo, zkuste to prosím znovu.')
    }
  }

  return (
    <AppShell
      secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}
    >
      <PageHeader title="Kalendář" variant="settings" />

      <section className="sp__card sp__card--pad">

      <div className="max-w-[560px]">
        <p className="text-sm font-medium text-text-primary">Narozeniny</p>
        <div className="mt-3 flex items-center justify-between gap-5">
          <span className="text-sm text-text-secondary">
            Upozornit v Provozních upozorněních na blížící se narozeniny dětí a pěstounů ve vaší péči.
          </span>
          <Switch checked={birthdayNotifications} onChange={handleBirthdayToggle} label="Narozeninová upozornění" />
        </div>

        <p className="mt-6 text-sm font-medium text-text-primary">Svátky (jmeniny)</p>
        <div className="mt-3 flex items-center justify-between gap-5">
          <span className="text-sm text-text-secondary">
            Upozornit v Provozních upozorněních na dnešní svátek dětí a pěstounů ve vaší péči.
          </span>
          <Switch checked={nameDayNotifications} onChange={handleNameDayToggle} label="Jmeninová upozornění" />
        </div>

        {saveError && (
          <p className="mt-2 text-xs text-danger" role="alert">
            {saveError}
          </p>
        )}
      </div>
      </section>
    </AppShell>
  )
}
