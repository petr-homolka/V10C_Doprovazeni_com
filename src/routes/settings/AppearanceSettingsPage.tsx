import { useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsLayout } from '@/components/settings/SettingsLayout'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { useTheme } from '@/hooks/useTheme'

/**
 * Nastavení / Vzhled — první REÁLNÁ (ne jen /_preview) obrazovka postavená
 * na nové stránkové struktuře Nastavení (Dodatek 9). §5.6: appearance je
 * skutečně zapojené (useTheme, 3 stavy). fontScale/density jsou zatím jen
 * UI ukázka — škálování celé typografické stupnice / hustoty seznamů
 * přijde s M9.5, kdy se bude reálně aplikovat na zbytek appky.
 */
export default function AppearanceSettingsPage() {
  const { preference, setPreference } = useTheme()
  const [fontScale, setFontScale] = useState<'normal' | 'velky' | 'velmi_velky'>('normal')
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  return (
    <AppShell breadcrumb={[{ label: 'Nastavení' }, { label: 'Vzhled' }]}>
      <h1 className="text-[28px] font-semibold leading-tight text-text-primary">Vzhled</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Osobní předvolba — platí jen pro váš účet, nemění nic pro ostatní v organizaci.
      </p>

      <div className="mt-6">
        <SettingsLayout navGroups={SETTINGS_NAV_GROUPS}>
          <div className="max-w-[480px] space-y-6">
            <section>
              <p className="text-[15px] font-medium text-text-primary">Režim vzhledu</p>
              <p className="mt-0.5 text-[13px] text-text-secondary">
                Systémový respektuje nastavení vašeho zařízení nebo prohlížeče.
              </p>
              <div className="mt-3">
                <SegmentedTabs
                  value={preference}
                  onChange={setPreference}
                  options={[
                    { value: 'light', label: 'Světlý' },
                    { value: 'dark', label: 'Tmavý' },
                    { value: 'system', label: 'Systémový' },
                  ]}
                />
              </div>
            </section>

            <div className="border-t border-border-default" />

            <section>
              <p className="text-[15px] font-medium text-text-primary">Velikost textu</p>
              <p className="mt-0.5 text-[13px] text-text-secondary">
                Škáluje celou typografickou stupnici proporčně, ne jednotlivé úrovně zvlášť.
              </p>
              <div className="mt-3">
                <SegmentedTabs
                  value={fontScale}
                  onChange={setFontScale}
                  options={[
                    { value: 'normal', label: 'Normální' },
                    { value: 'velky', label: 'Velký' },
                    { value: 'velmi_velky', label: 'Velmi velký' },
                  ]}
                />
              </div>
            </section>

            <div className="border-t border-border-default" />

            <section>
              <p className="text-[15px] font-medium text-text-primary">Hustota seznamů</p>
              <div className="mt-3">
                <SegmentedTabs
                  value={density}
                  onChange={setDensity}
                  options={[
                    { value: 'comfortable', label: 'Komfortní' },
                    { value: 'compact', label: 'Kompaktní' },
                  ]}
                />
              </div>
            </section>
          </div>
        </SettingsLayout>
      </div>
    </AppShell>
  )
}
