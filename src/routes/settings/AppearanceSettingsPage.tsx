import { useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { useTheme } from '@/hooks/useTheme'

/**
 * Nastavení / Vzhled — první REÁLNÁ (ne jen /_preview) obrazovka postavená
 * na nové stránkové struktuře Nastavení (Dodatek 9). §5.6: appearance je
 * skutečně zapojené (useTheme, 3 stavy). fontScale/density jsou zatím jen
 * UI ukázka — škálování celé typografické stupnice / hustoty seznamů
 * přijde s M9.5, kdy se bude reálně aplikovat na zbytek appky.
 * `secondaryPanel` (Dodatek 12) dělá z nav sloupce samostatný panel vedle
 * obsahu, ne vnořenou kartu uvnitř. Typografie přeměřena znovu 2026-07-19
 * (Dodatek 13): nadpis 18px/normal (ne 28px/semibold), popisek pod
 * nadpisem a pod každou sekcí 14px/secondary (ne 13px), sekční labely
 * ("Režim vzhledu" apod.) 14px/medium (ne 15px) — stejná velikost/váha
 * jako labely na Účtu, jde o stejnou roli (field-label), ne nadpis.
 */
export default function AppearanceSettingsPage() {
  const { preference, setPreference } = useTheme()
  const [fontScale, setFontScale] = useState<'normal' | 'velky' | 'velmi_velky'>('normal')
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  return (
    <AppShell
      breadcrumb={[{ label: 'Nastavení' }, { label: 'Vzhled' }]}
      secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}
    >
      <h1 className="text-lg font-normal leading-normal text-text-primary">Vzhled</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Osobní předvolba — platí jen pro váš účet, nemění nic pro ostatní v organizaci.
      </p>

      <div className="mt-6 max-w-[480px] space-y-6">
        <section>
          <p className="text-sm font-medium text-text-primary">Režim vzhledu</p>
          <p className="mt-0.5 text-sm text-text-secondary">
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
          <p className="text-sm font-medium text-text-primary">Velikost textu</p>
          <p className="mt-0.5 text-sm text-text-secondary">
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
          <p className="text-sm font-medium text-text-primary">Hustota seznamů</p>
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
    </AppShell>
  )
}
