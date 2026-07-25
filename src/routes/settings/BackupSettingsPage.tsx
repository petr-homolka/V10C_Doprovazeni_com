import { useEffect, useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { downloadBlob } from '@/lib/utils'
import { exportOrganizationDataToBlob } from '@/services/exportService'
import {
  getBackupConfig,
  saveBackupConfig,
  listBackupJobs,
  runManualBackup,
} from '@/services/backupService'
import type { BackupConfigDoc, BackupDestinationType, BackupJobDoc, BackupJobStatus } from '@/types/backup'
import { ShieldCheck } from '@/components/ui/icons'

const DEFAULT_CONFIG: BackupConfigDoc = {
  schedule: { enabled: false, dayOfWeek: 'ne', time: '02:00' },
  destination: { type: 'download' },
  encryption: { method: 'AES-256', keyOwnership: 'organizace' },
}

const DAY_LABELS: Record<string, string> = {
  po: 'Pondělí',
  ut: 'Úterý',
  st: 'Středa',
  ct: 'Čtvrtek',
  pa: 'Pátek',
  so: 'Sobota',
  ne: 'Neděle',
}

const DESTINATION_LABELS: Record<BackupDestinationType, string> = {
  download: 'Stažení do počítače',
  gdrive: 'Google Drive',
  onedrive: 'OneDrive',
  ftp: 'FTP server',
}

const JOB_STATUS_LABELS: Record<BackupJobStatus, string> = {
  queued: 'Čeká',
  running: 'Probíhá',
  completed: 'Dokončeno',
  failed: 'Selhalo',
}

const TABLE_COLUMNS = '1.4fr 1fr 1fr 1fr'

/**
 * /nastaveni/zalohy — M1.5, §5.5 "vrstva 2" (self-service). Jediná plně
 * funkční cesta je "Zálohovat teď" s cílem "Stažení do počítače" — viz
 * doc komentář v backupService.ts. Zbytek (naplánovaná záloha, cloudové
 * cíle) se dá tady nastavit a uloží se, ale nic sám od sebe nespustí ani
 * nedoručí — na tohle appka záměrně upozorňuje přímo v UI, ne jen v kódu
 * (§5 "poctivost nadevše" — nikdy netvrdit, že něco funguje, když nefunguje).
 */
export default function BackupSettingsPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const isOrgAdmin = userDoc?.role === 'org_admin'

  const [config, setConfig] = useState<BackupConfigDoc>(DEFAULT_CONFIG)
  const [savingConfig, setSavingConfig] = useState(false)
  const [jobs, setJobs] = useState<Array<{ docId: string; job: BackupJobDoc }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [running, setRunning] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      const [savedConfig, savedJobs] = await Promise.all([
        getBackupConfig(organizationId),
        listBackupJobs(organizationId),
      ])
      if (savedConfig) setConfig(savedConfig)
      setJobs(savedJobs)
    } catch {
      setError('Nastavení a historii záloh se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function handleSaveConfig() {
    if (!organizationId) return
    setSavingConfig(true)
    setError(null)
    setNotice(null)
    try {
      await saveBackupConfig(organizationId, config)
      setNotice('Nastavení uloženo.')
    } catch {
      setError('Nastavení se nepodařilo uložit.')
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleRunBackup() {
    if (!organizationId || !password) return
    setRunning(true)
    setError(null)
    setNotice(null)
    try {
      const { blob, filename } = await runManualBackup(organizationId, password)
      downloadBlob(blob, filename)
      setPassword('')
      setNotice('Záloha stažena. Heslo je potřeba i k obnovení — systém si ho nikde neukládá.')
      await reload()
    } catch {
      setError('Zálohu se nepodařilo vytvořit.')
    } finally {
      setRunning(false)
    }
  }

  async function handleExportAll() {
    if (!organizationId) return
    setExporting(true)
    setError(null)
    try {
      const { blob, filename } = await exportOrganizationDataToBlob(organizationId)
      downloadBlob(blob, filename)
    } catch {
      setError('Export se nepodařilo vytvořit.')
    } finally {
      setExporting(false)
    }
  }

  if (!organizationId) {
    return (
      <AppShell>
        <PageHeader title="Zálohy" variant="settings" />
        <p className="mt-4 text-sm text-text-secondary">
          Tahle stránka je pro zaměstnance konkrétní organizace.
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell
      secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}
    >
      <PageHeader
        title="Zálohy a export"
        description="Data organizace nejsou uzamčená u dodavatele — export i záloha jsou vždy k dispozici."
        variant="settings"
      />

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="mt-3 text-sm text-success">{notice}</p>}

      <div className="max-w-[560px] space-y-6">
        <section className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm font-medium text-text-primary">Export všech dat organizace</p>
          <p className="mt-1 text-sm text-text-secondary">
            Nešifrovaná .xlsx tabulka rodin, pěstounů, dětí a Dohod — pro vlastní evidenci nebo
            přechod na jiný systém.
          </p>
          <Button className="mt-3" variant="secondary" size="sm" disabled={exporting} onClick={handleExportAll}>
            {exporting ? 'Exportuji…' : 'Exportovat všechna data organizace'}
          </Button>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm font-medium text-text-primary">Zálohovat teď</p>
          <p className="mt-1 text-sm text-text-secondary">
            Záloha se zašifruje heslem, které zadáte — systém si ho NEUKLÁDÁ. Bez něj nejde záloha
            později otevřít, takže si ho bezpečně uložte mimo appku.
          </p>
          {isOrgAdmin ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">
                  Heslo zálohy
                </span>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-[220px]"
                />
              </label>
              <Button disabled={running || !password} onClick={handleRunBackup}>
                {running ? 'Zálohuji…' : 'Zálohovat a stáhnout'}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-tertiary">Spustit zálohu smí jen správce organizace.</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm font-medium text-text-primary">Naplánovaná záloha</p>
          <p className="mt-1 text-sm text-text-secondary">
            Nastavení se uloží, ale sama se zatím nespustí — potřebuje naplánovanou úlohu na
            serveru, kterou tenhle systém zatím nemá zapojenou. Používejte prozatím "Zálohovat teď".
          </p>

          <div className="mt-3 flex items-center justify-between gap-5">
            <span className="text-sm text-text-secondary">Automaticky zálohovat každý týden</span>
            <Switch
              checked={config.schedule.enabled}
              onChange={(enabled) => setConfig((c) => ({ ...c, schedule: { ...c.schedule, enabled } }))}
              label="Automatická záloha"
            />
          </div>

          {config.schedule.enabled && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Den v týdnu</span>
                <Select
                  value={config.schedule.dayOfWeek ?? 'ne'}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, schedule: { ...c.schedule, dayOfWeek: e.target.value } }))
                  }
                >
                  {Object.entries(DAY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Čas</span>
                <Input
                  type="time"
                  value={config.schedule.time ?? '02:00'}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, schedule: { ...c.schedule, time: e.target.value } }))
                  }
                />
              </label>
            </div>
          )}

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Kam ukládat</span>
            <Select
              value={config.destination.type}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  destination: { ...c.destination, type: e.target.value as BackupDestinationType },
                }))
              }
            >
              {Object.entries(DESTINATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          {config.destination.type !== 'download' && (
            <p className="mt-1 text-xs text-text-tertiary">
              Tenhle cíl se dá zatím jen nastavit — skutečné doručení tam appka ještě neumí.
            </p>
          )}

          {isOrgAdmin && (
            <Button className="mt-4" variant="secondary" size="sm" disabled={savingConfig} onClick={handleSaveConfig}>
              {savingConfig ? 'Ukládám…' : 'Uložit nastavení'}
            </Button>
          )}
        </section>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-text-primary">Historie záloh</h2>
        <div className="mt-3">
          {jobs === null ? (
            <p className="text-sm text-text-secondary">Načítám…</p>
          ) : jobs.length === 0 ? (
            <EmptyState icon={ShieldCheck} text="Zatím žádná záloha." />
          ) : (
            <Table>
              <TableHeaderRow columns={TABLE_COLUMNS} labels={['Vyžádáno', 'Spuštění', 'Stav', 'Cíl']} />
              {jobs.map(({ docId, job }) => (
                <TableRow key={docId} columns={TABLE_COLUMNS}>
                  <span className="text-sm text-text-secondary">
                    {new Date(job.requestedAt).toLocaleString('cs-CZ')}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {job.triggeredBy === 'manual' ? 'Ručně' : 'Podle plánu'}
                  </span>
                  <span
                    className={
                      job.status === 'failed'
                        ? 'text-sm text-danger'
                        : job.status === 'completed'
                          ? 'text-sm text-success'
                          : 'text-sm text-text-primary'
                    }
                  >
                    {JOB_STATUS_LABELS[job.status]}
                    {job.status === 'failed' && job.error ? ` — ${job.error}` : ''}
                  </span>
                  <span className="text-sm text-text-secondary">{DESTINATION_LABELS[job.destinationType]}</span>
                </TableRow>
              ))}
            </Table>
          )}
        </div>
      </div>
    </AppShell>
  )
}
