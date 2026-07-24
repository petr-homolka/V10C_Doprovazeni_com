import type { SettingsNavGroup } from './SettingsNav'

/**
 * ZADANI §5.7 matice viditelnosti — tohle je pohled org_admina (vidí obojí
 * skupinu). Skutečné role-aware filtrování (skrytá záložka se nerenderuje
 * vůbec, ne needitovatelná) je funkční záležitost M9.5 — tady je jen
 * ukázka struktury dvouúrovňového menu pro vizuální review.
 */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    label: 'Obecné',
    items: [
      { to: '/nastaveni/ucet', label: 'Účet' },
      { to: '/nastaveni/vzhled', label: 'Vzhled' },
      { to: '/nastaveni/oznameni', label: 'Oznámení' },
      { to: '/nastaveni/kalendar', label: 'Kalendář' },
    ],
  },
  {
    label: 'Organizace',
    items: [
      { to: '/nastaveni/organizace', label: 'Organizace' },
      { to: '/nastaveni/sablony-dokumentu', label: 'Šablony dokumentů' },
      { to: '/nastaveni/nazvoslovi', label: 'Vlastní názvosloví' },
      { to: '/nastaveni/externi-pristup', label: 'Externí přístup — šablony' },
      { to: '/nastaveni/zalohy', label: 'Zálohy' },
      { to: '/nastaveni/import', label: 'Import dat' },
    ],
  },
]
