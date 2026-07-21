import { useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import {
  activateGrant,
  approveGrant,
  createExternalParticipant,
  grantDirect,
  listExternalParticipants,
  listGrantsForChild,
  rejectGrant,
  requestGrant,
  revokeGrant,
} from '@/services/externalParticipantService'
import { PERMISSION_KEYS, isSensitivePermission, type ExternalParticipantDoc, type GrantDoc, type PermissionKey } from '@/types/externalParticipant'
import { Plus, UserSquare2 } from 'lucide-react'

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  viewDocuments: 'Zobrazit dokumenty',
  viewTimeline: 'Zobrazit časovou osu',
  viewPhotos: 'Zobrazit fotky',
  viewSchool: 'Zobrazit školu',
  viewMedical: 'Zobrazit zdravotní údaje',
  viewReports: 'Zobrazit reporty',
  viewCalendar: 'Zobrazit kalendář',
  uploadFiles: 'Nahrávat soubory',
  downloadFiles: 'Stahovat soubory',
  signDocuments: 'Podepisovat dokumenty',
  chatWith: 'Chatovat',
  receiveNotifications: 'Dostávat upozornění',
  confirmVisits: 'Potvrzovat návštěvy',
  videoCalls: 'Videohovory',
}

const STATUS_LABELS: Record<GrantDoc['status'], string> = {
  requested: 'Čeká na schválení',
  approved: 'Schváleno, čeká na aktivaci',
  active: 'Aktivní',
  revoked: 'Odebráno',
  rejected: 'Zamítnuto',
}

/**
 * /externiste — M8, §5.1. Plný grant/permission engine (viz firestore.rules
 * + externalParticipantService.ts). SEAM: dítě se tu vybírá ručně podle ID
 * (zkopírované z URL detailu dítěte, `/rodiny/:uid/dite/:childId`) — pořádný
 * rodina→dítě picker je mimo rozsah týhle dávky, appka jinak dítě podle ID
 * už umí zobrazit, tak stojí za to to nekomplikovat dřív, než bude jasné,
 * odkud se sem bude nejčastěji chodit (M9+, možná rovnou z ChildDetailPage).
 */
