import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { PageHead } from '@/components/spis/PageBody'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { listAuditEntries } from '@/services/auditLogService'
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  type AuditCategory,
  type AuditEntryDoc,
} from '@/types/auditLog'
import { isReadOnlyManagerRole } from '@/types/user'
import { ShieldCheck } from '@/components/ui/icons'

/**
 * /nastaveni/audit — čtení auditní stopy.
 *
 * Stránka je záměrně nudná: seznam, filtr, žádná akce. Auditní log je
 * jediné místo v aplikaci, kde se nedá NIC dělat — ani mazat, ani
 * opravovat (viz firestore.rules). Kdyby tu bylo tlačítko, log by ztratil
 * smysl.
 *
 * Filtr je po KATEGORIÍCH, ne po jednotlivých akcích: otázka při kontrole
 * zní „co odešlo ven z organizace" nebo „kdo dostal přístup", ne
 * „vypiš mi akce typu external_grant_activated".
 */
export default function AuditLogPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const canRead =
    userDoc?.role === 'superadmin' ||
    userDoc?.role === 'org_admin' ||
    (userDoc?.role !== undefined && isReadOnlyManagerRole(userDoc.role))

  const [entries, setEntries] = useState<Array<{ docId: string; entry: AuditEntryDoc }> | null>(null)
  const [category, setCategory] = useState<AuditCategory | ''>('')
  const [days, setDays] = useState('90')
  const [error, setError] = useState<string | null>(null)

  const from = useMemo(() => {
    if (days === 'vse') return undefined
    const d = new Date()
    d.setDate(d.getDate() - Number(days))
    return d.toISOString()
  }, [days])

  useEffect(() => {
    if (!organizationId || !canRead) return
    setError(null)
    setEntries(null)
    listAuditEntries(organizationId, { category: category || undefined, from })
      .then(setEntries)
      .catch(() => {
        setError('Auditní záznamy se nepodařilo načíst.')
        // Bez tohohle by pod chybou svítilo „Načítám…" navěky — `entries`
        // by zůstalo `null`, což je stav „ještě nevím", ne „nepovedlo se".
        setEntries([])
      })
  }, [organizationId, canRead, category, from])

  if (!organizationId || !canRead) {
    return (
      <AppShell secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}>
        <PageHead title="Auditní stopa" />
        <section className="sp__card sp__card--pad">
          <p className="text-sm text-text-secondary">
            Auditní stopu vidí vedení a správce organizace. Je to nástroj kontroly nad prací s údaji,
            ne pracovní pomůcka — proto k ní nemají přístup všichni.
          </p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}>
      <PageHead
        title="Auditní stopa"
        description="Kdo komu zpřístupnil údaje, co odešlo z organizace a kdo hýbal se spisy. Záznamy nejde změnit ani smazat."
        count={entries?.length}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-text-tertiary">Co</span>
            <Select value={category} onChange={(e) => setCategory(e.target.value as AuditCategory | '')}>
              <option value="">Vše</option>
              {Object.entries(AUDIT_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-text-tertiary">Období</span>
            <Select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="30">Posledních 30 dnů</option>
              <option value="90">Posledních 90 dnů</option>
              <option value="365">Poslední rok</option>
              <option value="vse">Vše</option>
            </Select>
          </label>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </PageHead>

      <section className="sp__card sp__card--pad">
        {entries === null ? (
          <p className="text-sm text-text-tertiary">Načítám…</p>
        ) : entries.length === 0 ? (
          <EmptyState icon={ShieldCheck} text="V tomhle období nic zaznamenaného není." />
        ) : (
          <div className="flex flex-col">
            {entries.map(({ docId, entry }) => (
              <article key={docId} className="border-b border-border-subtle py-3 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm text-text-primary">{AUDIT_ACTIONS[entry.action] ?? entry.action}</p>
                  <p className="text-xs text-text-faint">
                    {new Date(entry.at).toLocaleString('cs-CZ')}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-text-tertiary">
                  {entry.actorName}
                  {entry.subject && <> · {entry.subject.label}</>}
                  {entry.target && <> · {entry.target.label}</>}
                </p>
                {entry.detail && <p className="mt-0.5 text-sm text-text-secondary">{entry.detail}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  )
}
