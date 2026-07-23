import { useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
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

const TABLE_COLUMNS = '1.3fr 1.3fr 1.1fr 0.7fr 70px 100px'

/**
 * /zamestnanci — M1, §5.7 "Nastavení ≠ Správa entit": vlastní stránka
 * appky (tabulka, ne záložka v Nastavení). Všichni zaměstnanci vidí
 * týmový seznam (read-only), jen `org_admin` vidí formulář na založení
 * a může měnit stav (aktivní/zablokován) — přesně dle firestore.rules.
 */
export default function StaffPage() {
  const { userDoc } = useAuth()
  const [staff, setStaff] = useState<UserDoc[] | null>(null)
  const [caseloadByKo, setCaseloadByKo] = useState<Record<string, number>>({})
  const [orgThreshold, setOrgThreshold] = useState<number | null | undefined>(undefined)
  const [platformThreshold, setPlatformThreshold] = useState(DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { loading: creating, success: createSuccess, run: runCreate } = useAsyncSubmit()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('zamestnanec')

  const [editingMember, setEditingMember] = useState<UserDoc | null>(null)
  const [editFte, setEditFte] = useState('1')
  const [editOverride, setEditOverride] = useState('')
  const { loading: savingCapacity, success: saveCapacitySuccess, run: runSaveCapacity } = useAsyncSubmit()

  const [editingModulesFor, setEditingModulesFor] = useState<UserDoc | null>(null)
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

  function openCapacityEdit(member: UserDoc) {
    setEditingMember(member)
    setEditFte(String(member.fte ?? 1))
    setEditOverride(member.capacityThresholdOverride != null ? String(member.capacityThresholdOverride) : '')
  }

  async function handleSaveCapacity(e: FormEvent) {
    e.preventDefault()
    if (!editingMember) return
    setError(null)
    try {
      await runSaveCapacity(async () => {
        const fte = Math.min(1, Math.max(0.1, Number(editFte) || 1))
        const override = editOverride.trim() === '' ? null : Number(editOverride)
        await updateStaffCapacitySettings(editingMember.uid, fte, override)
        await reload()
      })
      setEditingMember(null)
    } catch {
      setError('Nastavení kapacity se nepodařilo uložit.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  function openModulesEdit(member: UserDoc) {
    setEditingModulesFor(member)
    setEditModules(member.collaboratorModules ?? {})
  }

  async function handleSaveModules(e: FormEvent) {
    e.preventDefault()
    if (!editingModulesFor) return
    setError(null)
    try {
      await runSaveModules(async () => {
        await setCollaboratorModules(editingModulesFor.uid, editModules)
        await reload()
      })
      setEditingModulesFor(null)
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
      setShowForm(false)
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
    <AppShell breadcrumb={[{ label: 'Zaměstnanci' }]}>
      <PageHeader
        title="Zaměstnanci"
        actions={
          isOrgAdmin && (
            <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Zrušit' : (<><Plus size={16} /> Přidat zaměstnance</>)}
            </Button>
          )
        }
      />

      {error && (
        <p className="mt-3 max-w-xl text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {showForm && isOrgAdmin && (
        <form
          onSubmit={handleCreate}
          className="mt-4 flex flex-col max-w-[560px] gap-4 rounded-lg border border-border bg-surface p-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
              <Input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Role</span>
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
              >
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
          </div>
          <Button type="submit" loading={creating} success={createSuccess} className="w-fit">
            Založit účet
          </Button>
        </form>
      )}

      {editingMember && (
        <form
          onSubmit={handleSaveCapacity}
          className="mt-4 flex flex-col max-w-[560px] gap-4 rounded-lg border border-border bg-surface p-5"
        >
          <p className="text-sm font-medium text-text-primary">
            Kapacita — {editingMember.displayName}
          </p>
          <div className="grid grid-cols-2 gap-4">
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
              <span className="text-sm font-medium leading-relaxed text-text-primary">
                Vlastní práh (nepovinné)
              </span>
              <Input
                type="number"
                min={1}
                placeholder={`výchozí: ${orgThreshold ?? platformThreshold}`}
                value={editOverride}
                onChange={(e) => setEditOverride(e.target.value)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={savingCapacity} success={saveCapacitySuccess} className="w-fit">
              Uložit
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditingMember(null)} className="w-fit">
              Zrušit
            </Button>
          </div>
        </form>
      )}

      {editingModulesFor && (
        <form
          onSubmit={handleSaveModules}
          className="mt-4 flex flex-col max-w-[560px] gap-4 rounded-lg border border-border bg-surface p-5"
        >
          <p className="text-sm font-medium text-text-primary">
            Moduly — {editingModulesFor.displayName}
          </p>
          <p className="text-xs text-text-tertiary">
            Co spolupracovník vidí/může u osob, co mu přiřadíte (Rodina → profil dítěte/pěstouna → "Přiřadit spolupracovníkovi").
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
          <div className="flex gap-2">
            <Button type="submit" loading={savingModules} success={saveModulesSuccess} className="w-fit">
              Uložit
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditingModulesFor(null)} className="w-fit">
              Zrušit
            </Button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {staff === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : staff.length === 0 ? (
          <EmptyState icon={UserCog} text="Zatím tu nejsou žádní zaměstnanci." />
        ) : (
          <Table>
            <TableHeaderRow
              columns={TABLE_COLUMNS}
              labels={['Jméno', 'E-mail', 'Role', 'Stav', 'Kapacita', '']}
            />
            {staff.map((member) => {
              const activeCaseload = caseloadByKo[member.uid] ?? 0
              const threshold = computeEffectiveCapacityThreshold(
                member.fte,
                member.capacityThresholdOverride,
                orgThreshold,
                platformThreshold,
              )
              return (
                <TableRow key={member.uid} columns={TABLE_COLUMNS}>
                  <span className="text-sm font-medium text-text-primary">{member.displayName}</span>
                  <span className="truncate text-sm text-text-secondary">{member.email}</span>
                  <span className="text-sm text-text-primary">{STAFF_ROLE_LABELS[member.role as StaffRole]}</span>
                  <span className={member.disabledAt ? 'text-sm text-danger' : 'text-sm text-success'}>
                    {member.disabledAt ? 'Zablokován' : 'Aktivní'}
                  </span>
                  {member.role === 'spolupracovnik' ? (
                    isOrgAdmin ? (
                      <Button variant="ghost" size="sm" onClick={() => openModulesEdit(member)} className="w-fit">
                        Moduly
                      </Button>
                    ) : (
                      <span />
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
                  {isOrgAdmin && member.role !== 'org_admin' ? (
                    <Button variant="ghost" size="sm" onClick={() => handleToggleDisabled(member)}>
                      {member.disabledAt ? 'Odblokovat' : 'Zablokovat'}
                    </Button>
                  ) : (
                    <span />
                  )}
                </TableRow>
              )
            })}
          </Table>
        )}
      </div>
    </AppShell>
  )
}
