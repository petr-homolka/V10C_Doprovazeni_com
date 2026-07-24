import { useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SidePanel } from '@/components/ui/side-panel'
import { RecordCard, RecordCardList } from '@/components/ui/record-card'
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
import { setCollaboratorModules } from '@/services/collaboratorService'
import { listActiveCaseloadByKo } from '@/services/agreementService'
import { getOrganization, getPlatformDefaults } from '@/services/organizationService'
import { computeEffectiveCapacityThreshold } from '@/lib/capacityThreshold'
import { DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD } from '@/types/platformDefaults'
import { checkEmail } from '@/lib/contactValidation'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { Plus, UserCog } from 'lucide-react'

// Org_admin nepřiděluje `superadmin` (platformní role) — viz firestore.rules.
const ASSIGNABLE_ROLES = STAFF_ROLES.filter((r) => r !== 'superadmin')

type PanelState =
  | { mode: 'create' }
  | { mode: 'capacity'; member: UserDoc }
  | { mode: 'modules'; member: UserDoc }
  | null

/**
 * /zamestnanci — M1, §5.7 "Nastavení ≠ Správa entit": vlastní stránka
 * appky (seznam, ne záložka v Nastavení). Všichni zaměstnanci vidí
 * týmový seznam (read-only), jen `org_admin` vidí formulář na založení
 * a může měnit stav (aktivní/zablokován) — přesně dle firestore.rules.
 *
 * Cesta D, třetí kolo (2026-07-24, přímé přání Petra "Cokoli se zadává
 * do systému... v pravém schovávacím sidebaru") — Table nahrazena
 * RecordCardList, všechny tři formuláře (založení/kapacita/moduly) teď
 * žijou v JEDNOM sdíleném pravém `SidePanel`u (stejný vzor jako
 * "Nová událost" v Kalendáři), místo tří nezávislých inline formulářů
 * pod hlavičkou.
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
      <AppShell breadcrumb={[{ label: 'Zaměstnanci' }]}>
        <h1 className="text-[26px] font-bold leading-tight text-text-primary">Zaměstnanci</h1>
        <p className="mt-4 text-sm text-text-secondary">
          Tahle stránka je pro zaměstnance konkrétní organizace.
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumb={[{ label: 'Zaměstnanci' }]} fullBleed>
      <div className="flex h-full min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h1 className="font-heading text-[26px] font-bold leading-tight text-text-primary">Zaměstnanci</h1>
              {isOrgAdmin && (
                <Button size="sm" onClick={openCreate}>
                  <Plus size={16} /> Přidat zaměstnance
                </Button>
              )}
            </div>

            {error && (
              <p className="mb-3 max-w-xl text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            {staff === null ? (
              <p className="text-sm text-text-secondary">Načítám…</p>
            ) : staff.length === 0 ? (
              <div className="rounded-lg bg-surface-soft p-8 shadow-raised">
                <EmptyState icon={UserCog} text="Zatím tu nejsou žádní zaměstnanci." />
              </div>
            ) : (
              <RecordCardList>
                {staff.map((member) => {
                  const activeCaseload = caseloadByKo[member.uid] ?? 0
                  const threshold = computeEffectiveCapacityThreshold(
                    member.fte,
                    member.capacityThresholdOverride,
                    orgThreshold,
                    platformThreshold,
                  )
                  return (
                    <RecordCard
                      key={member.uid}
                      leading={<EntityAvatar label={member.displayName} />}
                      title={member.displayName}
                      subtitle={member.email}
                      meta={
                        <>
                          <div className="hidden text-right sm:block">
                            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Role</p>
                            <p className="text-sm text-text-secondary">{STAFF_ROLE_LABELS[member.role as StaffRole]}</p>
                          </div>
                          <span
                            className={
                              member.disabledAt
                                ? 'text-sm font-medium text-danger'
                                : 'text-sm font-medium text-success'
                            }
                          >
                            {member.disabledAt ? 'Zablokován' : 'Aktivní'}
                          </span>
                          {member.role === 'spolupracovnik' ? (
                            isOrgAdmin && (
                              <Button variant="ghost" size="sm" onClick={() => openModulesEdit(member)} className="w-fit">
                                Moduly
                              </Button>
                            )
                          ) : isOrgAdmin ? (
                            <button
                              type="button"
                              onClick={() => openCapacityEdit(member)}
                              title="Upravit kapacitu"
                              className="w-fit"
                            >
                              <CapacityRing value={activeCaseload} max={threshold} />
                            </button>
                          ) : (
                            <CapacityRing value={activeCaseload} max={threshold} />
                          )}
                        </>
                      }
                      trailing={
                        isOrgAdmin && member.role !== 'org_admin' ? (
                          <Button variant="ghost" size="sm" onClick={() => handleToggleDisabled(member)}>
                            {member.disabledAt ? 'Odblokovat' : 'Zablokovat'}
                          </Button>
                        ) : undefined
                      }
                    />
                  )
                })}
              </RecordCardList>
            )}
          </div>
        </div>

        {panel?.mode === 'create' && (
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
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
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
        )}

        {panel?.mode === 'capacity' && (
          <SidePanel title={`Kapacita — ${panel.member.displayName}`} onClose={() => setPanel(null)}>
            <form onSubmit={handleSaveCapacity} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Úvazek (FTE)</span>
                <Input
                  type="number"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={editFte}
                  onChange={(e) => setEditFte(e.target.value)}
                />
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
        )}

        {panel?.mode === 'modules' && (
          <SidePanel title={`Moduly — ${panel.member.displayName}`} onClose={() => setPanel(null)}>
            <form onSubmit={handleSaveModules} className="flex flex-col gap-4">
              <p className="text-xs text-text-tertiary">
                Co spolupracovník vidí/může u osob, co mu přiřadíte (Rodina → profil dítěte/pěstouna →
                "Přiřadit spolupracovníkovi").
              </p>
              <div className="flex flex-col gap-2">
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
        )}
      </div>
    </AppShell>
  )
}
