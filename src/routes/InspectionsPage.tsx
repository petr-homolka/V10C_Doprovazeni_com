import { useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import {
  createInspection,
  findOverdueCorrectiveActions,
  listInspections,
  markCorrectiveActionCompleted,
} from '@/services/inspectionService'
import type { InspectionDoc, InspectionFinding, QualityStandardRef } from '@/types/inspection'
import { ClipboardCheck } from 'lucide-react'

const STANDARD_REF_LABELS: Record<QualityStandardRef, string> = { priloha_2: 'Příloha 2', priloha_4: 'Příloha 4' }
const SCORE_LABELS: Record<InspectionFinding['score'], string> = {
  0: '0 – Nesplněno',
  1: '1 – Částečně',
  2: '2 – Dobře',
  3: '3 – Výborně',
}
const SELECT_CLASSNAME = 'h-10 w-full rounded-sm border border-border-medium bg-inset px-3 text-text-primary'

interface FindingDraft {
  criterionCode: string
  score: InspectionFinding['score']
  deficiencyNote: string
  correctiveAction: string
  correctiveDeadline: string
}

function emptyFindingDraft(): FindingDraft {
  return { criterionCode: '', score: 3, deficiencyNote: '', correctiveAction: '', correctiveDeadline: '' }
}

/**
 * /kvalita — M7 §B.6, jen evidence inspekcí (sebehodnocení je SEAM, čeká
 * na M12 checklist engine — viz inspectionService.ts komentář).
 * `scorePercentage` se zobrazuje BEZ vlastní interpretace vyhovuje/
 * nevyhovuje — zadání samo přiznává, že práh nemá k dispozici.
 */
export default function InspectionsPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [inspections, setInspections] = useState<Array<{ docId: string; inspection: InspectionDoc }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [inspectionDateFrom, setInspectionDateFrom] = useState('')
  const [inspectionDateTo, setInspectionDateTo] = useState('')
  const [inspectingAuthorityName, setInspectingAuthorityName] = useState('')
  const [subject, setSubject] = useState('')
  const [standardRef, setStandardRef] = useState<QualityStandardRef>('priloha_2')
  const [findingDrafts, setFindingDrafts] = useState<FindingDraft[]>([emptyFindingDraft()])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      setInspections(await listInspections(organizationId))
    } catch {
      setError('Inspekce se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  function updateFindingDraft(index: number, patch: Partial<FindingDraft>) {
    setFindingDrafts((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const findings: InspectionFinding[] = findingDrafts
      .filter((f) => f.criterionCode.trim() !== '')
      .map((f) => ({
        criterionCode: f.criterionCode.trim(),
        score: f.score,
        deficiencyNote: f.deficiencyNote || undefined,
        correctiveAction: f.correctiveAction || undefined,
        correctiveDeadline: f.correctiveDeadline ? new Date(f.correctiveDeadline).toISOString() : null,
      }))
    if (findings.length === 0) {
      setFormError('Zadejte aspoň jedno kritérium.')
      return
    }
    if (!organizationId) return
    setSubmitting(true)
    try {
      await createInspection(
        organizationId,
        {
          inspectionDateFrom: new Date(inspectionDateFrom).toISOString(),
          inspectionDateTo: new Date(inspectionDateTo).toISOString(),
          inspectingAuthorityName,
          subject,
          standardRef,
          findings,
          resultDocumentRef: null,
          createdBy: userDoc!.uid,
        },
        userDoc!.uid,
      )
      setShowForm(false)
      setInspectionDateFrom('')
      setInspectionDateTo('')
      setInspectingAuthorityName('')
      setSubject('')
      setStandardRef('priloha_2')
      setFindingDrafts([emptyFindingDraft()])
      await reload()
    } catch {
      setFormError('Zaznamenání inspekce se nezdařilo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkCompleted(docId: string, inspection: InspectionDoc, criterionCode: string) {
    setActionError(null)
    try {
      const updated = inspection.findings.map((f) =>
        f.criterionCode === criterionCode ? { ...f, correctiveCompletedAt: new Date().toISOString() } : f,
      )
      await markCorrectiveActionCompleted(organizationId!, docId, criterionCode, updated)
      await reload()
    } catch {
      setActionError('Uložení nápravného opatření se nezdařilo.')
    }
  }

  if (!organizationId) {
    return (
      <AppShell breadcrumb={[{ label: 'Kvalita' }]}>
        <h1 className="text-lg font-normal leading-normal text-text-primary">Kvalita</h1>
        <p className="mt-4 text-sm text-text-secondary">Tahle stránka je pro zaměstnance konkrétní organizace.</p>
      </AppShell>
    )
  }

  const overdueActions = inspections ? findOverdueCorrectiveActions(inspections) : []

  return (
    <AppShell breadcrumb={[{ label: 'Kvalita' }]}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-normal leading-normal text-text-primary">Kvalita — evidence inspekcí</h1>
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Zrušit' : '+ Zaznamenat inspekci'}
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {overdueActions.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {overdueActions.map((a) => (
            <div
              key={`${a.docId}-${a.criterionCode}`}
              className={`rounded-lg px-3 py-2 text-sm ${a.overdue ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'}`}
            >
              Nápravné opatření {a.criterionCode}: {a.overdue ? 'po termínu' : 'termín se blíží'} (
              {new Date(a.correctiveDeadline).toLocaleDateString('cs-CZ')})
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Datum od
              <Input type="date" required value={inspectionDateFrom} onChange={(e) => setInspectionDateFrom(e.target.value)} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Datum do
              <Input type="date" required value={inspectionDateTo} onChange={(e) => setInspectionDateTo(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Kontrolující orgán
            <Input required value={inspectingAuthorityName} onChange={(e) => setInspectingAuthorityName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Předmět kontroly
            <Input required value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Standard
            <select value={standardRef} onChange={(e) => setStandardRef(e.target.value as QualityStandardRef)} className={SELECT_CLASSNAME}>
              <option value="priloha_2">Příloha 2</option>
              <option value="priloha_4">Příloha 4</option>
            </select>
          </label>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium leading-relaxed text-text-primary">Kritéria</p>
            {findingDrafts.map((draft, idx) => (
              <div key={idx} className="flex flex-col gap-2 rounded-md border border-border-subtle p-3">
                <div className="flex gap-3">
                  <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
                    Kód kritéria
                    <Input value={draft.criterionCode} onChange={(e) => updateFindingDraft(idx, { criterionCode: e.target.value })} />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
                    Skóre
                    <select
                      value={draft.score}
                      onChange={(e) => updateFindingDraft(idx, { score: Number(e.target.value) as InspectionFinding['score'] })}
                      className={SELECT_CLASSNAME}
                    >
                      {([0, 1, 2, 3] as const).map((s) => (
                        <option key={s} value={s}>
                          {SCORE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-sm text-text-secondary">
                  Nedostatek (volitelné)
                  <Input value={draft.deficiencyNote} onChange={(e) => updateFindingDraft(idx, { deficiencyNote: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-sm text-text-secondary">
                  Nápravné opatření (volitelné)
                  <Input value={draft.correctiveAction} onChange={(e) => updateFindingDraft(idx, { correctiveAction: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-sm text-text-secondary">
                  Termín nápravy (volitelné)
                  <Input
                    type="date"
                    value={draft.correctiveDeadline}
                    onChange={(e) => updateFindingDraft(idx, { correctiveDeadline: e.target.value })}
                  />
                </label>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setFindingDrafts((prev) => [...prev, emptyFindingDraft()])}>
              + Přidat kritérium
            </Button>
          </div>

          {formError && (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Ukládám…' : 'Uložit inspekci'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>
              Zrušit
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4">
        {inspections === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : inspections.length === 0 ? (
          <EmptyState icon={ClipboardCheck} text="Zatím žádná inspekce." />
        ) : (
          <div className="flex flex-col gap-3">
            {actionError && (
              <p className="text-sm text-danger" role="alert">
                {actionError}
              </p>
            )}
            {inspections.map(({ docId, inspection }) => (
              <div key={docId} className="rounded-lg border border-border-subtle bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-primary">
                      {new Date(inspection.inspectionDateFrom).toLocaleDateString('cs-CZ')} –{' '}
                      {new Date(inspection.inspectionDateTo).toLocaleDateString('cs-CZ')} · {inspection.inspectingAuthorityName}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {inspection.subject} · {STANDARD_REF_LABELS[inspection.standardRef]}
                    </p>
                  </div>
                  <p className="text-sm text-text-primary">
                    {inspection.totalScore}/{inspection.maxPossibleScore} ({Math.round(inspection.scorePercentage * 100)} %)
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {inspection.findings.map((f) => (
                    <div key={f.criterionCode} className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-soft px-3 py-2">
                      <div>
                        <p className="text-sm text-text-primary">
                          {f.criterionCode} — {SCORE_LABELS[f.score]}
                        </p>
                        {f.deficiencyNote && <p className="text-xs text-text-secondary">{f.deficiencyNote}</p>}
                        {f.correctiveDeadline && (
                          <p className="text-xs text-text-secondary">
                            Náprava do: {new Date(f.correctiveDeadline).toLocaleDateString('cs-CZ')}
                            {f.correctiveCompletedAt ? ' (dokončeno)' : ''}
                          </p>
                        )}
                      </div>
                      {f.correctiveDeadline && !f.correctiveCompletedAt && (
                        <Button variant="secondary" size="sm" onClick={() => handleMarkCompleted(docId, inspection, f.criterionCode)}>
                          Označit jako dokončeno
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
