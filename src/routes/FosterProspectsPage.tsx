import { useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { PageHead } from '@/components/spis/PageBody'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import {
  addFosterProspectNote,
  createFosterProspect,
  listFosterProspectNotes,
  listFosterProspects,
  suggestDormantProspects,
  updateFosterProspectStatus,
} from '@/services/fosterProspectService'
import type { FosterProspectDoc, FosterProspectExistingStatus, FosterProspectNoteDoc, FosterProspectStatus } from '@/types/fosterProspect'
import { checkEmail, checkPhone } from '@/lib/contactValidation'
import { Plus, UserPlus } from '@/components/ui/icons'

const STATUS_LABELS: Record<FosterProspectStatus, string> = {
  v_jednani: 'V jednání',
  vznik_dohody: 'Vznik Dohody',
  odmitnuto_organizaci: 'Odmítnuto organizací',
  odmitnuto_zajemcem: 'Odmítnuto zájemcem',
  uspany: 'Uspáno',
}
const STATUS_ORDER: FosterProspectStatus[] = ['v_jednani', 'vznik_dohody', 'odmitnuto_organizaci', 'odmitnuto_zajemcem', 'uspany']

const EXISTING_STATUS_LABELS: Record<FosterProspectExistingStatus, string> = {
  jiz_pestoun_jinde: 'Již pěstoun jinde',
  jiz_pestoun_bez_do: 'Již pěstoun bez Dohody',
  noveschvaleny_bez_do: 'Nově schválený bez Dohody',
  neznamo: 'Neznámo',
}

/**
 * /zajemci — M7 §B.7. Pipeline zájemců o pěstounství PŘED vznikem Dohody.
 * Seskupení do prostých sekcí dle stavu (ne skutečný drag-drop kanban —
 * mimo rozsah týhle dávky).
 */
export default function FosterProspectsPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [prospects, setProspects] = useState<Array<{ docId: string; prospect: FosterProspectDoc }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Array<{ docId: string; note: FosterProspectNoteDoc }> | null>(null)
  const [newNoteText, setNewNoteText] = useState('')
  const { loading: noteSubmitting, success: noteSuccess, run: runAddNote } = useAsyncSubmit()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [contactPhone, setContactPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [source, setSource] = useState('')
  const [existingFosterStatus, setExistingFosterStatus] = useState<FosterProspectExistingStatus>('neznamo')
  const { loading: submitting, success, run } = useAsyncSubmit()
  const [formError, setFormError] = useState<string | null>(null)

  // Stav se mění per-řádek (Select ve výpisu), ne globálně — sdílená
  // loading proměnná by při změně jednoho zájemce vizuálně "zamkla" i
  // selecty ostatních řádků. Sledujeme tedy jen ID právě probíhající
  // změny, useAsyncSubmit hlídá jen samotný běh akce.
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null)
  const { run: runStatusChange } = useAsyncSubmit()

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      setProspects(await listFosterProspects(organizationId))
    } catch {
      setError('Zájemce se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!name.trim() || !organizationId || !userDoc) return
    const emailCheck = checkEmail(contactEmail)
    const phoneCheck = checkPhone(contactPhone)
    setContactEmail(emailCheck.value)
    setContactPhone(phoneCheck.value)
    setEmailError(emailCheck.ok ? null : emailCheck.message ?? null)
    setPhoneError(phoneCheck.ok ? null : phoneCheck.message ?? null)
    if (!emailCheck.ok || !phoneCheck.ok) return
    try {
      await run(async () => {
        await createFosterProspect({
          organizationId,
          name,
          ...(emailCheck.value ? { contactEmail: emailCheck.value } : {}),
          ...(phoneCheck.value ? { contactPhone: phoneCheck.value } : {}),
          ...(source ? { source } : {}),
          existingFosterStatus,
          assignedTo: userDoc.uid,
        })
        await reload()
      })
      setShowForm(false)
      setName('')
      setContactEmail('')
      setContactPhone('')
      setSource('')
      setExistingFosterStatus('neznamo')
    } catch {
      setFormError('Přidání zájemce se nezdařilo.')
    }
  }

  async function handleStatusChange(prospectId: string, status: FosterProspectStatus) {
    setActionError(null)
    setStatusChangingId(prospectId)
    try {
      await runStatusChange(async () => {
        await updateFosterProspectStatus(prospectId, status)
        await reload()
      })
    } catch {
      setActionError('Změna stavu se nezdařila.')
    } finally {
      setStatusChangingId(null)
    }
  }

  async function toggleExpand(prospectId: string) {
    if (expandedId === prospectId) {
      setExpandedId(null)
      return
    }
    setExpandedId(prospectId)
    setNotes(null)
    setActionError(null)
    try {
      setNotes(await listFosterProspectNotes(prospectId))
    } catch {
      setActionError('Poznámky se nepodařilo načíst.')
    }
  }

  async function handleAddNote(prospectId: string) {
    if (!newNoteText.trim() || !userDoc) return
    setActionError(null)
    try {
      await runAddNote(async () => {
        await addFosterProspectNote(prospectId, userDoc.uid, newNoteText.trim())
        setNotes(await listFosterProspectNotes(prospectId))
        await reload()
      })
      setNewNoteText('')
    } catch {
      setActionError('Poznámku se nepodařilo uložit.')
    }
  }

  if (!organizationId) {
    return (
      <AppShell>
        <PageHead title="Zájemci" />
        <p className="mt-4 text-sm text-text-secondary">Tahle stránka je pro zaměstnance konkrétní organizace.</p>
      </AppShell>
    )
  }

  const dormant = prospects ? suggestDormantProspects(prospects) : []

  return (
    <AppShell>
      <PageHead
        title="Zájemci o pěstounství"
        count={prospects?.length}
        actions={
          <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Zrušit' : (<><Plus size={17} /> Přidat zájemce</>)}
          </Button>
        }
      >
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </PageHead>

      <section className="sp__card sp__card--pad">
      {dormant.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {dormant.map(({ docId, prospect }) => (
            <div key={docId} className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning">
              {prospect.name}: bez kontaktu 60+ dní, zvažte "uspáno".
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col max-w-[560px] gap-3 sp__sub">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Jméno
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              E-mail (volitelné)
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => { setContactEmail(e.target.value); setEmailError(null) }}
                onBlur={() => {
                  const result = checkEmail(contactEmail)
                  setContactEmail(result.value)
                  setEmailError(result.ok ? null : (result.message ?? null))
                }}
              />
              {emailError && <span className="text-xs text-danger">{emailError}</span>}
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Telefon (volitelné)
              <Input
                value={contactPhone}
                onChange={(e) => { setContactPhone(e.target.value); setPhoneError(null) }}
                onBlur={() => {
                  const result = checkPhone(contactPhone)
                  setContactPhone(result.value)
                  setPhoneError(result.ok ? null : (result.message ?? null))
                }}
              />
              {phoneError && <span className="text-xs text-danger">{phoneError}</span>}
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Zdroj (volitelné)
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Stávající stav
            <Select
              value={existingFosterStatus}
              onChange={(e) => setExistingFosterStatus(e.target.value as FosterProspectExistingStatus)}
            >
              {Object.entries(EXISTING_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          {formError && (
            <p className="text-sm text-danger" role="alert">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" loading={submitting} success={success}>
              Uložit
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>
              Zrušit
            </Button>
          </div>
        </form>
      )}

      {actionError && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {actionError}
        </p>
      )}

      <div className="mt-4">
        {prospects === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : prospects.length === 0 ? (
          <EmptyState icon={UserPlus} text="Zatím žádný zájemce." />
        ) : (
          <div className="flex flex-col gap-6">
            {STATUS_ORDER.map((status) => {
              const inStatus = prospects.filter(({ prospect }) => prospect.status === status)
              if (inStatus.length === 0) return null
              return (
                <div key={status}>
                  <h2 className="text-sm font-medium text-text-primary">{STATUS_LABELS[status]}</h2>
                  <div className="mt-2 flex flex-col max-w-[560px] gap-2">
                    {inStatus.map(({ docId, prospect }) => (
                      <div key={docId} className="sp__sub">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-text-primary">{prospect.name}</p>
                            <p className="text-xs text-text-secondary">
                              {[prospect.contactEmail, prospect.contactPhone].filter(Boolean).join(' · ')}
                            </p>
                            <p className="text-xs text-text-secondary">{EXISTING_STATUS_LABELS[prospect.existingFosterStatus]}</p>
                            {prospect.lastContactAt && (
                              <p className="text-xs text-text-secondary">
                                Poslední kontakt: {new Date(prospect.lastContactAt).toLocaleDateString('cs-CZ')}
                              </p>
                            )}
                          </div>
                          <Select
                            value={prospect.status}
                            onChange={(e) => handleStatusChange(docId, e.target.value as FosterProspectStatus)}
                            disabled={statusChangingId === docId}
                          >
                            {STATUS_ORDER.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABELS[s]}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <Button variant="ghost" size="sm" className="mt-2 w-fit" onClick={() => toggleExpand(docId)}>
                          {expandedId === docId ? 'Skrýt poznámky' : 'Poznámky'}
                        </Button>

                        {expandedId === docId && (
                          <div className="mt-2 flex flex-col max-w-[560px] gap-2 border-t border-border-subtle pt-2">
                            {notes === null ? (
                              <p className="text-sm text-text-secondary">Načítám…</p>
                            ) : notes.length === 0 ? (
                              <p className="text-sm text-text-secondary">Zatím žádná poznámka.</p>
                            ) : (
                              notes.map(({ docId: noteId, note }) => (
                                <p key={noteId} className="text-sm text-text-secondary">
                                  <span className="text-text-tertiary">{new Date(note.createdAt).toLocaleDateString('cs-CZ')}:</span>{' '}
                                  {note.text}
                                </p>
                              ))
                            )}
                            <div className="flex gap-2">
                              <Input
                                placeholder="Nová poznámka"
                                value={newNoteText}
                                onChange={(e) => setNewNoteText(e.target.value)}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAddNote(docId)}
                                loading={noteSubmitting}
                                success={noteSuccess}
                              >
                                Přidat
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </section>
    </AppShell>
  )
}
