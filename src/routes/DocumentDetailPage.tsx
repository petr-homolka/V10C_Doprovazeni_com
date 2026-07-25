import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import ReactMarkdown from 'react-markdown'
import { AppShell } from '@/components/shell/AppShell'
import { PageHead } from '@/components/spis/PageBody'
import { SpisSection } from '@/components/spis/SpisSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { PersonLink } from '@/components/ui/person-link'
import { Textarea } from '@/components/ui/textarea'
import { DOCUMENT_STATUS_LABELS } from '@/components/documents/documentStatusLabels'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { getFamilyByUid, listChildrenForFamily, listFosterPersonsByRefs } from '@/services/familyService'
import { getActiveAgreement } from '@/services/agreementService'
import { listStaff } from '@/services/staffService'
import {
  closeDocument,
  editDocument,
  fileDocument,
  getDocumentById,
  listDocumentVersions,
  markDocumentFinal,
  rejectDocumentToDraft,
  sendDocumentToAuthority,
  sendToFosterReview,
  sendToMgmtReview,
} from '@/services/documentService'
import { isReadOnlyManagerRole } from '@/types/user'
import type { DocumentVersionDoc, FamilyDocumentDoc } from '@/types/familyDocument'
import type { UserDoc } from '@/types/user'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { SubjectRef } from '@/types/timelineEntry'

/**
 * `/rodiny/:familyUid/dokumenty/:docId` — §6 A1, M5.3. Jedna stránka,
 * VŠECHNY role/stavy — render se větví podle `document.status` +
 * `userDoc.role`, ne samostatné komponenty pro KO/vedení (kroky na sebe
 * plynule navazují na TÉŽE obrazovce, oddělovat by jen znásobilo kód).
 *
 * Editovatelný je obsah JEN v `draft`/`commented` (KO) — jinde je zápis
 * jen ke čtení (rendered markdown, `react-markdown` — NE
 * `dangerouslySetInnerHTML`, žádná ruční sanitizace navíc potřeba).
 */
