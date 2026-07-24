import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Select } from '@/components/ui/select'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import {
  activateGrant,
  approveGrant,
  createExternalParticipant,
  grantDirect,
  listExternalParticipants,
  listGrantsForEntity,
  rejectGrant,
  requestGrant,
  revokeGrant,
} from '@/services/externalParticipantService'
import { listChildrenForOrg, listFosterPersonsForOrg } from '@/services/familyService'
import {
  PERMISSION_KEYS,
  isSensitivePermission,
  type ExternalEntityType,
  type ExternalParticipantDoc,
  type GrantDoc,
  type PermissionKey,
} from '@/types/externalParticipant'
import { checkEmail, checkPhone } from '@/lib/contactValidation'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
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

function encodeEntity(type: ExternalEntityType, id: string): string {
  return `${type}:${id}`
}

function decodeEntity(value: string): { type: ExternalEntityType; id: string } | null {
  const sep = value.indexOf(':')
  if (sep < 0) return null
  const type = value.slice(0, sep)
  const id = value.slice(sep + 1)
  if (!id || (type !== 'child' && type !== 'fosterPerson')) return null
  return { type, id }
}

/**
 * /externiste — M8, §5.1. Grant/permission engine (viz firestore.rules +
 * externalParticipantService.ts). Dítě/pěstoun se vybírá vyhledávacím
 * comboboxem přes `entityOptions` (obě entity dohromady, viz UX zpětná
 * vazba 2026-07-21 — externista "patří" k jedné konkrétní osobě od
 * registrace, ne až po ručním vložení ID). Lze sem přijít i rovnou
 * z profilu dítěte/pěstouna přes `?entityType=&entityId=` (viz
 * ChildDetailPage/FosterPersonDetailPage "Přidat externistu").
 */
