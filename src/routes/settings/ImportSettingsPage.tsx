import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { downloadBlob } from '@/lib/utils'
import { getOrganization } from '@/services/organizationService'
import {
  generateImportTemplate,
  parseImportTemplate,
  startImportJob,
  listImportJobs,
  listStagingRecords,
  confirmImportJob,
  commitImportJob,
  rollbackImportJob,
  type ParsedImportData,
} from '@/services/importService'
import type { ImportJobDoc, ImportJobStatus } from '@/types/importJob'
import type { StagingRecordDoc } from '@/types/stagingRecord'
import { FileSpreadsheet } from '@/components/ui/icons'

const STATUS_LABELS: Record<ImportJobStatus, string> = {
  staging: 'Zpracovává se',
  reviewing: 'Čeká na kontrolu',
  confirmed: 'Potvrzeno, připraveno ke spuštění',
  committed: 'Dokončeno',
  rolled_back: 'Vráceno zpět',
  failed: 'Selhalo',
}

const TABLE_COLUMNS = '1.2fr 1.6fr 1.6fr 1.6fr'

/**
 * /nastaveni/import — M1.5, §5.5 "staging → report → commit → undo",
 * cesta B (šablona). Jediná plně funkční cesta v tomhle buildu — viz
 * doc komentář v importJob.ts pro proč cesty A/C tady nejsou.
 *
 * Parsování souboru NEZAKLÁDÁ nic ve Firestore (čistě klient-side náhled)
 * — teprve "Založit import ke kontrole" vytvoří `importJobs` dokument.
 * Odtud je postup vždy explicitní a jednosměrný: reviewing → confirmed
 * (org_admin si mapování prohlédne a potvrdí) → committed (skutečně
 * založí entity) → volitelně rolled_back (30denní okno, §5.5).
 */
