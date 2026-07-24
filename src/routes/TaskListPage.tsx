import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { CheckSquare, Square, Ban, Plus } from 'lucide-react'
import { AppShell } from '@/components/shell/AppShell'
import { SidePanel } from '@/components/ui/side-panel'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/ui/empty-state'
import { SubjectRefsPicker } from '@/components/calendar/SubjectRefsPicker'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { listStaff } from '@/services/staffService'
import { listFamiliesWithDocIds, listChildrenForOrg, listFosterPersonsForOrg } from '@/services/familyService'
import {
  createTask,
  createRecurringTasks,
  listTasksForOrg,
  updateTask,
  setTaskStatus,
  cancelTaskSeries,
} from '@/services/taskService'
import { RECURRENCE_UNIT_LABELS, type RecurrenceUnit } from '@/types/calendarEvent'
import type { TaskDoc } from '@/types/task'
import type { UserDoc } from '@/types/user'
import type { FamilyDoc } from '@/types/family'
import type { ChildDoc } from '@/types/child'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { SubjectRef } from '@/types/timelineEntry'

const TABLE_COLUMNS = '32px 2fr 1fr 1fr'

function czechPlural(n: number, unit: RecurrenceUnit): string {
  const labels = RECURRENCE_UNIT_LABELS[unit]
  if (n === 1) return labels.singular
  if (n >= 2 && n <= 4) return labels.few
  return labels.many
}

const EMPTY_FORM = {
  title: '',
  assignedToUid: '',
  dueDate: '',
  notes: '',
  subjectRefs: [] as SubjectRef[],
  recurrenceEnabled: false,
  recurrenceInterval: 1,
  recurrenceUnit: 'week' as RecurrenceUnit,
  occurrenceCount: 4,
}

/**
 * `/ukoly` — dřív mrtvý odkaz v `Sidebar.tsx`, poprvé zprovozněný (Petrovo
 * zadání 2026-07-23, bod 3: "jak to bude s Úkoly, které na čas vázané
 * nejsou nebo mají jen deadline v budoucnosti?"). Sdílený staff seznam,
 * stejná důvěra napříč rolemi jako Kalendář — kdokoli smí založit/upravit/
 * dokončit ČÍKOLIV úkol.
 *
 * Cesta B, čtvrtý průchod (2026-07-23) — nový/upravovaný úkol žije
 * v pravém `SidePanel`u (stejný vzor jako `CalendarPage.tsx`), ne
 * v centrovaném `Modal`u — jednotná "editace = panel vpravo" konvence
 * napříč appkou, na přímé přání Petra ("Události a Úkoly" ve stejném
 * schovávacím sidebaru).
 */
