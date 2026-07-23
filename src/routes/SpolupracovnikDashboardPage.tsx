import { useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import {
  createCollaboratorEntry,
  listAssignmentsForCollaborator,
  listCollaboratorEntries,
} from '@/services/collaboratorService'
import type { CollaboratorAssignmentDoc, CollaboratorEntryDoc } from '@/types/collaborator'
import { UserSquare2 } from 'lucide-react'

/**
 * /spolupracovnik — M9, UX zpětná vazba 2026-07-21. Vlastní, VÝRAZNĚ
 * zúžená obrazovka pro roli `spolupracovnik` — vidí jen osoby, co mu
 * KO/vedení výslovně přiřadí (`collaboratorAssignments`), a jen moduly, co
 * mu povolí (`UserDoc.collaboratorModules`). Na rozdíl od pěstounova
 * `/moje` (úplně odlišný, externí login) tohle žije uvnitř normálního
 * staffového `AppShell` — spolupracovník je interní zaměstnanec, jen s
 * mnohem užším rozsahem (viz RequireAuth.tsx/Sidebar.tsx pro
 * nav-omezení, firestore.rules `isCollaborator()` pro skutečné vynucení).
 */
export default function SpolupracovnikDashboardPage() {
  const { userDoc } = useAuth()
  const modules = userDoc?.collaboratorModules ?? {}

  const [assignments, setAssignments] = useState<Array<{ docId: string; assignment: CollaboratorAssignmentDoc }> | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [entries, setEntries] = useState<Array<{ docId: string; entry: CollaboratorEntryDoc }> | null>(null)
  const [entryText, setEntryText] = useState('')
  const { loading: savingEntry, success: saveEntrySuccess, run: runSaveEntry } = useAsyncSubmit()

  async function reload() {
    if (!userDoc) return
    setError(null)
    try {
      setAssignments(await listAssignmentsForCollaborator(userDoc.uid))
    } catch {
      setError('Přiřazené osoby se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDoc?.uid])

  async function toggleExpand(assignment: CollaboratorAssignmentDoc) {
    const key = `${assignment.entityType}_${assignment.entityId}`
    if (expandedId === key) {
      setExpandedId(null)
      return
    }
    setExpandedId(key)
    setEntries(null)
    if (!userDoc || !modules.viewTimeline) return
    try {
      setEntries(await listCollaboratorEntries(userDoc.uid, assignment.entityType, assignment.entityId))
    } catch {
      setError('Zápisy se nepodařilo načíst.')
    }
  }

  async function handleAddEntry(e: FormEvent, assignment: CollaboratorAssignmentDoc) {
    e.preventDefault()
    if (!userDoc || !entryText.trim()) return
    setError(null)
    try {
      await runSaveEntry(async () => {
        await createCollaboratorEntry(userDoc.uid, assignment.entityType, assignment.entityId, entryText)
        setEntries(await listCollaboratorEntries(userDoc.uid, assignment.entityType, assignment.entityId))
      })
      setEntryText('')
    } catch {
      setError('Zápis se nepodařilo uložit.')
    }
  }

  return (
    <AppShell breadcrumb={[{ label: 'Spolupráce' }]}>
      <PageHeader
        title="Moje přiřazené osoby"
        description="Vidíte jen osoby a moduly, co vám přiřadí klíčová osoba nebo vedení."
      />

      {error && (
        <p className="mt-3 max-w-[560px] text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 max-w-[560px]">
        {assignments === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : assignments.length === 0 ? (
          <EmptyState icon={UserSquare2} text="Zatím vám nikdo nepřiřadil žádnou osobu." />
        ) : (
          <div className="flex flex-col gap-2">
            {assignments.map(({ docId, assignment }) => {
              const key = `${assignment.entityType}_${assignment.entityId}`
              const expanded = expandedId === key
              return (
                <div key={docId} className="rounded-lg border border-border-subtle bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-text-primary">
                        {modules.viewName ? assignment.entityName : 'Přiřazená osoba'}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {[
                          modules.viewAddress ? assignment.addressSnapshot : null,
                          modules.viewPhone ? assignment.phoneSnapshot : null,
                          modules.viewKeyPerson && assignment.keyPersonNameSnapshot
                            ? `KO: ${assignment.keyPersonNameSnapshot}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                    </div>
                    {(modules.viewTimeline || modules.writeTimeline) && (
                      <Button variant="ghost" size="sm" onClick={() => toggleExpand(assignment)}>
                        {expanded ? 'Skrýt zápisy' : 'Zápisy'}
                      </Button>
                    )}
                  </div>

                  {expanded && (
                    <div className="mt-3 flex flex-col gap-3 border-t border-border-subtle pt-3">
                      {modules.writeTimeline && (
                        <form onSubmit={(e) => handleAddEntry(e, assignment)} className="flex flex-col gap-2">
                          <textarea
                            required
                            rows={3}
                            value={entryText}
                            onChange={(e) => setEntryText(e.target.value)}
                            placeholder="Co jste dnes dělali (pro výkaz práce)…"
                            className="w-full rounded-sm border border-transparent bg-field px-3 py-2 text-[15px] text-text-primary placeholder:text-text-tertiary transition-shadow duration-150 focus:border-accent focus:shadow-focus focus:outline-none"
                          />
                          <Button type="submit" size="sm" loading={savingEntry} success={saveEntrySuccess} className="w-fit">
                            Uložit zápis
                          </Button>
                        </form>
                      )}

                      {modules.viewTimeline && (
                        <div className="flex flex-col gap-2">
                          {entries === null ? (
                            <p className="text-sm text-text-secondary">Načítám…</p>
                          ) : entries.length === 0 ? (
                            <p className="text-sm text-text-secondary">Zatím žádné zápisy.</p>
                          ) : (
                            entries
                              .slice()
                              .sort((a, b) => b.entry.occurredAt.localeCompare(a.entry.occurredAt))
                              .map(({ docId: entryId, entry }) => (
                                <div key={entryId} className="rounded-md bg-surface-soft px-3 py-2">
                                  <p className="text-sm text-text-primary">{entry.body}</p>
                                  <p className="text-xs text-text-secondary">
                                    {new Date(entry.occurredAt).toLocaleString('cs-CZ')}
                                  </p>
                                </div>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