export default function ExternalParticipantsPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const role = userDoc?.role

  const canRequest = role !== undefined && (['klicova_osoba', 'asistent_ko', 'org_admin'] as const).includes(role as never)
  const canApprove = role !== undefined && (['org_admin', 'vedouci_pobocky', 'teamleader'] as const).includes(role as never)
  const canActivate = role === 'org_admin'

  const [participants, setParticipants] = useState<Array<{ docId: string; participant: ExternalParticipantDoc }> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [relationLabel, setRelationLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [childId, setChildId] = useState('')
  const [loadedChildId, setLoadedChildId] = useState<string | null>(null)
  const [grants, setGrants] = useState<Array<{ docId: string; grant: GrantDoc }> | null>(null)
  const [newPermission, setNewPermission] = useState<PermissionKey>('viewDocuments')
  const [newValidFrom, setNewValidFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [actionError, setActionError] = useState<string | null>(null)

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      setParticipants(await listExternalParticipants(organizationId))
    } catch {
      setError('Externisty se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !organizationId) return
    setSubmitting(true)
    try {
      await createExternalParticipant({ organizationId, name, email, relationLabel, ...(phone ? { phone } : {}) })
      setShowForm(false)
      setName('')
      setEmail('')
      setPhone('')
      setRelationLabel('')
      await reload()
    } catch {
      setError('Přidání externisty se nezdařilo.')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id)
    setChildId('')
    setLoadedChildId(null)
    setGrants(null)
    setActionError(null)
  }

  async function loadGrants(epId: string) {
    if (!childId.trim()) return
    setActionError(null)
    try {
      setGrants(await listGrantsForChild(epId, childId.trim()))
      setLoadedChildId(childId.trim())
    } catch {
      setActionError('Přístupy se nepodařilo načíst.')
    }
  }

  async function handleAddGrant(epId: string) {
    if (!loadedChildId || !userDoc) return
    setActionError(null)
    try {
      if (isSensitivePermission(newPermission)) {
        await requestGrant(epId, loadedChildId, newPermission, newValidFrom, userDoc.uid)
      } else {
        await grantDirect(epId, loadedChildId, newPermission, newValidFrom, userDoc.uid)
      }
      setGrants(await listGrantsForChild(epId, loadedChildId))
    } catch {
      setActionError('Přidání přístupu se nezdařilo.')
    }
  }

  async function handleAction(epId: string, action: 'approve' | 'reject' | 'activate' | 'revoke', grantId: string) {
    if (!loadedChildId || !userDoc) return
    setActionError(null)
    try {
      if (action === 'approve') await approveGrant(epId, loadedChildId, grantId, userDoc.uid)
      if (action === 'reject') await rejectGrant(epId, loadedChildId, grantId, userDoc.uid)
      if (action === 'activate') await activateGrant(epId, loadedChildId, grantId, userDoc.uid)
      if (action === 'revoke') await revokeGrant(epId, loadedChildId, grantId, userDoc.uid)
      setGrants(await listGrantsForChild(epId, loadedChildId))
    } catch {
      setActionError('Akce se nezdařila.')
    }
  }

  if (!organizationId) {
    return (
      <AppShell breadcrumb={[{ label: 'Externisté' }]}>
        <h1 className="text-lg font-normal leading-normal text-text-primary">Externisté</h1>
        <p className="mt-4 text-sm text-text-secondary">Tahle stránka je pro zaměstnance konkrétní organizace.</p>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumb={[{ label: 'Externisté' }]}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-normal leading-normal text-text-primary">Externí spolupracovníci</h1>
        {canRequest && (
          <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Zrušit' : (<><Plus size={16} /> Přidat externistu</>)}
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Jméno
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              E-mail
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Telefon (volitelné)
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Vztah k rodině (např. prarodič, psycholog, škola)
            <Input required value={relationLabel} onChange={(e) => setRelationLabel(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Ukládám…' : 'Uložit'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>
              Zrušit
            </Button>
          </div>
        </form>
      )}

      <div className="mt-4">
        {participants === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : participants.length === 0 ? (
          <EmptyState icon={UserSquare2} text="Zatím žádný externista." />
        ) : (
          <div className="flex flex-col gap-2">
            {participants.map(({ docId, participant }) => (
              <div key={docId} className="rounded-lg border border-border-subtle bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-primary">{participant.name}</p>
                    <p className="text-xs text-text-secondary">
                      {participant.relationLabel} · {[participant.email, participant.phone].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(docId)}>
                    {expandedId === docId ? 'Skrýt přístupy' : 'Spravovat přístupy'}
                  </Button>
                </div>

                {expandedId === docId && (
                  <div className="mt-3 flex flex-col gap-3 border-t border-border-subtle pt-3">
                    <div className="flex items-end gap-2">
                      <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
                        ID dítěte (zkopírujte z detailu dítěte)
                        <Input value={childId} onChange={(e) => setChildId(e.target.value)} />
                      </label>
                      <Button size="sm" variant="secondary" onClick={() => loadGrants(docId)}>
                        Načíst přístupy
                      </Button>
                    </div>

                    {actionError && (
                      <p className="text-sm text-danger" role="alert">
                        {actionError}
                      </p>
                    )}

                    {loadedChildId && (
                      <>
                        {canRequest && (
                          <div className="flex items-end gap-2">
                            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
                              Oprávnění
                              <Select value={newPermission} onChange={(e) => setNewPermission(e.target.value as PermissionKey)}>
                                {PERMISSION_KEYS.map((key) => (
                                  <option key={key} value={key}>
                                    {PERMISSION_LABELS[key]}
                                    {isSensitivePermission(key) ? ' (citlivé — vyžaduje schválení)' : ''}
                                  </option>
                                ))}
                              </Select>
                            </label>
                            <label className="flex flex-col gap-1 text-sm text-text-secondary">
                              Platí od
                              <Input type="date" value={newValidFrom} onChange={(e) => setNewValidFrom(e.target.value)} />
                            </label>
                            <Button size="sm" onClick={() => handleAddGrant(docId)}>
                              {isSensitivePermission(newPermission) ? 'Požádat o schválení' : 'Udělit přístup'}
                            </Button>
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          {grants === null ? (
                            <p className="text-sm text-text-secondary">Načítám…</p>
                          ) : grants.length === 0 ? (
                            <p className="text-sm text-text-secondary">Zatím žádný přístup pro tohle dítě.</p>
                          ) : (
                            grants.map(({ docId: grantId, grant }) => (
                              <div key={grantId} className="flex items-center justify-between gap-3 rounded-md bg-surface-soft px-3 py-2">
                                <div>
                                  <p className="text-sm text-text-primary">{PERMISSION_LABELS[grant.permissionKey]}</p>
                                  <p className="text-xs text-text-secondary">{STATUS_LABELS[grant.status]}</p>
                                </div>
                                <div className="flex gap-2">
                                  {grant.status === 'requested' && canApprove && (
                                    <>
                                      <Button size="sm" variant="secondary" onClick={() => handleAction(docId, 'approve', grantId)}>
                                        Schválit
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => handleAction(docId, 'reject', grantId)}>
                                        Zamítnout
                                      </Button>
                                    </>
                                  )}
                                  {grant.status === 'approved' && canActivate && (
                                    <Button size="sm" variant="secondary" onClick={() => handleAction(docId, 'activate', grantId)}>
                                      Aktivovat
                                    </Button>
                                  )}
                                  {grant.status === 'active' && canApprove && (
                                    <Button size="sm" variant="destructive" onClick={() => handleAction(docId, 'revoke', grantId)}>
                                      Odebrat
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
