import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/**
 * Nastavení / Účet — druhá REÁLNÁ stránka nové struktury Nastavení
 * (Dodatek 9). E-mail jako prostý text, ne input (naměřeno na referenční
 * Profil stránce, Dodatek 8) — e-mail je identita přihlášení, needituje
 * se tady stejnou cestou jako jméno. `secondaryPanel` (Dodatek 12) dělá
 * z nav sloupce samostatný panel vedle obsahu, ne vnořenou kartu uvnitř.
 * Nadpis, labely a e-mailová hodnota přeměřeny znovu 2026-07-19 (Dodatek 13):
 * nadpis 18px/normal (ne 28px/semibold), labely 14px/medium/leading-relaxed,
 * e-mailová hodnota bez vlastní velikosti (dědí 15px z body) a --text-primary
 * (naměřeno rgb(227,227,227), blíž primary než secondary tónu).
 */
export default function AccountSettingsPage() {
  return (
    <AppShell
      secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}
    >
      <PageHeader title="Účet" variant="settings" />

      <section className="sp__card sp__card--pad">

      <div className="max-w-[560px] space-y-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
          <Input defaultValue="Jana Málková" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium leading-relaxed text-text-primary">E-mail</span>
          <p className="flex h-10 items-center text-text-primary">jana.malkova@doprovazeni.cz</p>
        </label>

        <Button variant="secondary" size="sm">
          Uložit změny
        </Button>
      </div>
      </section>
    </AppShell>
  )
}
