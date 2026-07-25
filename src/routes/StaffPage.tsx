import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { PageBody, PageHead } from '@/components/spis/PageBody'
import { SidePanel } from '@/components/ui/side-panel'
import { RecordCard, RecordCardList } from '@/components/ui/record-card'
import { RowMenu, type RowMenuItem } from '@/components/ui/row-menu'
import { PersonLink } from '@/components/ui/person-link'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { CapacityRing } from '@/components/ui/capacity-ring'
import { useAuth } from '@/hooks/useAuth'
import { STAFF_ROLES, STAFF_ROLE_LABELS, type StaffRole, type UserDoc } from '@/types/user'
import { COLLABORATOR_MODULE_KEYS, COLLABORATOR_MODULE_LABELS, type CollaboratorModuleKey } from '@/types/collaborator'
import { createStaffMember, listStaff, setStaffMemberDisabled, updateStaffCapacitySettings } from '@/services/staffService'
import { uploadUserAvatar } from '@/services/avatarService'
import { setCollaboratorModules } from '@/services/collaboratorService'
import { listActiveCaseloadByKo } from '@/services/agreementService'
import { getOrganization, getPlatformDefaults } from '@/services/organizationService'
import { computeEffectiveCapacityThreshold } from '@/lib/capacityThreshold'
import { DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD } from '@/types/platformDefaults'
import { checkEmail } from '@/lib/contactValidation'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { Plus, UserCog } from '@/components/ui/icons'

// Org_admin nepřiděluje `superadmin` (platformní role) — viz firestore.rules.
const ASSIGNABLE_ROLES = STAFF_ROLES.filter((r) => r !== 'superadmin')

type PanelState =
  | { mode: 'create' }
  | { mode: 'capacity'; member: UserDoc }
  | { mode: 'modules'; member: UserDoc }
  | null

/**
 * /zamestnanci — všichni zaměstnanci vidí týmový seznam (read-only), jen
 * `org_admin` vidí formulář na založení a může měnit stav (aktivní/
 * zablokován) — přesně dle firestore.rules.
 */