export default function TaskListPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [staffList, setStaffList] = useState<UserDoc[]>([])
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }>>([])
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [fosterPersons, setFosterPersons] = useState<Array<{ docId: string; fosterPerson: FosterPersonDoc }>>([])
  const [tasks, setTasks] = useState<Array<{ docId: string; task: TaskDoc }> | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modal, setModal] = useState<{ mode: 'new' | 'edit'; docId?: string; seriesId?: string | null; dueDate?: string | null } | null>(
    null,
  )
  const [form, setForm] = useState(EMPTY_FORM)
  const { loading: saving, run: runSave } = useAsyncSubmit()
  const { loading: cancellingSeries, run: runCancelSeries } = useAsyncSubmit()

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      const [staff, fams, kids, fosters, allTasks] = await Promise.all([
        listStaff(organizationId),
        listFamiliesWithDocIds(organizationId),
        listChildrenForOrg(organizationId),
        listFosterPersonsForOrg(organizationId),
        listTasksForOrg(organizationId),
      ])
      setStaffList(staff)
      setFamilies(fams)
      setChildren(kids)
      setFosterPersons(fosters)
      setTasks(allTasks)
    } catch {
      setError('Úkoly se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const staffLabel = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of staffList) map.set(s.uid, s.displayName)
    return map
  }, [staffList])

  const visibleTasks = useMemo(() => {
    if (!tasks) return null
    return tasks
      .filter(({ task }) => (showDone ? true : task.status === 'otevreny'))
      .sort((a, b) => {
        if (a.task.status !== b.task.status) return a.task.status === 'otevreny' ? -1 : 1
        return (a.task.dueDate ?? '9999').localeCompare(b.task.dueDate ?? '9999')
      })
  }, [tasks, showDone])

  function openNew() {
    setForm({ ...EMPTY_FORM, assignedToUid: userDoc?.uid ?? '' })
    setModal({ mode: 'new' })
  }

  function openEdit(docId: string, task: TaskDoc) {
    setForm({
      ...EMPTY_FORM,
      title: task.title,
      assignedToUid: task.assignedToUid,
      dueDate: task.dueDate ?? '',
      notes: task.notes ?? '',
      subjectRefs: task.subjectRefs ?? [],
    })
    setModal({ mode: 'edit', docId, seriesId: task.recurrence?.seriesId ?? null, dueDate: task.dueDate })
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function toggleStatus(docId: string, task: TaskDoc, e: MouseEvent) {
    e.stopPropagation()
    if (!organizationId) return
    try {
      await setTaskStatus(organizationId, docId, task.status === 'hotovo' ? 'otevreny' : 'hotovo')
      await reload()
    } catch {
      setError('Změna stavu se nezdařila.')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!organizationId || !userDoc || !modal) return
    setError(null)
    try {
      await runSave(async () => {
        const assignedToUid = form.assignedToUid || userDoc.uid
        const notes = form.notes.trim() || null
        const dueDate = form.dueDate || null
        if (modal.mode === 'new' && form.recurrenceEnabled) {
          await createRecurringTasks({
            organizationId,
            createdByUid: userDoc.uid,
            assignedToUid,
            title: form.title.trim(),
            notes,
            dueDate,
            subjectRefs: form.subjectRefs,
            recurrenceInterval: form.recurrenceInterval,
            recurrenceUnit: form.recurrenceUnit,
            occurrenceCount: form.occurrenceCount,
          })
        } else if (modal.mode === 'new') {
          await createTask({
            organizationId,
            createdByUid: userDoc.uid,
            assignedToUid,
            title: form.title.trim(),
            notes,
            dueDate,
            subjectRefs: form.subjectRefs,
          })
        } else if (modal.docId) {
          await updateTask({
            organizationId,
            docId: modal.docId,
            title: form.title.trim(),
            assignedToUid,
            notes,
            dueDate,
            subjectRefs: form.subjectRefs,
          })
        }
        await reload()
      })
      setModal(null)
    } catch {
      setError('Uložení se nezdařilo.')
    }
  }

  async function handleCancel() {
    if (!organizationId || !modal?.docId) return
    try {
      await setTaskStatus(organizationId, modal.docId, 'zruseno')
      await reload()
      setModal(null)
    } catch {
      setError('Zrušení se nezdařilo.')
    }
  }

  async function handleCancelSeries() {
    if (!organizationId || !modal?.seriesId) return
    try {
      await runCancelSeries(async () => {
        await cancelTaskSeries(organizationId, modal.seriesId!, modal.dueDate ?? '')
        await reload()
      })
      setModal(null)
    } catch {
      setError('Zrušení celé řady se nezdařilo.')
    }
  }

  return (
    <AppShell breadcrumb={[{ label: 'Úkoly' }]} fullBleed>
      <div className="flex h-full min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border-default bg-surface-soft px-8 py-5">
            <h1 className="text-[22px] font-bold leading-tight text-text-primary">Úkoly</h1>
            <div className="flex shrink-0 items-center gap-3">
              <Switch checked={showDone} onChange={setShowDone} label="Zobrazit i dokončené/zrušené" />
              <Button size="sm" onClick={openNew}>
                <Plus size={16} /> Nový úkol
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-8">
            {error && (
              <p className="mb-3 max-w-xl text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            {visibleTasks === null ? (
              <p className="text-sm text-text-secondary">Načítám…</p>
            ) : visibleTasks.length === 0 ? (
              <EmptyState icon={CheckSquare} text="Žádné úkoly k zobrazení." />
            ) : (
              <Table>
                <TableHeaderRow columns={TABLE_COLUMNS} labels={['', 'Název', 'Přiřazeno', 'Termín']} />
                {visibleTasks.map(({ docId, task }) => (
                  <div key={docId} onClick={() => openEdit(docId, task)} className="contents cursor-pointer">
                    <TableRow columns={TABLE_COLUMNS}>
                      <button
                        type="button"
                        onClick={(e) => toggleStatus(docId, task, e)}
                        className="text-text-tertiary hover:text-primary"
                        title={task.status === 'hotovo' ? 'Otevřít znovu' : 'Označit jako hotové'}
                      >
                        {task.status === 'hotovo' ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                      </button>
                      <span
                        className={`truncate text-sm font-medium ${
                          task.status === 'otevreny' ? 'text-text-primary' : 'text-text-tertiary line-through'
                        }`}
                      >
                        {task.title}
                        {task.status === 'zruseno' && <span className="ml-2 text-xs font-normal text-danger">(zrušeno)</span>}
                      </span>
                      <span className="truncate text-sm text-text-secondary">{staffLabel.get(task.assignedToUid) ?? '—'}</span>
                      <span className="text-sm text-text-secondary">
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('cs-CZ') : '—'}
                      </span>
                    </TableRow>
                  </div>
                ))}
              </Table>
            )}
          </div>
        </div>

        {modal && (
          <SidePanel
            title={modal.mode === 'new' ? 'Nový úkol' : 'Upravit úkol'}
            onClose={() => setModal(null)}
            actions={
              modal.mode === 'edit' ? (
                <>
                  {modal.seriesId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={cancellingSeries}
                      onClick={handleCancelSeries}
                      className="text-danger"
                      title="Zruší tenhle i všechny budoucí výskyty stejné opakující se řady."
                    >
                      <Ban size={14} /> Řada
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancel} className="text-danger">
                    <Ban size={14} /> Zrušit
                  </Button>
                </>
              ) : undefined
            }
          >
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Název</span>
                <Input required autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Přiřazeno</span>
                <Select value={form.assignedToUid} onChange={(e) => set('assignedToUid', e.target.value)}>
                  {staffList.map((s) => (
                    <option key={s.uid} value={s.uid}>
                      {s.displayName}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Termín</h3>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Termín (volitelné)</span>
                <DatePicker value={form.dueDate} onChange={(v) => set('dueDate', v)} />
              </label>

            {modal.mode === 'new' && (
              <div className="flex flex-col gap-2 rounded-sm border border-transparent bg-field px-3 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Opakovat</span>
                  <Switch checked={form.recurrenceEnabled} onChange={(v) => set('recurrenceEnabled', v)} label="Opakovat" />
                </div>
                {form.recurrenceEnabled && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-text-secondary">Každých</span>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={form.recurrenceInterval}
                      onChange={(e) => set('recurrenceInterval', Math.max(1, Number(e.target.value) || 1))}
                      className="w-16"
                    />
                    <Select
                      value={form.recurrenceUnit}
                      onChange={(e) => set('recurrenceUnit', e.target.value as RecurrenceUnit)}
                      className="w-28"
                    >
                      {(['day', 'week', 'month', 'year'] as RecurrenceUnit[]).map((u) => (
                        <option key={u} value={u}>
                          {czechPlural(form.recurrenceInterval, u)}
                        </option>
                      ))}
                    </Select>
                    <span className="text-sm text-text-secondary">celkem</span>
                    <Input
                      type="number"
                      min={1}
                      max={104}
                      value={form.occurrenceCount}
                      onChange={(e) => set('occurrenceCount', Math.min(104, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-16"
                    />
                    <span className="text-sm text-text-secondary">krát</span>
                  </div>
                )}
                {form.recurrenceEnabled && (
                  <p className="text-xs text-text-tertiary">
                    Založí se každý výskyt zvlášť (max. 104 výskytů/2 roky dopředu), termín každého výskytu se posune podle
                    prvního zadaného data — bez termínu se opakování počítá od dnešního dne.
                  </p>
                )}
              </div>
            )}
            </div>

            <div className="flex flex-col gap-4 border-t border-border-subtle pt-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Vazba (rodina / dítě / pěstoun)</span>
                <SubjectRefsPicker
                  value={form.subjectRefs}
                  onChange={(refs) => set('subjectRefs', refs)}
                  families={families}
                  children={children}
                  fosterPersons={fosterPersons}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Poznámka</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-sm border border-transparent bg-field px-3 py-2 text-sm text-text-primary transition-shadow duration-150 focus:border-accent focus:shadow-focus focus:outline-none"
                />
              </label>
            </div>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-2 border-t border-border-default pt-4">
              <Button type="submit" loading={saving}>
                {modal.mode === 'new' ? 'Založit' : 'Uložit změny'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setModal(null)} disabled={saving}>
                Zrušit okno
              </Button>
            </div>
          </form>
          </SidePanel>
        )}
      </div>
    </AppShell>
  )
}
