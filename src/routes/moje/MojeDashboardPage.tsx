import { useEffect, useState } from 'react'
import { Baby, Clock, FileText, MessageCircle, Mic, StickyNote } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { MojeShell } from '@/components/moje/MojeShell'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { TimelineEntryDetail } from '@/components/timeline/TimelineEntryDetail'
import { DOCUMENT_STATUS_LABELS } from '@/components/documents/documentStatusLabels'
import { useAuth } from '@/hooks/useAuth'
import {
  getFosterFamily,
  listFosterChildren,
  listFosterVisibleDocuments,
  listFosterVisibleTimelineEntries,
} from '@/services/mojeService'
import { fosterApproveDocument, fosterCommentDocument } from '@/services/documentService'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import type { FamilyDoc } from '@/types/family'
import type { ChildDoc } from '@/types/child'
import type { SubjectRef, TimelineEntryDoc, TimelineEntryKind } from '@/types/timelineEntry'
import type { FamilyDocumentDoc } from '@/types/familyDocument'

const TIMELINE_TYPE_LABELS: Record<TimelineEntryKind, string> = {
  note: 'Poznámka',
  visit: 'Návštěva',
  voice_entry: 'Hlasový zápis',
  system: 'Systémová událost',
  document: 'Dokument',
}
const TIMELINE_TYPE_ICONS: Record<TimelineEntryKind, typeof Mic> = {
  note: StickyNote,
  visit: Clock,
  voice_entry: Mic,
  system: FileText,
  document: FileText,
}

/**
 * `/moje` — §2 "vlastní omezená appka": vlastní děti (read-only), sdílené
 * zápisy (sharingLevel 'foster'), chat s KO a dokumenty jsou SEAM (M9/M5
 * ještě neexistují vůbec, ani pro staff) — zobrazené jako jasně popsané
 * "připravujeme" karty, ne mlčky vynechané.
 *
 * Jméno autora zápisu se NEZOBRAZUJE jmenovitě ("Klíčová osoba" místo
 * toho) — pěstoun nemá (a nepotřebuje) čtecí právo na `users/{staffUid}`
 * (rules `users/{uid}` read vyžaduje `sameOrg`, což je jen pro staff).
 */
