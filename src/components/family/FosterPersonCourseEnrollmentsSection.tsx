import { useEffect, useState, type FormEvent } from 'react'
import { GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import {
  approveCourseEnrollment,
  closeCourseEnrollment,
  confirmCourseEnrollmentByFoster,
  confirmCourseEnrollmentByProvider,
  createCourseEnrollment,
  listCourseEnrollments,
  markCourseEnrollmentCompleted,
  markCourseEnrollmentPaid,
  rejectCourseEnrollment,
  sendCourseEnrollmentToManagement,
  uploadCourseEnrollmentInvoice,
} from '@/services/courseService'
import type { CourseDoc, CourseEnrollmentDoc, CourseEnrollmentStatus } from '@/types/course'
import { isReadOnlyManagerRole, type UserRole } from '@/types/user'

export interface FosterPersonCourseEnrollmentsSectionProps {
  fosterPersonId: string
  organizationId: string
  currentUid: string
  currentRole: string // userDoc.role — use to decide whether "schválit vedením" style actions show (see below)
}

const STATUS_LABELS: Record<CourseEnrollmentStatus, string> = {
  navrzeno_KO: 'Navrženo KO',
  zajem_pestoun: 'Zájem pěstouna',
  ke_schvaleni_vedeni: 'Čeká na schválení vedením',
  schvaleno_vedenim: 'Schváleno vedením',
  potvrzeno_pestounem: 'Potvrzeno pěstounem',
  potvrzeno_poskytovatelem: 'Potvrzeno poskytovatelem',
  absolvovano: 'Absolvováno',
  faktura_nahrana: 'Faktura nahrána',
  ukonceno: 'Ukončeno',
  zaplaceno: 'Zaplaceno',
  zamitnuto: 'Zamítnuto',
  zruseno: 'Zrušeno',
}

const INITIATED_BY_LABELS: Record<CourseEnrollmentDoc['initiatedBy'], string> = {
  ko: 'Podnět: KO',
  foster: 'Podnět: pěstoun',
}

const COURSE_TYPE_LABELS: Record<CourseDoc['type'], string> = {
  prezencne: 'Prezenčně',
  online: 'Online',
  hybrid: 'Hybridně',
}

const SELECT_CLASSNAME = 'h-10 w-full rounded-sm border border-border-medium bg-inset px-3 text-text-primary'
const TEXTAREA_CLASSNAME =
  'w-full resize-y rounded-sm border border-border-medium bg-inset px-3 py-2 text-[16px] leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-2 focus:border-accent focus:outline-none'

type Enrollment = { docId: string; enrollment: CourseEnrollmentDoc }

/**
 * §6 A10a — 11-status tok přihlášky na kurz. Reálný tok má dvojí
 * e-mailové potvrzení bez loginu (pěstoun/poskytovatel přes magic-link
 * portál); ten portál je SEAM mimo rozsah tady, takže
 * `confirmCourseEnrollmentByFoster`/`ByProvider` volá přímo KO/vedení
 * z týhle sekce.
 */
export function FosterPersonCourseEnrollmentsSection({
  fosterPersonId,
  organizationId,
  currentUid,
  currentRole,
}: FosterPersonCourseEnrollmentsSectionProps) {
  const isVedeni = currentRole === 'org_admin' || isReadOnlyManagerRole(currentRole as UserRole)

  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyDocId, setBusyDocId] = useState<string | null>(null)

  const [showNewForm, setShowNewForm] = useState(false)
  const [newInitiatedBy, setNewInitiatedBy] = useState<CourseEnrollmentDoc['initiatedBy']>('ko')
  const [creating, setCreating] = useState(false)

  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null)
  const [rejectionNote, setRejectionNote] = useState('')

  const [completingDocId, setCompletingDocId] = useState<string | null>(null)
  const [completeTitle, setCompleteTitle] = useState('')
  const [completeHours, setCompleteHours] = useState('')
  const [completeType, setCompleteType] = useState<CourseDoc['type']>('prezencne')
  const [completeOccurredAt, setCompleteOccurredAt] = useState('')

  const [invoicingDocId, setInvoicingDocId] = useState<string | null>(null)
  const [invoiceRef, setInvoiceRef] = useState('')

  async function reload() {
    setError(null)
    try {
      const list = await listCourseEnrollments(fosterPersonId)
      setEnrollments([...list].sort((a, b) => b.enrollment.createdAt.localeCompare(a.enrollment.createdAt)))
    } catch {
      setError('Přihlášky na kurzy se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fosterPersonId])

  async function withBusy(docId: string, fn: () => Promise<void>) {
    setBusyDocId(docId)
    setError(null)
    try {
      await fn()
      await reload()
    } catch {
      setError('Akci se nepodařilo provést.')
    } finally {
      setBusyDocId(null)
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      await createCourseEnrollment({ fosterPersonId, organizationId, initiatedBy: newInitiatedBy })
      setShowNewForm(false)
      setNewInitiatedBy('ko')
      await reload()
    } catch {
      setError('Založení přihlášky se nezdařilo.')
    } finally {
      setCreating(false)
    }
  }

  function handleRejectClick(docId: string) {
    setRejectingDocId(docId)
    setRejectionNote('')
  }

  async function handleRejectSubmit(docId: string) {
    if (!rejectionNote.trim()) return
    await withBusy(docId, () => rejectCourseEnrollment(fosterPersonId, docId, rejectionNote.trim()))
    setRejectingDocId(null)
    setRejectionNote('')
  }

  function handleCompleteClick(docId: string) {
    setCompletingDocId(docId)
    setCompleteTitle('')
    setCompleteHours('')
    setCompleteType('prezencne')
    setCompleteOccurredAt('')
  }

  async function handleCompleteSubmit(docId: string) {
    if (!completeTitle.trim() || !completeHours || !completeOccurredAt) return
    await withBusy(docId, () =>
      markCourseEnrollmentCompleted(fosterPersonId, docId, organizationId, currentUid, {
        title: completeTitle.trim(),
        hours: Number(completeHours),
        type: completeType,
        occurredAt: new Date(completeOccurredAt).toISOString(),
      }),
    )
    setCompletingDocId(null)
  }

  function handleInvoiceClick(docId: string) {
    setInvoicingDocId(docId)
    setInvoiceRef('')
  }

  async function handleInvoiceSubmit(docId: string) {
    if (!invoiceRef.trim()) return
    await withBusy(docId, () => uploadCourseEnrollmentInvoice(fosterPersonId, docId, invoiceRef.trim()))
    setInvoicingDocId(null)
  }

  function renderReimbursementNote(enrollment: CourseEnrollmentDoc) {
    const notes: string[] = []
    if (enrollment.travelReimbursement) notes.push('Evidována refundace cestovních nákladů.')
    if (enrollment.multiDayAccommodation) notes.push('Evidováno ubytování na vícedenním vzdělávání.')
    if (enrollment.isFosterReimbursement) notes.push('Evidována refundace kurzovného přímo pěstounovi.')
    if (notes.length === 0) return null
    return <p className="text-xs text-text-tertiary">{notes.join(' ')}</p>
  }

  function renderActions(docId: string, enrollment: CourseEnrollmentDoc) {
    const busy = busyDocId === docId

    if (enrollment.status === 'navrzeno_KO' || enrollment.status === 'zajem_pestoun') {
      return (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => withBusy(docId, () => sendCourseEnrollmentToManagement(fosterPersonId, docId, currentUid))}
        >
          Odeslat ke schválení vedení
        </Button>
      )
    }

    if (enrollment.status === 'ke_schvaleni_vedeni') {
      if (!isVedeni) return null
      return (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => withBusy(docId, () => approveCourseEnrollment(fosterPersonId, docId, currentUid))}
            >
              Schválit
            </Button>
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => handleRejectClick(docId)}>
              Zamítnout
            </Button>
          </div>
          {rejectingDocId === docId && (
            <div className="flex flex-col gap-2">
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Důvod zamítnutí"
                rows={2}
                className={TEXTAREA_CLASSNAME}
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy || !rejectionNote.trim()}
                  onClick={() => handleRejectSubmit(docId)}
                >
                  Potvrdit zamítnutí
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRejectingDocId(null)}>
                  Zrušit
                </Button>
              </div>
            </div>
          )}
        </div>
      )
    }

    if (enrollment.status === 'schvaleno_vedenim') {
      return (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => withBusy(docId, () => confirmCourseEnrollmentByFoster(fosterPersonId, docId))}
        >
          Potvrdit pěstounem
        </Button>
      )
    }

    if (enrollment.status === 'potvrzeno_pestounem') {
      return (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => withBusy(docId, () => confirmCourseEnrollmentByProvider(fosterPersonId, docId))}
        >
          Potvrdit poskytovatelem
        </Button>
      )
    }

    if (enrollment.status === 'potvrzeno_poskytovatelem') {
      if (completingDocId !== docId) {
        return (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => handleCompleteClick(docId)}>
            Označit jako absolvováno
          </Button>
        )
      }
      return (
        <div className="flex flex-col gap-2 rounded-md border border-border-subtle p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Název kurzu</span>
            <Input value={completeTitle} onChange={(e) => setCompleteTitle(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">Hodiny</span>
              <Input type="number" min="0" value={completeHours} onChange={(e) => setCompleteHours(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">Forma</span>
              <select
                value={completeType}
                onChange={(e) => setCompleteType(e.target.value as CourseDoc['type'])}
                className={SELECT_CLASSNAME}
              >
                {(Object.keys(COURSE_TYPE_LABELS) as CourseDoc['type'][]).map((t) => (
                  <option key={t} value={t}>
                    {COURSE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Datum konání</span>
            <Input type="date" value={completeOccurredAt} onChange={(e) => setCompleteOccurredAt(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !completeTitle.trim() || !completeHours || !completeOccurredAt}
              onClick={() => handleCompleteSubmit(docId)}
            >
              Uložit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCompletingDocId(null)}>
              Zrušit
            </Button>
          </div>
        </div>
      )
    }

    if (enrollment.status === 'absolvovano') {
      if (invoicingDocId !== docId) {
        return (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => handleInvoiceClick(docId)}>
            Nahrát fakturu
          </Button>
        )
      }
      return (
        <div className="flex flex-col gap-2 rounded-md border border-border-subtle p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Číslo/odkaz faktury</span>
            <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="číslo/odkaz faktury" />
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !invoiceRef.trim()} onClick={() => handleInvoiceSubmit(docId)}>
              Uložit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setInvoicingDocId(null)}>
              Zrušit
            </Button>
          </div>
        </div>
      )
    }

    if (enrollment.status === 'faktura_nahrana') {
      return (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => withBusy(docId, () => markCourseEnrollmentPaid(fosterPersonId, docId, currentUid))}
        >
          Označit jako zaplaceno
        </Button>
      )
    }

    if (enrollment.status === 'zaplaceno') {
      return (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => withBusy(docId, () => closeCourseEnrollment(fosterPersonId, docId, currentUid))}
        >
          Uzavřít
        </Button>
      )
    }

    return null
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-normal leading-tight text-text-primary">Přihlášky na kurzy</h2>
        <Button variant="secondary" size="sm" onClick={() => setShowNewForm((v) => !v)}>
          {showNewForm ? 'Zrušit' : '+ Nová přihláška'}
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {showNewForm && (
        <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Podnět</span>
            <select
              value={newInitiatedBy}
              onChange={(e) => setNewInitiatedBy(e.target.value as CourseEnrollmentDoc['initiatedBy'])}
              className={SELECT_CLASSNAME}
            >
              <option value="ko">KO</option>
              <option value="foster">Pěstoun</option>
            </select>
          </label>
          <Button type="submit" disabled={creating} className="w-fit">
            {creating ? 'Zakládám…' : 'Založit'}
          </Button>
        </form>
      )}

      <div className="mt-4">
        {enrollments === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : enrollments.length === 0 ? (
          <EmptyState icon={GraduationCap} text="Zatím žádné přihlášky na kurzy." />
        ) : (
          <div className="flex flex-col gap-3">
            {enrollments.map(({ docId, enrollment }) => (
              <div key={docId} className="rounded-lg border border-border-subtle bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text-secondary">{INITIATED_BY_LABELS[enrollment.initiatedBy]}</span>
                  <span className="inline-flex h-6 items-center rounded-full bg-surface-soft px-2.5 text-xs font-medium text-text-primary">
                    {STATUS_LABELS[enrollment.status]}
                  </span>
                </div>
                {enrollment.rejectionNote && (
                  <p className="mt-2 text-sm text-text-secondary">Poznámka k zamítnutí: {enrollment.rejectionNote}</p>
                )}
                {renderReimbursementNote(enrollment)}
                <div className="mt-3">{renderActions(docId, enrollment)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