export default function ImportSettingsPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const isOrgAdmin = userDoc?.role === 'org_admin'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [jobs, setJobs] = useState<Array<{ docId: string; job: ImportJobDoc }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedImportData | null>(null)
  const [parsing, setParsing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [stagingRecords, setStagingRecords] = useState<
    Array<{ docId: string; record: StagingRecordDoc }> | null
  >(null)

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      setJobs(await listImportJobs(organizationId))
    } catch {
      setError('Historii importů se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function handleDownloadTemplate() {
    const blob = await generateImportTemplate()
    downloadBlob(blob, 'sablona-import.xlsx')
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setParsing(true)
    setError(null)
    setParsed(null)
    try {
      setParsed(await parseImportTemplate(file))
    } catch {
      setError('Soubor se nepodařilo přečíst — zkontrolujte, že jde o vyplněnou šablonu (.xlsx).')
    } finally {
      setParsing(false)
    }
  }

  async function handleStartJob() {
    if (!organizationId || !parsed || !userDoc) return
    setStarting(true)
    setError(null)
    try {
      await startImportJob(organizationId, 'template', parsed, userDoc.uid)
      setParsed(null)
      await reload()
    } catch {
      setError('Import se nepodařilo založit.')
    } finally {
      setStarting(false)
    }
  }

  async function handleToggleExpand(jobId: string) {
    if (expandedJobId === jobId) {
      setExpandedJobId(null)
      setStagingRecords(null)
      return
    }
    setExpandedJobId(jobId)
    setStagingRecords(null)
    if (!organizationId) return
    try {
      setStagingRecords(await listStagingRecords(organizationId, jobId))
    } catch {
      setError('Záznamy se nepodařilo načíst.')
    }
  }

  async function handleConfirm(jobId: string) {
    if (!organizationId) return
    setBusyJobId(jobId)
    setError(null)
    try {
      await confirmImportJob(organizationId, jobId)
      await reload()
    } catch {
      setError('Potvrzení mapování se nezdařilo.')
    } finally {
      setBusyJobId(null)
    }
  }

  async function handleCommit(jobId: string) {
    if (!organizationId) return
    setBusyJobId(jobId)
    setError(null)
    try {
      const org = await getOrganization(organizationId)
      if (!org) throw new Error('org not found')
      await commitImportJob(organizationId, org.orgCode, jobId)
      await reload()
    } catch {
      setError('Spuštění importu se nezdařilo.')
    } finally {
      setBusyJobId(null)
    }
  }

  async function handleRollback(jobId: string) {
    if (!organizationId) return
    setBusyJobId(jobId)
    setError(null)
    try {
      await rollbackImportJob(organizationId, jobId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vrácení zpět se nezdařilo.')
    } finally {
      setBusyJobId(null)
    }
  }

  if (!organizationId) {
    return (
      <AppShell>
        <PageHeader title="Import dat" variant="settings" />
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
        title="Import dat"
        description="Hromadné nahrání rodin, pěstounů, dětí a Dohod ze souboru. Nahrání a náhled nic nezaloží — až po výslovném potvrzení a spuštění, a i pak jde do 30 dnů celé vrátit zpět."
        variant="settings"
      />

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {isOrgAdmin && (
        <div className="mt-6 max-w-[560px] space-y-4 rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
              Stáhnout šablonu (.xlsx)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
            >
              {parsing ? 'Zpracovávám…' : 'Nahrát vyplněný soubor'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {parsed && (
            <div className="space-y-3 rounded-md border border-border-subtle bg-inset p-4">
              <p className="text-sm font-medium text-text-primary">Náhled před spuštěním</p>
              <p className="text-sm text-text-secondary">
                Čistých řádků: {parsed.summary.fostersDetected} pěstounů,{' '}
                {parsed.summary.childrenDetected} dětí, {parsed.summary.agreementsDetected} Dohod.
              </p>
              {parsed.summary.warnings.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-text-secondary">
                  {parsed.summary.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              {parsed.summary.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-danger">
                    {parsed.summary.errors.length} řádků se přeskočí (chyba):
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-danger">
                    {parsed.summary.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" disabled={starting} onClick={handleStartJob}>
                  {starting ? 'Zakládám…' : 'Založit import ke kontrole'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setParsed(null)}>
                  Zahodit náhled
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-medium text-text-primary">Historie importů</h2>
        <div className="mt-3">
          {jobs === null ? (
            <p className="text-sm text-text-secondary">Načítám…</p>
          ) : jobs.length === 0 ? (
            <EmptyState icon={FileSpreadsheet} text="Zatím žádný import." />
          ) : (
            <Table>
              <TableHeaderRow columns={TABLE_COLUMNS} labels={['Založeno', 'Stav', 'Souhrn', '']} />
              {jobs.map(({ docId, job }) => {
                const canRollback =
                  job.status === 'committed' &&
                  !!job.rollbackDeadline &&
                  new Date() <= new Date(job.rollbackDeadline)
                return (
                  <div key={docId} className="contents">
                    <TableRow columns={TABLE_COLUMNS}>
                      <span className="text-sm text-text-secondary">
                        {new Date(job.createdAt).toLocaleString('cs-CZ')}
                      </span>
                      <span className="text-sm text-text-primary">{STATUS_LABELS[job.status]}</span>
                      <span className="text-sm text-text-secondary">
                        {job.summary
                          ? `${job.summary.fostersDetected} pěstounů, ${job.summary.childrenDetected} dětí, ${job.summary.agreementsDetected} Dohod`
                          : '—'}
                      </span>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleToggleExpand(docId)}>
                          {expandedJobId === docId ? 'Skrýt' : 'Detail'}
                        </Button>
                        {isOrgAdmin && job.status === 'reviewing' && (
                          <Button size="sm" disabled={busyJobId === docId} onClick={() => handleConfirm(docId)}>
                            Potvrdit
                          </Button>
                        )}
                        {isOrgAdmin && job.status === 'confirmed' && (
                          <Button size="sm" disabled={busyJobId === docId} onClick={() => handleCommit(docId)}>
                            Spustit
                          </Button>
                        )}
                        {isOrgAdmin && canRollback && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={busyJobId === docId}
                            onClick={() => handleRollback(docId)}
                          >
                            Vrátit zpět
                          </Button>
                        )}
                      </div>
                    </TableRow>
                    {expandedJobId === docId && (
                      <div className="border-b border-border-strong bg-inset px-4 py-3 last:border-b-0">
                        {stagingRecords === null ? (
                          <p className="text-xs text-text-secondary">Načítám záznamy…</p>
                        ) : (
                          <p className="text-xs text-text-secondary">
                            {stagingRecords.length} nahraných řádků celkem (čistých:{' '}
                            {stagingRecords.filter((r) => r.record.issues.length === 0).length}).
                          </p>
                        )}
                        {job.summary && job.summary.errors.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-danger">Přeskočené řádky:</p>
                            <ul className="list-disc space-y-0.5 pl-5 text-xs text-danger">
                              {job.summary.errors.map((e) => (
                                <li key={e}>{e}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {job.status === 'committed' && job.rollbackDeadline && (
                          <p className="mt-2 text-xs text-text-secondary">
                            {canRollback
                              ? `Vrátit zpět lze do ${new Date(job.rollbackDeadline).toLocaleDateString('cs-CZ')}.`
                              : 'Okno na vrácení zpět už vypršelo.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </Table>
          )}
        </div>
      </div>
    </AppShell>
  )
}
