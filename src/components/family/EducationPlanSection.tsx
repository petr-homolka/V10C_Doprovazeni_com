import { useEffect, useState, type FormEvent } from 'react'
import { GraduationCap, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import {
  activateEducationPlan,
  approveEducationPlan,
  closeEducationPlan,
  createEducationPlan,
  fosterConfirmEducationPlan,
  listEducationPlans,
  rejectEducationPlan,
  sendEducationPlanToManagement,
} from '@/services/educationPlanService'
import type { EducationPlanDoc, EducationPlanItem, EducationPlanStatus } from '@/types/educationPlan'
import { EDUCATION_TOPIC_CATEGORIES } from '@/types/legislativeParameter'

export interface EducationPlanSectionProps {
  fosterPersonId: string
  fosterPersonName: string
  organizationId: string
  agreementId: string // = organizationId by convention (deterministic Agreement ID), pass as-is to agreementRef
  currentUid: string
  children: Array<{ docId: string; child: { firstName: string; lastName: string } }> // for the optional per-item childRef picker
}

const STATUS_LABELS: Record<EducationPlanStatus, string> = {
  navrzeno: 'Navrženo',
  ke_schvaleni_vedeni: 'Čeká na schválení vedením',
  schvaleno_vedenim: 'Schváleno vedením',
  potvrzeno_pestounem: 'Potvrzeno pěstounem',
  aktivni: 'Aktivní',
  uzavreno: 'Uzavřeno',
  zamitnuto: 'Zamítnuto',
}

const ITEM_STATUS_LABELS: Record<EducationPlanItem['status'], string> = {
  planovano: 'Plánováno',
  objednano: 'Objednáno',
  absolvovano: 'Absolvováno',
  zruseno: 'Zrušeno',
}

const CATEGORY_LABEL_BY_CODE = new Map(EDUCATION_TOPIC_CATEGORIES.map((c) => [c.code as string, c.label]))

interface ItemRow {
  id: string
  categoryCode: string
  topicName: string
  needReason: string
  childRef: string
  plannedHours: string
  estimatedCost: string
}

function emptyItemRow(): ItemRow {
  return {
    id: crypto.randomUUID(),
    categoryCode: EDUCATION_TOPIC_CATEGORIES[0].code,
    topicName: '',
    needReason: '',
    childRef: '',
    plannedHours: '',
    estimatedCost: '',
  }
}

/**
 * M7 §B.2/§B.3 — formální plán vzdělávání pěstouna, 7-stavové schvalovací
 * workflow s položkami (tématy). Renderuje se jednou na pěstounskou osobu
 * v detailu rodiny (mount řeší volající stránka).
 */
export function EducationPlanSection({
  fosterPersonId,
  fosterPersonName,
  organizationId,
  agreementId,
  currentUid,
  children,
}: EducationPlanSectionProps) {
  const [plans, setPlans] = useState<Array<{ docId: string; plan: EducationPlanDoc }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyDocId, setBusyDocId] = useState<string | null>(null)

  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [windowStart, setWindowStart] = useState('')
  const [windowEnd, setWindowEnd] = useState('')
  const [itemRows, setItemRows] = useState<ItemRow[]>([emptyItemRow()])
  const [formError, setFormError] = useState<string | null>(null)
  const { loading: submitting, success, run } = useAsyncSubmit()

  async function reload() {
    try {
      const list = await listEducationPlans(fosterPersonId)
      setPlans(list)
    } catch {
      setError('Plány vzdělávání se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fosterPersonId])

  function childName(childRef: string | null | undefined): string | null {
    if (!childRef) return null
    const found = children.find((c) => c.docId === childRef)
    return found ? `${found.child.firstName} ${found.child.lastName}` : null
  }

  async function runTransition(docId: string, action: () => Promise<void>) {
    setBusyDocId(docId)
    setError(null)
    try {
      await action()
      await reload()
    } catch {
      setError('Akci se nepodařilo provést.')
    } finally {
      setBusyDocId(null)
    }
  }

  function startReject(docId: string) {
    setRejectingDocId(docId)
    setRejectNote('')
    setRejectError(null)
  }

  async function submitReject(docId: string) {
    if (!rejectNote.trim()) {
      setRejectError('Uveďte důvod zamítnutí.')
      return
    }
    setRejectError(null)
    await runTransition(docId, () => rejectEducationPlan(fosterPersonId, docId, rejectNote.trim()))
    setRejectingDocId(null)
    setRejectNote('')
  }

  function updateRow(id: string, patch: Partial<ItemRow>) {
    setItemRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setItemRows((rows) => [...rows, emptyItemRow()])
  }

  function resetForm() {
    setWindowStart('')
    setWindowEnd('')
    setItemRows([emptyItemRow()])
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validRows = itemRows.filter((r) => r.topicName.trim() !== '')
    if (validRows.length === 0) {
      setFormError('Přidejte alespoň jedno téma s vyplněným názvem.')
      return
    }
    setFormError(null)
    try {
      const items: EducationPlanItem[] = validRows.map((r) => ({
        id: r.id,
        categoryCode: r.categoryCode,
        topicName: r.topicName.trim(),
        needReason: r.needReason.trim(),
        childRef: r.childRef || null,
        plannedHours: Number(r.plannedHours) || 0,
        estimatedCost: r.estimatedCost ? Number(r.estimatedCost) : null,
        status: 'planovano',
        courseEnrollmentRef: null,
      }))
      await run(async () => {
        await createEducationPlan(
          fosterPersonId,
          organizationId,
          agreementId,
          new Date(windowStart).toISOString(),
          new Date(windowEnd).toISOString(),
          items,
          currentUid,
        )
        await reload()
      })
      resetForm()
      setShowForm(false)
    } catch {
      setFormError('Plán se nepodařilo uložit.')
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-normal leading-tight text-text-primary">Plán vzdělávání — {fosterPersonName}</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setShowForm((v) => !v)
            if (showForm) resetForm()
          }}
        >
          {showForm ? 'Zrušit' : (<><Plus size={16} /> Navrhnout nový plán</>)}
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Období</span>
            <DateRangePicker from={windowStart} to={windowEnd} onChange={({ from, to }) => { setWindowStart(from); setWindowEnd(to) }} />
          </label>

          <div className="flex flex-col gap-3">
            {itemRows.map((row) => (
              <div key={row.id} className="flex flex-col gap-2 rounded-md bg-inset p-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-text-secondary">Kategorie</span>
                    <Select
                      value={row.categoryCode}
                      onChange={(e) => updateRow(row.id, { categoryCode: e.target.value })}
                    >
                      {EDUCATION_TOPIC_CATEGORIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}: {c.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-text-secondary">Dítě (volitelné)</span>
                    <Select
                      value={row.childRef}
                      onChange={(e) => updateRow(row.id, { childRef: e.target.value })}
                    >
                      <option value="">—</option>
                      {children.map((c) => (
                        <option key={c.docId} value={c.docId}>
                          {c.child.firstName} {c.child.lastName}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">Téma</span>
                  <Input value={row.topicName} onChange={(e) => updateRow(row.id, { topicName: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">Důvod potřeby</span>
                  <Input value={row.needReason} onChange={(e) => updateRow(row.id, { needReason: e.target.value })} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-text-secondary">Plánované hodiny</span>
                    <Input
                      type="number"
                      min="0"
                      value={row.plannedHours}
                      onChange={(e) => updateRow(row.id, { plannedHours: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-text-secondary">Odhadované náklady (Kč, volitelné)</span>
                    <Input
                      type="number"
                      min="0"
                      value={row.estimatedCost}
                      onChange={(e) => updateRow(row.id, { estimatedCost: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={addRow} className="w-fit">
            <Plus size={16} /> Přidat téma
          </Button>

          {formError && (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" loading={submitting} success={success} className="w-fit">
              Uložit návrh plánu
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
              disabled={submitting}
            >
              Zrušit
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4">
        {plans === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : plans.length === 0 ? (
          <EmptyState icon={GraduationCap} text="Zatím žádný plán vzdělávání." />
        ) : (
          <div className="flex flex-col gap-3">
            {plans.map(({ docId, plan }) => {
              const busy = busyDocId === docId
              return (
                <div key={docId} className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {new Date(plan.windowStart).toLocaleDateString('cs-CZ')} –{' '}
                        {new Date(plan.windowEnd).toLocaleDateString('cs-CZ')}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Odhadované náklady: {plan.totalEstimatedCost.toLocaleString('cs-CZ')} Kč
                      </p>
                    </div>
                    <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-surface-soft px-2.5 text-xs font-medium text-text-primary">
                      {STATUS_LABELS[plan.status]}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {plan.items.map((item) => {
                      const name = childName(item.childRef)
                      return (
                        <div key={item.id} className="rounded-md bg-inset p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-text-primary">{item.topicName}</p>
                            <span className="shrink-0 text-xs text-text-tertiary">
                              {ITEM_STATUS_LABELS[item.status]}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {CATEGORY_LABEL_BY_CODE.get(item.categoryCode) ?? item.categoryCode}
                          </p>
                          <p className="mt-1 text-sm text-text-secondary">{item.needReason}</p>
                          <p className="mt-1 text-xs text-text-tertiary">
                            {item.plannedHours} h
                            {item.estimatedCost != null && ` · ${item.estimatedCost.toLocaleString('cs-CZ')} Kč`}
                            {name && ` · ${name}`}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {plan.status === 'zamitnuto' && plan.rejectionNote && (
                    <p className="text-sm text-text-secondary">Důvod zamítnutí: {plan.rejectionNote}</p>
                  )}

                  {rejectingDocId === docId ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        rows={3}
                        placeholder="Důvod zamítnutí"
                        className="w-full resize-y rounded-sm border border-border-medium bg-inset px-3 py-2 text-[16px] leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-2 focus:border-accent focus:outline-none"
                      />
                      {rejectError && (
                        <p className="text-sm text-danger" role="alert">
                          {rejectError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => submitReject(docId)}
                        >
                          Potvrdit zamítnutí
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRejectingDocId(null)} disabled={busy}>
                          Zrušit
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {plan.status === 'navrzeno' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => runTransition(docId, () => sendEducationPlanToManagement(fosterPersonId, docId))}
                        >
                          Odeslat ke schválení vedení
                        </Button>
                      )}
                      {plan.status === 'ke_schvaleni_vedeni' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => runTransition(docId, () => approveEducationPlan(fosterPersonId, docId, currentUid))}
                          >
                            Schválit
                          </Button>
                          <Button variant="destructive" size="sm" disabled={busy} onClick={() => startReject(docId)}>
                            Zamítnout
                          </Button>
                        </>
                      )}
                      {plan.status === 'schvaleno_vedenim' && (
                        // Zatím neexistuje magic-link/foster-portál flow — potvrzení
                        // za pěstouna spouští přímo pracovník/KO tady (zjednodušení).
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => runTransition(docId, () => fosterConfirmEducationPlan(fosterPersonId, docId))}
                        >
                          Potvrdit pěstounem
                        </Button>
                      )}
                      {plan.status === 'potvrzeno_pestounem' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => runTransition(docId, () => activateEducationPlan(fosterPersonId, docId))}
                        >
                          Aktivovat
                        </Button>
                      )}
                      {plan.status === 'aktivni' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => runTransition(docId, () => closeEducationPlan(fosterPersonId, docId))}
                        >
                          Uzavřít
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
