import { useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { STAFF_ROLES, STAFF_ROLE_LABELS, type StaffRole, type UserDoc } from '@/types/user'
import { createStaffMember, listStaff, setStaffMemberDisabled } from '@/services/staffService'
import { UserCog } from 'lucide-react'

// Org_admin nepřiděluje `superadmin` (platformní role) — viz firestore.rules.
const ASSIGNABLE_ROLES = STAFF_ROLES.filter((r) => r !== 'superadmin')

const TABLE_COLUMNS = '1.5fr 1.5fr 1.3fr 0.8fr 100px'

/**
 * /zamestnanci — M1, §5.7 "Nastavení ≠ Správa entit": vlastní stránka
 * appky (tabulka, ne záložka v Nastavení). Všichni zaměstnanci vidí
 * týmový seznam (read-only), jen `org_admin` vidí formulář na založení
 * a může měnit stav (aktivní/zablokován) — přesně dle firestore.rules.
 */
export default function StaffPage() {
  const { userDoc } = useAuth()
  const [staff, setStaff] = useState<UserDoc[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('zamestnanec')

  const organizationId = userDoc?.organizationId
  const isOrgAdmin = userDoc?.role === 'org_admin'

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      setStaff(await listStaff(organizationId))
    } catch {
      setError('Seznam zaměstnanců se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!organizationId) return
    setSubmitting(true)
    setError(null)
    try {
      await createStaffMember({ email, password, displayName, role, organizationId })
      setDisplayName('')
      setEmail('')
      setPassword('')
      setRole('zamestnanec')
      setShowForm(false)
      await reload()
    } catch {
      setError('Založení zaměstnance se nezdařilo. Zkontrolujte údaje.')
    } finally {
      setSubmitting(false)
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
        <h1 className="text-lg font-normal leading-normal text-text-primary">Zaměstnanci</h1>
        <p className="mt-4 text-sm text-text-secondary">
          Tahle stránka je pro zaměstnance konkrétní organizace.
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumb={[{ label: 'Zaměstnanci' }]}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-normal leading-normal text-text-primary">Zaměstnanci</h1>
        {isOrgAdmin && (
          <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Zrušit' : '+ Přidat zaměstnance'}
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {showForm && isOrgAdmin && (
        <form
          onSubmit={handleCreate}
          className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
              <Input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
                className="h-10 w-full rounded-sm border border-border-medium bg-inset px-3 text-text-primary"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {STAFF_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">E-mail</span>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? 'Zakládám…' : 'Založit účet'}
          </Button>
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
              labels={['Jméno', 'E-mail', 'Role', 'Stav', '']}
            />
            {staff.map((member) => (
              <TableRow key={member.uid} columns={TABLE_COLUMNS}>
                <span className="text-sm font-medium text-text-primary">{member.displayName}</span>
                <span className="truncate text-sm text-text-secondary">{member.email}</span>
                <span className="text-sm text-text-primary">{STAFF_ROLE_LABELS[member.role as StaffRole]}</span>
                <span className={member.disabledAt ? 'text-sm text-danger' : 'text-sm text-success'}>
                  {member.disabledAt ? 'Zablokován' : 'Aktivní'}
                </span>
                {isOrgAdmin && member.role !== 'org_admin' ? (
                  <Button variant="ghost" size="sm" onClick={() => handleToggleDisabled(member)}>
                    {member.disabledAt ? 'Odblokovat' : 'Zablokovat'}
                  </Button>
                ) : (
                  <span />
                )}
              </TableRow>
            ))}
          </Table>
        )}
      </div>
    </AppShell>
  )
}
