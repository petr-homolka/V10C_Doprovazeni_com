import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ListTodo } from 'lucide-react'
import { listTasksForStaff, listTasksForSubject, setTaskStatus } from '@/services/taskService'
import { EmptyState } from '@/components/ui/empty-state'
import { PersonLink } from '@/components/ui/person-link'
import type { TaskDoc } from '@/types/task'
import type { SubjectRefKind } from '@/types/timelineEntry'

/**
 * Úkoly vázané na konkrétní entitu, přímo v jejím profilu — odpověď na
 * "co téhle rodině ještě dlužím". `TaskDoc.subjectRefs` existoval od
 * začátku, ale úkoly se daly vidět JEN na `/ukoly` jako jeden dlouhý
 * seznam za celou organizaci; kdo si otevřel rodinu, o jejích úkolech
 * nevěděl.
 *
 * Odškrtnout se dá rovnou tady — to je celý smysl toho, mít úkoly u
 * entity, k níž patří. "Hotovo" je STAV, ne mazání (§5 audit stopa).
 */
export function EntityTasks({
  organizationId,
  subjectKind,
  subjectId,
  staffNames,
}: {
  organizationId: string
  /** `staff` = úkoly PŘIŘAZENÉ zaměstnanci, ne úkoly o něm. */
  subjectKind: SubjectRefKind | 'staff'
  subjectId: string
  /** uid → jméno, ať jde řešitele zobrazit jako proklik. Volitelné —
   * bez toho se řešitel prostě neukáže, sekce funguje dál. */
  staffNames?: Map<string, string>
}) {
  const [tasks, setTasks] = useState<Array<{ docId: string; task: TaskDoc }> | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    try {
      setTasks(
        await (subjectKind === 'staff'
          ? listTasksForStaff(organizationId, subjectId)
          : listTasksForSubject(organizationId, subjectKind, subjectId)),
      )
    } catch {
      setTasks([])
      setError('Úkoly se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, subjectKind, subjectId])

  const open = useMemo(
    () =>
      (tasks ?? [])
        .filter(({ task }) => task.status === 'otevreny')
        // Úkoly s termínem první a podle termínu; bez termínu na konec —
        // "do kdy" je jediné, co u úkolu určuje pořadí.
        .sort((a, b) => (a.task.dueDate ?? '9999').localeCompare(b.task.dueDate ?? '9999')),
    [tasks],
  )
  const done = useMemo(() => (tasks ?? []).filter(({ task }) => task.status === 'hotovo'), [tasks])

  async function complete(docId: string) {
    setBusyId(docId)
    setError(null)
    try {
      await setTaskStatus(organizationId, docId, 'hotovo')
      await reload()
    } catch {
      setError('Úkol se nepodařilo dokončit.')
    } finally {
      setBusyId(null)
    }
  }

  if (tasks === null) return <p className="text-sm text-text-secondary">Načítám úkoly…</p>
  if (open.length === 0 && done.length === 0) {
    return <EmptyState icon={ListTodo} text="Žádné úkoly." />
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex max-w-[720px] flex-col gap-3">
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {open.map(({ docId, task }) => {
        const overdue = !!task.dueDate && task.dueDate < today
        return (
          <div key={docId} className="flex items-start gap-3 rounded-lg bg-surface-soft p-3 shadow-raised">
            <button
              type="button"
              disabled={busyId === docId}
              onClick={() => complete(docId)}
              aria-label={`Označit „${task.title}" jako hotové`}
              title="Označit jako hotové"
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border-strong text-transparent transition-colors hover:border-success hover:text-success disabled:opacity-40"
            >
              <CheckCircle2 size={14} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">{task.title}</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {task.dueDate ? (
                  <span className={overdue ? 'font-medium text-danger' : undefined}>
                    {overdue ? 'Po termínu ' : 'Termín '}
                    {new Date(task.dueDate).toLocaleDateString('cs-CZ')}
                  </span>
                ) : (
                  'Bez termínu'
                )}
                {staffNames?.has(task.assignedToUid) && (
                  <>
                    {' · '}
                    <PersonLink kind="staff" id={task.assignedToUid} name={staffNames.get(task.assignedToUid)!} muted />
                  </>
                )}
              </p>
              {task.notes && <p className="mt-1 text-sm text-text-secondary">{task.notes}</p>}
            </div>
          </div>
        )
      })}

      {done.length > 0 && (
        <details className="rounded-lg bg-inset p-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Hotovo ({done.length})
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {done.map(({ docId, task }) => (
              <p key={docId} className="text-sm text-text-tertiary line-through">
                {task.title}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