export default function StaffPage() {
  const { userDoc } = useAuth()
  const [staff, setStaff] = useState<UserDoc[] | null>(null)
  const [caseloadByKo, setCaseloadByKo] = useState<Record<string, number>>({})
  const [orgThreshold, setOrgThreshold] = useState<number | null | undefined>(undefined)
  const [platformThreshold, setPlatformThreshold] = useState(DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<PanelState>(null)
  const { loading: creating, success: createSuccess, run: runCreate } = useAsyncSubmit()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('zamestnanec')

  const [editFte, setEditFte] = useState('1')
  const [editOverride, setEditOverride] = useState('')
  const { loading: savingCapacity, success: saveCapacitySuccess, run: runSaveCapacity } = useAsyncSubmit()

  const [editModules, setEditModules] = useState<Partial<Record<CollaboratorModuleKey, boolean>>>({})
  const { loading: savingModules, success: saveModulesSuccess, run: runSaveModules } = useAsyncSubmit()

  const organizationId = userDoc?.organizationId
  const isOrgAdmin = userDoc?.role === 'org_admin'

  const photoFileRef = useRef<HTMLInputElement>(null)
  const photoForRef = useRef<string | null>(null)

  function startPhotoUpload(uid: string) {
    photoForRef.current = uid
    photoFileRef.current?.click()
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const uid = photoForRef.current
    if (!file || !uid) return
    setError(null)
    try {
      await uploadUserAvatar(uid, file)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotku se nepodařilo nahrát.')
    }
  }

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      const [staffList, caseload, org, platformDefaults] = await Promise.all([
        listStaff(organizationId),
        listActiveCaseloadByKo(organizationId),
        getOrganization(organizationId),
        getPlatformDefaults(),
      ])
      setStaff(staffList)
      setCaseloadByKo(caseload)
      setOrgThreshold(org?.koCapacityThreshold)
      setPlatformThreshold(platformDefaults?.koCapacityThreshold ?? DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD)
    } catch {
      setError('Seznam zaměstnanců se nepodařilo načíst.')
    }
  }

  function openCreate() {
    setDisplayName('')
    setEmail('')
    setEmailError(null)
    setPassword('')
    setRole('zamestnanec')
    setPanel({ mode: 'create' })
  }

  function openCapacityEdit(member: UserDoc) {
    setEditFte(String(member.fte ?? 1))
    setEditOverride(member.capacityThresholdOverride != null ? String(member.capacityThresholdOverride) : '')
    setPanel({ mode: 'capacity', member })
  }

  function openModulesEdit(member: UserDoc) {
    setEditModules(member.collaboratorModules ?? {})
    setPanel({ mode: 'modules', member })
  }

  async function handleSaveCapacity(e: FormEvent) {
    e.preventDefault()
    if (panel?.mode !== 'capacity') return
    setError(null)
    try {
      await runSaveCapacity(async () => {
        const fte = Math.min(1, Math.max(0.1, Number(editFte) || 1))
        const override = editOverride.trim() === '' ? null : Number(editOverride)
        await updateStaffCapacitySettings(panel.member.uid, fte, override)
        await reload()
      })
      setPanel(null)
    } catch {
      setError('Nastavení kapacity se nepodařilo uložit.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function handleSaveModules(e: FormEvent) {
    e.preventDefault()
    if (panel?.mode !== 'modules') return
    setError(null)
    try {
      await runSaveModules(async () => {
        await setCollaboratorModules(panel.member.uid, editModules)
        await reload()
      })
      setPanel(null)
    } catch {
      setError('Moduly se nepodařilo uložit.')
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!organizationId) return
    const emailCheck = checkEmail(email)
    setEmail(emailCheck.value)
    setEmailError(emailCheck.ok ? null : emailCheck.message ?? null)
    if (!emailCheck.ok) return
    setError(null)
    try {
      await runCreate(async () => {
        await createStaffMember({ email: emailCheck.value, password, displayName, role, organizationId })
        await reload()
      })
      setDisplayName('')
      setEmail('')
      setPassword('')
      setRole('zamestnanec')
      setPanel(null)
    } catch {
      setError('Založení zaměstnance se nezdařilo. Zkontrolujte údaje.')
    }
  }

  async function handleToggleDisabled(member: UserDoc) {
    try {
      await setStaffMemberDisabled(member.uid, !member.disabledAt)
      await reload()
    } catch {
      setError('Změnu stavu se nepodařilo uložit.')
    }
  }

  if (!organizationId) {
    return (
      <AppShell>
        <h1 className="text-2xl text-text-primary">Zaměstnanci</h1>
        <p className="mt-4 text-sm text-text-secondary">
          Tahle stránka je pro zaměstnance konkrétní organizace.
        </p>
      </AppShell>
    )
  }

  const sidePanel =
    panel?.mode === 'create' ? (
      <SidePanel title="Přidat zaměstnance" onClose={() => setPanel(null)}>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
            <Input required autoFocus value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Role</span>
            <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">E-mail</span>
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
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Dočasné heslo</span>
            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-border-default pt-4">
            <Button type="submit" loading={creating} success={createSuccess}>
              Založit účet
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPanel(null)} disabled={creating}>
              Zrušit
            </Button>
          </div>
        </form>
      </SidePanel>
    ) : panel?.mode === 'capacity' ? (
      <SidePanel title={`Kapacita — ${panel.member.displayName}`} onClose={() => setPanel(null)}>
        <form onSubmit={handleSaveCapacity} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Úvazek (FTE)</span>
            <Input type="number" min={0.1} max={1} step={0.1} value={editFte} onChange={(e) => setEditFte(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Vlastní práh (nepovinné)</span>
            <Input
              type="number"
              min={1}
              placeholder={`výchozí: ${orgThreshold ?? platformThreshold}`}
              value={editOverride}
              onChange={(e) => setEditOverride(e.target.value)}
            />
          </label>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-border-default pt-4">
            <Button type="submit" loading={savingCapacity} success={saveCapacitySuccess}>
              Uložit
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPanel(null)} disabled={savingCapacity}>
              Zrušit
            </Button>
          </div>
        </form>
      </SidePanel>
    ) : panel?.mode === 'modules' ? (
      <SidePanel title={`Moduly — ${panel.member.displayName}`} onClose={() => setPanel(null)}>
        <form onSubmit={handleSaveModules} className="flex flex-col gap-4">
          <p className="text-xs text-text-tertiary">
            Co spolupracovník vidí/může u osob, co mu přiřadíte (Rodina → profil dítěte/pěstouna →
            "Přiřadit spolupracovníkovi").
          </p>
          <div className="flex flex-col gap-2 rounded-lg bg-inset p-3">
            {COLLABORATOR_MODULE_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={editModules[key] === true}
                  onChange={(e) => setEditModules((m) => ({ ...m, [key]: e.target.checked }))}
                  className="size-4 rounded-sm border-border-medium accent-primary"
                />
                {COLLABORATOR_MODULE_LABELS[key]}
              </label>
            ))}
          </div>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 border-t border-border-default pt-4">
            <Button type="submit" loading={savingModules} success={saveModulesSuccess}>
              Uložit
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPanel(null)} disabled={savingModules}>
              Zrušit
            </Button>
          </div>
        </form>
      </SidePanel>
    ) : undefined

  return (
    <AppShell fullBleed sidePanel={sidePanel}>
      <PageBody>
        <PageHead
          title="Zaměstnanci"
          count={staff?.length}
          actions={
            isOrgAdmin && (
              <Button onClick={openCreate}>
                <Plus size={17} /> Přidat zaměstnance
              </Button>
            )
          }
        >
          {error && (
            <p className="max-w-xl text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </PageHead>

            <input
              ref={photoFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoFile}
            />

            {staff === null ? (
              <p className="text-sm text-text-secondary">Načítám…</p>
            ) : staff.length === 0 ? (
              <div className="rounded-lg bg-surface-soft p-8 shadow-raised">
                <EmptyState icon={UserCog} text="Zatím tu nejsou žádní zaměstnanci." />
              </div>
            ) : (
              <RecordCardList
                cellCount={2}
                headers={['Role', 'Kapacita']}
                lead={32}
                trail={32}
                columns={{
                  lg: 'minmax(220px,1fr) minmax(0,200px) minmax(0,110px)',
                  md: 'minmax(200px,1fr) minmax(0,180px)',
                  sm: 'minmax(180px,1fr) minmax(0,170px)',
                }}
              >
                {staff.map((member) => {
                  const activeCaseload = caseloadByKo[member.uid] ?? 0
                  const threshold = computeEffectiveCapacityThreshold(
                    member.fte,
                    member.capacityThresholdOverride,
                    orgThreshold,
                    platformThreshold,
                  )
                  const isCollaborator = member.role === 'spolupracovnik'
                  const canEditPhoto = isOrgAdmin || member.uid === userDoc?.uid
                  const menuItems: RowMenuItem[] = []
                  if (canEditPhoto) menuItems.push({ label: 'Nahrát fotku', onSelect: () => startPhotoUpload(member.uid) })
                  if (isOrgAdmin && isCollaborator) menuItems.push({ label: 'Upravit moduly', onSelect: () => openModulesEdit(member) })
                  if (isOrgAdmin && !isCollaborator) menuItems.push({ label: 'Upravit kapacitu', onSelect: () => openCapacityEdit(member) })
                  if (isOrgAdmin && member.role !== 'org_admin') {
                    menuItems.push({
                      label: member.disabledAt ? 'Odblokovat' : 'Zablokovat',
                      onSelect: () => handleToggleDisabled(member),
                      danger: !member.disabledAt,
                    })
                  }
                  return (
                    <RecordCard
                      key={member.uid}
                      leading={<EntityAvatar photoURL={member.avatarUrl} label={member.displayName} fallbackIcon={UserCog} />}
                      title={<PersonLink kind="staff" id={member.uid} name={member.displayName} />}
                      subtitle={
                        <>
                          {member.email}
                          {/* „Zablokován" je výjimka, ne sloupec — sloupec by
                           * byl 95 % času prázdný a na užší šířce by zmizel
                           * právě ta informace, na které záleží. */}
                          {member.disabledAt && <span className="font-medium text-danger"> · Zablokován</span>}
                        </>
                      }
                      cells={[
                        {
                          label: 'Role',
                          value: (
                            <span className="inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                              {STAFF_ROLE_LABELS[member.role as StaffRole]}
                            </span>
                          ),
                        },
                        {
                          label: 'Kapacita',
                          value: isCollaborator ? '—' : <CapacityRing value={activeCaseload} max={threshold} />,
                        },
                      ]}
                      trailing={<RowMenu items={menuItems} />}
                    />
                  )
                })}
              </RecordCardList>
            )}
      </PageBody>
    </AppShell>
  )
}