export default function DocumentDetailPage() {
  const { familyUid, docId } = useParams<{ familyUid: string; docId: string }>()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const navigate = useNavigate()

  const [familyDocId, setFamilyDocId] = useState<string | null>(null)
  const [document, setDocument] = useState<FamilyDocumentDoc | null>(null)
  const [versions, setVersions] = useState<Array<{ docId: string; version: DocumentVersionDoc }>>([])
  const [assignedKoUid, setAssignedKoUid] = useState<string | null | undefined>(null)
  const [staffList, setStaffList] = useState<UserDoc[]>([])
  const [fosterPersons, setFosterPersons] = useState<Array<{ docId: string; fosterPerson: FosterPersonDoc }>>([])
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [reviewerUid, setReviewerUid] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [sentTo, setSentTo] = useState<'ospod' | 'soud'>('ospod')

  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { loading: savingEdit, success: savingEditSuccess, run: runSaveEdit } = useAsyncSubmit()
  const { loading: sendingToFoster, success: sendingToFosterSuccess, run: runSendToFoster } = useAsyncSubmit()
  const { loading: markingFinal, success: markingFinalSuccess, run: runMarkFinal } = useAsyncSubmit()
  const { loading: sendingToMgmt, success: sendingToMgmtSuccess, run: runSendToMgmt } = useAsyncSubmit()
  const { loading: rejecting, success: rejectingSuccess, run: runReject } = useAsyncSubmit()
  const { loading: closing, success: closingSuccess, run: runClose } = useAsyncSubmit()
  const { loading: sendingToAuthority, success: sendingToAuthoritySuccess, run: runSendToAuthority } = useAsyncSubmit()
  const { loading: filing, success: filingSuccess, run: runFile } = useAsyncSubmit()

  async function reload() {
    if (!familyUid || !docId || !organizationId) return
    setError(null)
    try {
      const found = await getFamilyByUid(familyUid, organizationId)
      if (!found) {
        setNotFound(true)
        return
      }
      setFamilyDocId(found.docId)
      const [doc, versionList, agreement, staff, fosters, kids] = await Promise.all([
        getDocumentById(found.docId, docId),
        listDocumentVersions(found.docId, docId, organizationId),
        getActiveAgreement(found.docId, organizationId),
        listStaff(organizationId),
        listFosterPersonsByRefs(found.family.fosterPersonRefs),
        listChildrenForFamily(found.docId, organizationId),
      ])
      if (!doc) {
        setNotFound(true)
        return
      }
      setDocument(doc)
      setVersions(versionList)
      setAssignedKoUid(agreement?.assignedTo)
      setStaffList(staff)
      setFosterPersons(fosters)
      setChildren(kids)
      setTitle(doc.title)
      setBody(doc.body)
    } catch {
      setError('Dokument se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyUid, docId, organizationId])

  useEffect(() => {
    if (!document) return
    QRCode.toDataURL(`${window.location.origin}/d/${document.uid}`, { margin: 1, width: 160 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [document?.uid])

  function resolveStaffName(uid: string): string {
    return staffList.find((s) => s.uid === uid)?.displayName ?? 'Neznámý uživatel'
  }

  function resolveSubjectLabels(subjectRefs: SubjectRef[]): string[] {
    return subjectRefs
      .map((ref) => {
        if (ref.kind === 'fosterPerson') {
          const fp = fosterPersons.find((f) => f.docId === ref.id)?.fosterPerson
          return fp ? `${fp.firstName} ${fp.lastName}` : null
        }
        if (ref.kind === 'child') {
          const c = children.find((ch) => ch.docId === ref.id)?.child
          return c ? `${c.firstName} ${c.lastName}` : null
        }
        return null
      })
      .filter((label): label is string => label !== null)
  }

  const isVedeni = userDoc && (userDoc.role === 'org_admin' || isReadOnlyManagerRole(userDoc.role))
  const bodyChanged = document && (title !== document.title || body !== document.body)

  async function handleSaveEdit() {
    if (!familyDocId || !docId || !organizationId || !userDoc || !document) return
    setError(null)
    try {
      await runSaveEdit(async () => {
        await editDocument(familyDocId, docId, organizationId, userDoc.uid, title, body, document.currentVersion)
        await reload()
      })
    } catch {
      setError('Akci se nepodařilo provést.')
    }
  }

  async function handleSendToFoster() {
    if (!familyDocId || !docId || !organizationId || !userDoc || !document) return
    setError(null)
    try {
      await runSendToFoster(async () => {
        if (bodyChanged) await editDocument(familyDocId, docId, organizationId, userDoc.uid, title, body, document.currentVersion)
        await sendToFosterReview(familyDocId, docId)
        await reload()
      })
    } catch {
      setError('Akci se nepodařilo provést.')
    }
  }

  async function handleMarkFinal() {
    if (!familyDocId || !docId || !userDoc) return
    setError(null)
    try {
      await runMarkFinal(async () => {
        await markDocumentFinal(familyDocId, docId, userDoc.uid, assignedKoUid)
        await reload()
      })
    } catch {
      setError('Akci se nepodařilo provést.')
    }
  }

  async function handleSendToMgmt() {
    if (!familyDocId || !docId) return
    setError(null)
    try {
      await runSendToMgmt(async () => {
        await sendToMgmtReview(familyDocId, docId, reviewerUid || undefined)
        await reload()
      })
    } catch {
      setError('Akci se nepodařilo provést.')
    }
  }

  async function handleReject() {
    if (!familyDocId || !docId || !rejectReason.trim()) return
    setError(null)
    try {
      await runReject(async () => {
        await rejectDocumentToDraft(familyDocId, docId, rejectReason.trim())
        await reload()
      })
      setShowRejectForm(false)
      setRejectReason('')
    } catch {
      setError('Akci se nepodařilo provést.')
    }
  }

  async function handleClose() {
    if (!familyDocId || !docId || !document) return
    setError(null)
    try {
      await runClose(async () => {
        await closeDocument(familyDocId, docId, document)
        await reload()
      })
    } catch {
      setError('Akci se nepodařilo provést.')
    }
  }

  async function handleSendToAuthority() {
    if (!familyDocId || !docId || !organizationId || !document) return
    setError(null)
    try {
      await runSendToAuthority(async () => {
        await sendDocumentToAuthority({ familyDocId, docId, organizationId, title: document.title, sentTo })
        await reload()
      })
    } catch {
      setError('Akci se nepodařilo provést.')
    }
  }

  async function handleFile() {
    if (!familyDocId || !docId) return
    setError(null)
    try {
      await runFile(async () => {
        await fileDocument(familyDocId, docId)
        await reload()
      })
    } catch {
      setError('Akci se nepodařilo provést.')
    }
  }

  if (notFound) {
    return (
      <AppShell>
        <PageHead title="Dokument" />
        <section className="sp__card sp__card--pad">
          <p className="text-sm text-text-secondary">Tenhle dokument se nepodařilo najít.</p>
        </section>
      </AppShell>
    )
  }

  if (!document) {
    return (
      <AppShell>
        <PageHead title="Dokument" />
        <section className="sp__card sp__card--pad">
          <p className="text-sm text-text-tertiary">Načítám…</p>
        </section>
      </AppShell>
    )
  }

  const status = document.status
  const isEditable = status === 'draft' || status === 'commented'
  const subjectLabels = resolveSubjectLabels(document.subjectRefs)
  const reviewerOptions = staffList.filter((s) => s.role === 'org_admin' || isReadOnlyManagerRole(s.role))

  return (
    <AppShell
    >
      <PageHead
        title={document.title}
        description={`${document.uid} · verze ${document.currentVersion} · ${DOCUMENT_STATUS_LABELS[status]}`}
        actions={
          qrDataUrl && (
            <div className="shrink-0 text-center">
              <img src={qrDataUrl} alt="QR ověřovací kód dokumentu" className="rounded-sm border border-border-default" />
              <p className="mt-1 text-2xs text-text-faint">hash {document.hash.slice(0, 12)}…</p>
            </div>
          )
        }
      >
        {(subjectLabels.length > 0 || error) && (
          <>
            {subjectLabels.length > 0 && (
              <p className="text-sm text-text-tertiary">Týká se: {subjectLabels.join(', ')}</p>
            )}
            {error && (
              <p className="mt-1 text-sm text-danger" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </PageHead>

      {document.rejectionReason && status === 'draft' && (
        <div className="sp__card sp__card--pad border-warning">
          <p className="text-sm font-medium text-text-primary">Vedení dokument zamítlo</p>
          <p className="mt-1 text-sm text-text-secondary">{document.rejectionReason}</p>
        </div>
      )}

      {document.fosterComments && (status === 'commented' || status === 'draft') && (
        <div className="sp__card sp__card--pad">
          <p className="text-sm font-medium text-text-primary">Komentář pěstouna</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{document.fosterComments}</p>
        </div>
      )}

      <section className="sp__card sp__card--pad">
        {isEditable ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Název</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Obsah</span>
              <RichTextEditor value={body} onChange={setBody} minHeight={396} placeholder="Začněte psát obsah dokumentu…" />
            </label>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveEdit}
                disabled={!bodyChanged}
                loading={savingEdit}
                success={savingEditSuccess}
                variant="secondary"
              >
                Uložit koncept
              </Button>
              <Button onClick={handleSendToFoster} loading={sendingToFoster} success={sendingToFosterSuccess}>
                Poslat pěstounovi
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="prose prose-sm max-w-none text-text-primary">
              <ReactMarkdown>{document.body}</ReactMarkdown>
            </div>
          </div>
        )}
      </section>

      {status === 'foster_review' && (
        <p className="sp__card sp__card--pad text-sm text-text-secondary">Čeká na reakci pěstouna.</p>
      )}

      {(status === 'commented' || status === 'approved_foster') && (
        <div className="flex items-center gap-2">
          <Button onClick={handleMarkFinal} loading={markingFinal} success={markingFinalSuccess}>
            Označit jako Konečný
          </Button>
        </div>
      )}

      {status === 'final' && (
        <div className="sp__card sp__card--pad flex max-w-[560px] flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Schvalovatel (volitelné)</span>
            <Select
              value={reviewerUid}
              onChange={(e) => setReviewerUid(e.target.value)}
            >
              <option value="">Nevybráno</option>
              {reviewerOptions.map((r) => (
                <option key={r.uid} value={r.uid}>
                  {r.displayName}
                </option>
              ))}
            </Select>
          </label>
          <Button onClick={handleSendToMgmt} loading={sendingToMgmt} success={sendingToMgmtSuccess} className="w-fit">
            Poslat vedení
          </Button>
        </div>
      )}

      {status === 'mgmt_review' && (
        <div className="sp__card sp__card--pad">
          <p className="text-sm text-text-secondary">Čeká na schválení vedením.</p>
          {isVedeni && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Button onClick={handleClose} loading={closing} success={closingSuccess}>
                  Schválit a uzavřít
                </Button>
                <Button variant="outline" onClick={() => setShowRejectForm((v) => !v)} disabled={closing}>
                  Zamítnout
                </Button>
              </div>
              {showRejectForm && (
                <div className="sp__sub flex max-w-[560px] flex-col gap-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium leading-relaxed text-text-primary">Důvod zamítnutí</span>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                    />
                  </label>
                  <Button
                    onClick={handleReject}
                    disabled={!rejectReason.trim()}
                    loading={rejecting}
                    success={rejectingSuccess}
                    className="w-fit"
                  >
                    Zamítnout a vrátit do konceptu
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(status === 'closed' ||
        status === 'closed_foster_unapproved' ||
        status === 'closed_ko_unapproved' ||
        status === 'closed_both_unapproved') && (
        <div className="sp__card sp__card--pad flex max-w-[560px] flex-col gap-3">
          <p className="text-sm text-text-primary">{DOCUMENT_STATUS_LABELS[status]}</p>
          <div className="flex items-center gap-2">
            <Select
              value={sentTo}
              onChange={(e) => setSentTo(e.target.value as 'ospod' | 'soud')}
            >
              <option value="ospod">OSPOD</option>
              <option value="soud">Soud</option>
            </Select>
            <Button onClick={handleSendToAuthority} loading={sendingToAuthority} success={sendingToAuthoritySuccess}>
              Odeslat na úřad
            </Button>
            <Button
              variant="secondary"
              onClick={handleFile}
              loading={filing}
              success={filingSuccess}
            >
              Uložit do spisu
            </Button>
          </div>
        </div>
      )}

      {status === 'sent' && (
        <p className="sp__card sp__card--pad text-sm text-text-secondary">
          Odesláno na {document.sentTo === 'soud' ? 'soud' : 'OSPOD'}{' '}
          {document.sentAt && new Date(document.sentAt).toLocaleString('cs-CZ')}.
        </p>
      )}
      {status === 'filed' && (
        <p className="sp__card sp__card--pad text-sm text-text-secondary">
          Uloženo do spisu {document.filedAt && new Date(document.filedAt).toLocaleString('cs-CZ')}.
        </p>
      )}

      <SpisSection id="verze" title="Historie verzí" description="Každá uložená verze i s otiskem obsahu." padded>
        <div className="flex flex-col">
          {versions.map(({ docId: vId, version }) => (
            <div key={vId} className="border-b border-border-subtle py-2 text-sm last:border-0">
              <p className="text-text-primary">
                v{version.version} ·{' '}
                <PersonLink
                  kind="staff"
                  id={staffList.some((s) => s.uid === version.editedByUid) ? version.editedByUid : null}
                  name={resolveStaffName(version.editedByUid)}
                  muted
                />{' '}
                ·{' '}
                {new Date(version.createdAt).toLocaleString('cs-CZ')}
              </p>
              <p className="mt-0.5 text-xs text-text-tertiary">hash {version.hash.slice(0, 16)}…</p>
            </div>
          ))}
        </div>
      </SpisSection>

      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/rodiny/${familyUid}`)}>
          ← Zpět na Spis
        </Button>
      </div>
    </AppShell>
  )
}