export default function ExternalParticipantsPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const role = userDoc?.role
  const [searchParams] = useSearchParams()

  const canRequest = role !== undefined && (['klicova_osoba', 'asistent_ko', 'org_admin'] as const).includes(role as never)
  const canApprove = role !== undefined && (['org_admin', 'vedouci_pobocky', 'teamleader'] as const).includes(role as never)
  const canActivate = role === 'org_admin'

  const [participants, setParticipants] = useState<Array<{ docId: string; participant: ExternalParticipantDoc }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [entityOptions, setEntityOptions] = useState<ComboboxOption[]>([])

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [relationLabel, setRelationLabel] = useState('')
  const [formEntityValue, setFormEntityValue] = useState('')
  const { loading: submitting, success, run } = useAsyncSubmit()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [entityValue, setEntityValue] = useState('')
  const [loadedEntityId, setLoadedEntityId] = useState<string | null>(null)
  const [grants, setGrants] = useState<Array<{ docId: string; grant: GrantDoc }> | null>(null)
  const [newPermission, setNewPermission] = useState<PermissionKey>('viewDocuments')
  const [newValidFrom, setNewValidFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [actionError, setActionError] = useState<string | null>(null)
  const { loading: addingGrant, success: addGrantSuccess, run: runAddGrant } = useAsyncSubmit()
  const { loading: actionLoading, success: actionSuccess, run: runAction } = useAsyncSubmit()
  const [pendingGrantId, setPendingGrantId] = useState<string | null>(null)

  // Jakmile hook dokončí loading i success záblesk, uvolni řádkový příznak
  // — jinak by po dalším kliknutí na JINÝ grant zůstal "přilepený" na tom
  // starém, protože actionLoading/actionSuccess jsou sdílené pro celou sekci.
  useEffect(() => {
    if (!actionLoading && !actionSuccess) setPendingGrantId(null)
  }, [actionLoading, actionSuccess])

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

  useEffect(() => {
    if (!organizationId) return
    Promise.all([listChildrenForOrg(organizationId), listFosterPersonsForOrg(organizationId)]).then(
      ([children, fosterPersons]) => {
        setEntityOptions([
          ...children.map(({ docId, child }) => ({
            value: encodeEntity('child', docId),
            label: `${child.firstName} ${child.lastName} (dítě)`,
          })),
          ...fosterPersons.map(({ docId, fosterPerson }) => ({
            value: encodeEntity('fosterPerson', docId),
            label: `${fosterPerson.firstName} ${fosterPerson.lastName} (pěstoun)`,
          })),
        ])
      },
    )
  }, [organizationId])

  // Deep-link z profilu dítěte/pěstouna — předvyplní a rovnou otevře formulář.
  useEffect(() => {
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    if ((entityType === 'child' || entityType === 'fosterPerson') && entityId) {
      setShowForm(true)
      setFormEntityValue(encodeEntity(entityType, entityId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formEntityLabel = useMemo(
    () => entityOptions.find((o) => o.value === formEntityValue)?.label ?? '',
    [entityOptions, formEntityValue],
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !organizationId) return
    const decoded = decodeEntity(formEntityValue)
    if (!decoded) {
      setError('Vyberte dítě nebo pěstouna, ke kterému externista patří.')
      return
    }
    const emailCheck = checkEmail(email)
    const phoneCheck = checkPhone(phone)
    setEmail(emailCheck.value)
    setPhone(phoneCheck.value)
    setEmailError(emailCheck.ok ? null : emailCheck.message ?? null)
    setPhoneError(phoneCheck.ok ? null : phoneCheck.message ?? null)
    if (!emailCheck.ok || !phoneCheck.ok) return
    setError(null)
    try {
      await run(async () => {
        await createExternalParticipant({
          organizationId,
          name,
          email: emailCheck.value,
          relationLabel,
          primaryEntityType: decoded.type,
          primaryEntityId: decoded.id,
          primaryEntityLabel: formEntityLabel,
          ...(phoneCheck.value ? { phone: phoneCheck.value } : {}),
        })
        await reload()
      })
      setShowForm(false)
      setName('')
      setEmail('')
      setPhone('')
      setRelationLabel('')
      setFormEntityValue('')
    } catch {
      setError('Přidání externisty se nezdařilo.')
    }
  }

  async function loadGrants(epId: string, idOverride?: string) {
    const id = idOverride ?? decodeEntity(entityValue)?.id
    if (!id) return
    setActionError(null)
    try {
      setGrants(await listGrantsForEntity(epId, id))
      setLoadedEntityId(id)
    } catch {
      setActionError('Přístupy se nepodařilo načíst.')
    }
  }

  async function toggleExpand(id: string, participant: ExternalParticipantDoc) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    setGrants(null)
    setLoadedEntityId(null)
    setActionError(null)
    if (participant.primaryEntityType && participant.primaryEntityId) {
      setEntityValue(encodeEntity(participant.primaryEntityType, participant.primaryEntityId))
      await loadGrants(id, participant.primaryEntityId)
    } else {
      setEntityValue('')
    }
  }

  async function handleAddGrant(epId: string) {
    const entityId = loadedEntityId
    const uid = userDoc?.uid
    if (!entityId || !uid) return
    setActionError(null)
    try {
      await runAddGrant(async () => {
        if (isSensitivePermission(newPermission)) {
          await requestGrant(epId, entityId, newPermission, newValidFrom, uid)
        } else {
          await grantDirect(epId, entityId, newPermission, newValidFrom, uid)
        }
        setGrants(await listGrantsForEntity(epId, entityId))
      })
    } catch {
      setActionError('Přidání přístupu se nezdařilo.')
    }
  }

  async function handleAction(epId: string, action: 'approve' | 'reject' | 'activate' | 'revoke', grantId: string) {
    const entityId = loadedEntityId
    const uid = userDoc?.uid
    if (!entityId || !uid) return
    setActionError(null)
    setPendingGrantId(grantId)
    try {
      await runAction(async () => {
        if (action === 'approve') await approveGrant(epId, entityId, grantId, uid)
        if (action === 'reject') await rejectGrant(epId, entityId, grantId, uid)
        if (action === 'activate') await activateGrant(epId, entityId, grantId, uid)
        if (action === 'revoke') await revokeGrant(epId, entityId, grantId, uid)
        setGrants(await listGrantsForEntity(epId, entityId))
      })
    } catch {
      setActionError('Akce se nezdařila.')
    }
  }

  if (!organizationId) {
    return (
      <AppShell breadcrumb={[{ label: 'Externisté' }]}>
        <PageHeader title="Externisté" />
        <p className="mt-4 text-sm text-text-secondary">Tahle stránka je pro zaměstnance konkrétní organizace.</p>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumb={[{ label: 'Externisté' }]}>
      <PageHeader
        title="Externí spolupracovníci"
        actions={
          canRequest && (
            <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Zrušit' : (<><Plus size={16} /> Přidat externistu</>)}
            </Button>
          )
        }
      />

      {error && (
        <p className="mt-3 max-w-[560px] text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 flex max-w-[560px] flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
            Dítě nebo pěstoun, ke kterému externista patří
            <Combobox
              options={entityOptions}
              value={formEntityValue}
              onChange={setFormEntityValue}
              placeholder="Vyhledat jméno…"
              emptyText="V organizaci zatím nejsou žádné děti ani pěstouni."
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
            Jméno
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
            E-mail
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
              onBlur={() => {
                const result = checkEmail(email)
                setEmail(result.value)
                setEmailError(result.ok ? null : (result.message ?? null))
              }}
            />
            {emailError && <span className="text-xs text-danger">{emailError}</span>}
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
            Telefon (volitelné)
            <Input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(null) }}
              onBlur={() => {
                const result = checkPhone(phone)
                setPhone(result.value)
                setPhoneError(result.ok ? null : (result.message ?? null))
              }}
            />
            {phoneError && <span className="text-xs text-danger">{phoneError}</span>}
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
            Vztah k rodině (např. prarodič, psycholog, škola)
            <Input required value={relationLabel} onChange={(e) => setRelationLabel(e.target.value)} />
          </label>
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

      <div className="mt-4 max-w-[560px]">
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
                    {participant.primaryEntityLabel && (
                      <p className="mt-0.5 text-xs text-text-tertiary">{participant.primaryEntityLabel}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleExpand(docId, participant)}>
                    {expandedId === docId ? 'Skrýt přístupy' : 'Spravovat přístupy'}
                  </Button>
                </div>

                {expandedId === docId && (
                  <div className="mt-3 flex flex-col gap-3 border-t border-border-subtle pt-3">
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                        Dítě nebo pěstoun
                        <Combobox options={entityOptions} value={entityValue} onChange={setEntityValue} placeholder="Vyhledat jméno…" />
                      </label>
                      <Button size="sm" variant="secondary" className="self-start" onClick={() => loadGrants(docId)}>
                        Načíst přístupy
                      </Button>
                    </div>

                    {actionError && (
                      <p className="text-sm text-danger" role="alert">
                        {actionError}
                      </p>
                    )}

                    {loadedEntityId && (
                      <>
                        {canRequest && (
                          <div className="flex flex-col gap-2">
                            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
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
                            <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
                              Platí od
                              <DatePicker value={newValidFrom} onChange={setNewValidFrom} />
                            </label>
                            <Button
                              size="sm"
                              className="self-start"
                              loading={addingGrant}
                              success={addGrantSuccess}
                              onClick={() => handleAddGrant(docId)}
                            >
                              {isSensitivePermission(newPermission) ? 'Požádat o schválení' : 'Udělit přístup'}
                            </Button>
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          {grants === null ? (
                            <p className="text-sm text-text-secondary">Načítám…</p>
                          ) : grants.length === 0 ? (
                            <p className="text-sm text-text-secondary">Zatím žádný přístup pro tuhle osobu.</p>
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
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        loading={actionLoading && pendingGrantId === grantId}
                                        success={actionSuccess && pendingGrantId === grantId}
                                        onClick={() => handleAction(docId, 'approve', grantId)}
                                      >
                                        Schválit
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        loading={actionLoading && pendingGrantId === grantId}
                                        success={actionSuccess && pendingGrantId === grantId}
                                        onClick={() => handleAction(docId, 'reject', grantId)}
                                      >
                                        Zamítnout
                                      </Button>
                                    </>
                                  )}
                                  {grant.status === 'approved' && canActivate && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      loading={actionLoading && pendingGrantId === grantId}
                                      success={actionSuccess && pendingGrantId === grantId}
                                      onClick={() => handleAction(docId, 'activate', grantId)}
                                    >
                                      Aktivovat
                                    </Button>
                                  )}
                                  {grant.status === 'active' && canApprove && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      loading={actionLoading && pendingGrantId === grantId}
                                      success={actionSuccess && pendingGrantId === grantId}
                                      onClick={() => handleAction(docId, 'revoke', grantId)}
                                    >
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
