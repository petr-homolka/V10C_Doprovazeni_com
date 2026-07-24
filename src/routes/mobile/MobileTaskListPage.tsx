import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react'
import { CheckSquare, Square, Ban, Plus } from 'lucide-react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { BottomSheet } from '@/components/mobile/BottomSheet'
import { GroupedList, GroupedListRow } from '@/components/mobile/GroupedList'
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
 * Mobilní Úkoly (2026-07-23) — stejný účel jako desktopová `TaskListPage`,
 * bez nav tabu vlastního (4 sloty tab baru jsou plné, viz `MobileShell.tsx`
 * — dostupné přes "Zkratky" na `MobileAccountPage`, stejně jako Pěstouni/
 * Děti). `BottomSheet` formulář = stejný vzor jako `MobileCalendarPage`.
 */
export default function MobileTaskListPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [staffList, setStaffList] = useState<UserDoc[]>([])
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }>>([])
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [fosterPersons, setFosterPersons] = useState<Array<{ docId: string; fosterPerson: FosterPersonDoc }>>([])
  const [tasks, setTasks] = useState<Array<{ docId: string; task: TaskDoc }> | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sheet, setSheet] = useState<{ mode: 'new' | 'edit'; docId?: string; seriesId?: string | null; dueDate?: string | null } | null>(
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
    setSheet({ mode: 'new' })
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
    setSheet({ mode: 'edit', docId, seriesId: task.recurrence?.seriesId ?? null, dueDate: task.dueDate })
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
    if (!organizationId || !userDoc || !sheet) return
    setError(null)
    try {
      await runSave(async () => {
        const assignedToUid = form.assignedToUid || userDoc.uid
        const notes = form.notes.trim() || null
        const dueDate = form.dueDate || null
        if (sheet.mode === 'new' && form.recurrenceEnabled) {
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
        } else if (sheet.mode === 'new') {
          await createTask({
            organizationId,
            createdByUid: userDoc.uid,
            assignedToUid,
            title: form.title.trim(),
            notes,
            dueDate,
            subjectRefs: form.subjectRefs,
          })
        } else if (sheet.docId) {
          await updateTask({
            organizationId,
            docId: sheet.docId,
            title: form.title.trim(),
            assignedToUid,
            notes,
            dueDate,
            subjectRefs: form.subjectRefs,
          })
        }
        await reload()
      })
      setSheet(null)
    } catch {
      setError('Uložení se nezdařilo.')
    }
  }

  async function handleCancel() {
    if (!organizationId || !sheet?.docId) return
    try {
      await setTaskStatus(organizationId, sheet.docId, 'zruseno')
      await reload()
      setSheet(null)
    } catch {
      setError('Zrušení se nezdařilo.')
    }
  }

  async function handleCancelSeries() {
    if (!organizationId || !sheet?.seriesId) return
    try {
      await runCancelSeries(async () => {
        await cancelTaskSeries(organizationId, sheet.seriesId!, sheet.dueDate ?? '')
        await reload()
      })
      setSheet(null)
    } catch {
      setError('Zrušení celé řady se nezdařilo.')
    }
  }

  return (
    <MobileShell>
      <div className="flex flex-col pb-24 pt-6">
        <div className="flex items-center justify-between px-5">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-text-primary">Úkoly</h1>
        </div>
        <div className="mt-3 flex items-center justify-between px-5">
          <span className="text-[14px] text-text-secondary">Zobrazit i dokončené/zrušené</span>
          <Switch checked={showDone} onChange={setShowDone} label="Zobrazit i dokončené/zrušené" />
        </div>

        {error && (
          <p className="mt-3 px-5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 px-5">
          {visibleTasks === null ? (
            <p className="text-[15px] text-text-secondary">Načítám…</p>
          ) : visibleTasks.length === 0 ? (
            <EmptyState icon={CheckSquare} text="Žádné úkoly k zobrazení." />
          ) : (
            <GroupedList>
              {visibleTasks.map(({ docId, task }) => (
                <GroupedListRow key={docId} onClick={() => openEdit(docId, task)}>
                  <button
                    type="button"
                    onClick={(e) => toggleStatus(docId, task, e)}
                    className="shrink-0 text-text-tertiary active:scale-90"
                    aria-label={task.status === 'hotovo' ? 'Otevřít znovu' : 'Označit jako hotové'}
                  >
                    {task.status === 'hotovo' ? <CheckSquare size={22} className="text-primary" /> : <Square size={22} />}
                  </button>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`truncate text-[16px] font-medium ${
                        task.status === 'otevreny' ? 'text-text-primary' : 'text-text-tertiary line-through'
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.dueDate && (
                      <span className="text-[13px] text-text-secondary">{new Date(task.dueDate).toLocaleDateString('cs-CZ')}</span>
                    )}
                  </span>
                </GroupedListRow>
              ))}
            </GroupedList>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={openNew}
        aria-label="Nový úkol"
        className="fixed bottom-24 right-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-overlay transition-transform duration-150 active:scale-90"
      >
        <Plus size={26} strokeWidth={2} />
      </button>

      {sheet && (
        <BottomSheet onClose={() => setSheet(null)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 pb-6 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-text-primary">{sheet.mode === 'new' ? 'Nový úkol' : 'Upravit úkol'}</h2>
              {sheet.mode === 'edit' && (
                <Button type="button" variant="ghost" size="sm" onClick={handleCancel} className="text-danger">
                  <Ban size={16} /> Zrušit úkol
                </Button>
              )}
            </div>
            {sheet.mode === 'edit' && sheet.seriesId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={cancellingSeries}
                onClick={handleCancelSeries}
                className="w-fit text-danger"
              >
                <Ban size={16} /> Zrušit celou opakující se řadu
              </Button>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Název</span>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="h-12 text-base"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Termín (volitelné)</span>
              <DatePicker value={form.dueDate} onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))} className="h-12 text-base" />
            </label>
            {staffList.length > 1 && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Přiřazeno</span>
                <Select
                  value={form.assignedToUid}
                  onChange={(e) => setForm((f) => ({ ...f, assignedToUid: e.target.value }))}
                  className="h-12 text-base"
                >
                  {staffList.map((s) => (
                    <option key={s.uid} value={s.uid}>
                      {s.displayName}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {sheet.mode === 'new' && (
              <div className="flex flex-col gap-2 rounded-sm border border-border-medium bg-inset px-3 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-text-primary">Opakovat</span>
                  <Switch
                    checked={form.recurrenceEnabled}
                    onChange={(v) => setForm((f) => ({ ...f, recurrenceEnabled: v }))}
                    label="Opakovat"
                  />
                </div>
                {form.recurrenceEnabled && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-text-secondary">Každých</span>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={form.recurrenceInterval}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, recurrenceInterval: Math.max(1, Number(e.target.value) || 1) }))
                        }
                        className="h-10 w-16"
                      />
                      <Select
                        value={form.recurrenceUnit}
                        onChange={(e) => setForm((f) => ({ ...f, recurrenceUnit: e.target.value as RecurrenceUnit }))}
                        className="h-10 w-28"
                      >
                        {(['day', 'week', 'month', 'year'] as RecurrenceUnit[]).map((u) => (
                          <option key={u} value={u}>
                            {czechPlural(form.recurrenceInterval, u)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-text-secondary">Celkem</span>
                      <Input
                        type="number"
                        min={1}
                        max={104}
                        value={form.occurrenceCount}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, occurrenceCount: Math.min(104, Math.max(1, Number(e.target.value) || 1)) }))
                        }
                        className="h-10 w-16"
                      />
                      <span className="text-sm text-text-secondary">krát</span>
                    </div>
                  </>
                )}
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Vazba (rodina / dítě / pěstoun)</span>
              <SubjectRefsPicker
                value={form.subjectRefs}
                onChange={(refs) => setForm((f) => ({ ...f, subjectRefs: refs }))}
                families={families}
                children={children}
                fosterPersons={fosterPersons}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Poznámky (volitelné)</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Doplňující poznámka…"
                className="w-full resize-none rounded-sm border border-transparent bg-field px-3 py-2.5 text-base leading-relaxed text-text-primary placeholder:text-text-tertiary transition-shadow duration-150 focus:border-accent focus:shadow-focus focus:outline-none"
              />
            </label>
            <Button type="submit" loading={saving} className="h-14 text-base">
              {sheet.mode === 'new' ? 'Založit' : 'Uložit změny'}
            </Button>
          </form>
        </BottomSheet>
      )}
    </MobileShell>
  )
}
