import { useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { TodaySampleSections } from '@/components/TodaySampleSections'
import { AuthContext } from '@/contexts/auth-context'
import { Tag } from '@/components/ui/tag'
import { Input } from '@/components/ui/input'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { ProgressBar } from '@/components/ui/progress-bar'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { Switch } from '@/components/ui/switch'
import { CopyableCodeBox } from '@/components/ui/copyable-code-box'
import { Button } from '@/components/ui/button'

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

const EDUCATION_ROWS = [
  { name: 'Petra Nováková', hours: 18, limit: 24 },
  { name: 'Marek Svoboda', hours: 24, limit: 24 },
  { name: 'Hana Dvořáková', hours: 6, limit: 18 },
]

/**
 * DOČASNÁ stránka pro vizuální review (§11 "vzorek před sweepem") —
 * NEPROCHÁZÍ RequireAuth, protože v tuhle chvíli neexistuje žádný fungující
 * backend (Auth emulátor na tomhle stroji nestartuje), přes který by šlo
 * ukázat reálně přihlášenou obrazovku. Sekce "Vzdělávání pěstounů" ukazuje
 * Table+ProgressBar na DESIGN_SYSTEM.md §6.5 vlastním příkladu (hodiny vs.
 * limit), ne na cizím Magnific obsahu. Smazat, jakmile M1 přinese reálná
 * data a přihlášení přes tenhle shell jde ověřit normální cestou (/login).
 */
export default function DesignPreviewPage() {
  const [tabValue, setTabValue] = useState<'tyden' | 'mesic' | 'rok'>('mesic')
  const [notifyOn, setNotifyOn] = useState(true)

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

        <section className="mt-8">
          <h2 className="text-[18px] font-semibold text-text-primary">
            Vzdělávání pěstounů — hodiny vs. limit
          </h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            DESIGN_SYSTEM.md §6.5 vlastní příklad na platné použití tabulky (sloupce se
            skutečně porovnávají) — nová Table + ProgressBar komponenta.
          </p>
          <div className="mt-3">
            <Table>
              <TableHeaderRow columns="1.5fr 1fr" labels={['Pěstoun', 'Hodiny']} />
              {EDUCATION_ROWS.map((row) => (
                <TableRow key={row.name} columns="1.5fr 1fr">
                  <span className="text-sm font-medium text-text-primary">{row.name}</span>
                  <div className="flex items-center gap-3">
                    <ProgressBar value={row.hours} max={row.limit} />
                    <span className="shrink-0 text-xs text-text-secondary">
                      {row.hours}/{row.limit} h
                    </span>
                  </div>
                </TableRow>
              ))}
            </Table>
          </div>
        </section>

        <section className="mt-8 flex flex-wrap gap-8">
          <div>
            <h2 className="text-[18px] font-semibold text-text-primary">Období přehledu</h2>
            <div className="mt-3">
              <SegmentedTabs
                value={tabValue}
                onChange={setTabValue}
                options={[
                  { value: 'tyden', label: 'Týden' },
                  { value: 'mesic', label: 'Měsíc' },
                  { value: 'rok', label: 'Rok' },
                ]}
              />
            </div>
          </div>

          <div>
            <h2 className="text-[18px] font-semibold text-text-primary">E-mail upozornění</h2>
            <div className="mt-3 flex items-center gap-2.5">
              <Switch checked={notifyOn} onChange={setNotifyOn} label="E-mail upozornění" />
              <span className="text-sm text-text-primary">{notifyOn ? 'Zapnuto' : 'Vypnuto'}</span>
            </div>
          </div>
        </section>

        <section className="mt-8 max-w-xl">
          <h2 className="text-[18px] font-semibold text-text-primary">Ověřovací odkaz dokumentu</h2>
          <p className="mt-1 text-[13px] text-text-secondary">§4.3 — QR kód na dokumentu vede sem.</p>
          <div className="mt-3">
            <CopyableCodeBox value="https://crm.doprovazeni.cz/d/2048270001233" />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[18px] font-semibold text-text-primary">Tlačítka</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary">Primární</Button>
            <Button variant="secondary">Sekundární</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destruktivní</Button>
          </div>
        </section>
      </AppShell>
    </AuthContext.Provider>
  )
}