export default function MojeDashboardPage() {
  const { userDoc } = useAuth()
  const [family, setFamily] = useState<FamilyDoc | null>(null)
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [entries, setEntries] = useState<Array<{ docId: string; entry: TimelineEntryDoc }>>([])
  const [selectedEntry, setSelectedEntry] = useState<{ docId: string; entry: TimelineEntryDoc } | null>(null)
  const [documents, setDocuments] = useState<Array<{ docId: string; document: FamilyDocumentDoc }>>([])
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const { loading: docLoading, success: docSuccess, run: runDocAction } = useAsyncSubmit()
  const [pendingDocId, setPendingDocId] = useState<string | null>(null)

  // Loading/success jsou sdílené pro celou sekci (jeden useAsyncSubmit), proto
  // teprve až doběhne celý cyklus (loading i success záblesk), uvolníme, na
  // který dokument se to vztahovalo — jinak by "success" zůstal přilepený na
  // předchozím docId při dalším kliknutí.
  useEffect(() => {
    if (!docLoading && !docSuccess) setPendingDocId(null)
  }, [docLoading, docSuccess])

  function reload() {
    const familyId = userDoc?.fosterFamilyId
    if (!familyId) return
    Promise.all([
      getFosterFamily(familyId),
      listFosterChildren(familyId),
      listFosterVisibleTimelineEntries(familyId, userDoc?.fosterPersonRef),
      listFosterVisibleDocuments(familyId),
    ])
      .then(([f, kids, timelineEntries, docs]) => {
        setFamily(f)
        setChildren(kids)
        setEntries(timelineEntries)
        setDocuments(docs)
      })
      .catch(() => setError('Data se nepodařilo načíst.'))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- fosterPersonRef je stabilní po přihlášení
  useEffect(reload, [userDoc?.fosterFamilyId])

  async function handleApproveDocument(docId: string) {
    const familyId = userDoc?.fosterFamilyId
    const uid = userDoc?.uid
    if (!familyId || !uid) return
    setError(null)
    setPendingDocId(docId)
    try {
      await runDocAction(async () => {
        await fosterApproveDocument(familyId, docId, uid)
        reload()
      })
    } catch {
      setError('Schválení se nezdařilo.')
    }
  }

  async function handleCommentDocument(docId: string) {
    const familyId = userDoc?.fosterFamilyId
    const comment = commentDrafts[docId]?.trim()
    if (!familyId || !comment) return
    setError(null)
    setPendingDocId(docId)
    try {
      await runDocAction(async () => {
        await fosterCommentDocument(familyId, docId, comment)
        reload()
      })
      setCommentDrafts((prev) => ({ ...prev, [docId]: '' }))
    } catch {
      setError('Odeslání komentáře se nezdařilo.')
    }
  }

  function resolveSubjectLabels(subjectRefs: SubjectRef[]): string[] {
    return subjectRefs
      .filter((ref) => ref.kind === 'child')
      .map((ref) => {
        const c = children.find((ch) => ch.docId === ref.id)?.child
        return c ? `${c.firstName} ${c.lastName}` : null
      })
      .filter((label): label is string => label !== null)
  }

  return (
    <MojeShell>
      <h1 className="text-lg font-normal leading-normal text-text-primary">Vítejte, {userDoc?.displayName}</h1>
      {family?.address && <p className="mt-1 text-sm text-text-secondary">{family.address}</p>}

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-normal leading-tight text-text-primary">Vaše děti</h2>
        <div className="mt-3">
          {children.length === 0 ? (
            <EmptyState icon={Baby} text="Zatím tu nejsou žádné svěřené děti." />
          ) : (
            <div className="flex flex-col gap-2">
              {children.map(({ docId, child }) => (
                <div key={docId} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
                  <EntityAvatar photoURL={child.avatarUrl} label={`${child.firstName} ${child.lastName}`} />
                  <span className="text-sm text-text-primary">
                    {child.firstName} {child.lastName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-normal leading-tight text-text-primary">Sdílené zápisy</h2>
        <div className="mt-3">
          {entries.length === 0 ? (
            <EmptyState icon={Clock} text="Zatím tu nejsou žádné sdílené zápisy." />
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map(({ docId, entry }) => {
                const Icon = TIMELINE_TYPE_ICONS[entry.type]
                return (
                  <button
                    key={docId}
                    type="button"
                    onClick={() => setSelectedEntry({ docId, entry })}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors duration-150 hover:bg-overlay-hover"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-inset text-text-secondary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-text-primary">{TIMELINE_TYPE_LABELS[entry.type]}</p>
                        <p className="shrink-0 text-xs text-text-tertiary">
                          {new Date(entry.occurredAt).toLocaleString('cs-CZ')}
                        </p>
                      </div>
                      {entry.body && <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{entry.body}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-normal leading-tight text-text-primary">Chat s klíčovou osobou</h2>
        <div className="mt-3">
          <EmptyState icon={MessageCircle} text="Chat zatím připravujeme." />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-normal leading-tight text-text-primary">Dokumenty</h2>
        <div className="mt-3">
          {documents.length === 0 ? (
            <EmptyState icon={FileText} text="Zatím tu nejsou žádné dokumenty ke schválení." />
          ) : (
            <div className="flex flex-col gap-3">
              {documents.map(({ docId, document }) => (
                <div key={docId} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-text-primary">{document.title}</p>
                    <p className="shrink-0 text-xs text-text-tertiary">{DOCUMENT_STATUS_LABELS[document.status]}</p>
                  </div>
                  <div className="prose prose-sm mt-2 max-w-none text-text-secondary">
                    <ReactMarkdown>{document.body}</ReactMarkdown>
                  </div>
                  {document.status === 'foster_review' && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                      <Button
                        size="sm"
                        loading={docLoading && pendingDocId === docId}
                        success={docSuccess && pendingDocId === docId}
                        onClick={() => handleApproveDocument(docId)}
                      >
                        Schválit
                      </Button>
                      <textarea
                        value={commentDrafts[docId] ?? ''}
                        onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [docId]: e.target.value }))}
                        placeholder="Nebo napište komentář…"
                        rows={2}
                        className="w-full resize-y rounded-sm border border-border-medium bg-inset px-3 py-2 text-sm text-text-primary focus:border-2 focus:border-accent focus:outline-none"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={docLoading && pendingDocId === docId}
                        success={docSuccess && pendingDocId === docId}
                        onClick={() => handleCommentDocument(docId)}
                        disabled={!commentDrafts[docId]?.trim()}
                        className="w-fit"
                      >
                        Odeslat komentář
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedEntry && (
        <TimelineEntryDetail
          entry={selectedEntry.entry}
          authorName="Klíčová osoba"
          subjectLabels={resolveSubjectLabels(selectedEntry.entry.subjectRefs)}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </MojeShell>
  )
}
