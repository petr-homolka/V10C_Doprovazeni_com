import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { getOrganization } from '@/services/organizationService'
import {
  addChildToFamily,
  addFosterPersonToFamily,
  getFamilyByUid,
  listChildrenForFamily,
  listFosterPersonsByRefs,
} from '@/services/familyService'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import { Baby, UserRound } from 'lucide-react'

const FOSTER_COLUMNS = '1fr 1fr 1fr 1fr'
const CHILD_COLUMNS = '1fr 1fr 1fr'

/**
 * /rodiny/:familyUid — M1 základ. `familyUid` v URL je vždy human-facing
 * `uid` (§4.3 pozn. 1), viz getFamilyByUid. Pěstouni a děti se přidávají
 * přímo tady — je to jeden kontextový celek, ne tři samostatné stránky.
 */
export default function FamilyDetailPage() {
  const { familyUid } = useParams<{ familyUid: string }>()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [docId, setDocId] = useState<string | null>(null)
  const [family, setFamily] = useState<FamilyDoc | null>(null)
  const [fosterPersons, setFosterPersons] = useState<FosterPersonDoc[]>([])
  const [children, setChildren] = useState<ChildDoc[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [showFosterForm, setShowFosterForm] = useState(false)
  const [fosterFirstName, setFosterFirstName] = useState('')
  const [fosterLastName, setFosterLastName] = useState('')
  const [fosterPhone, setFosterPhone] = useState('')
  const [fosterEmail, setFosterEmail] = useState('')

  const [showChildForm, setShowChildForm] = useState(false)
  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childBirthNumber, setChildBirthNumber] = useState('')

  const [submitting, setSubmitting] = useState(false)

  async function reload() {
    if (!familyUid || !organizationId) return
    setError(null)
    try {
      const found = await getFamilyByUid(familyUid, organizationId)
      if (!found) {
        setNotFound(true)
        return
      }
      setDocId(found.docId)
      setFamily(found.family)
      const [fosters, kids] = await Promise.all([
        listFosterPersonsByRefs(found.family.fosterPersonRefs),
        listChildrenForFamily(found.docId, organizationId),
      ])
      setFosterPersons(fosters)
      setChildren(kids)
    } catch {
      setError('Detail rodiny se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyUid, organizationId])

  async function handleAddFoster(e: FormEvent) {
    e.preventDefault()
    if (!docId || !organizationId) return
    setSubmitting(true)
    setError(null)
    try {
      const org = await getOrganization(organizationId)
      if (!org) throw new Error('org not found')
      await addFosterPersonToFamily(docId, organizationId, org.orgCode, {
        firstName: fosterFirstName,
        lastName: fosterLastName,
        phone: fosterPhone || undefined,
        email: fosterEmail || undefined,
      })
      setFosterFirstName('')
      setFosterLastName('')
      setFosterPhone('')
      setFosterEmail('')
      setShowFosterForm(false)
      await reload()
    } catch {
      setError('Přidání pěstouna se nezdařilo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddChild(e: FormEvent) {
    e.preventDefault()
    if (!docId || !organizationId) return
    setSubmitting(true)
    setError(null)
    try {
      const org = await getOrganization(organizationId)
      if (!org) throw new Error('org not found')
      await addChildToFamily(docId, organizationId, org.orgCode, {
        firstName: childFirstName,
        lastName: childLastName,
        birthNumber: childBirthNumber,
      })
      setChildFirstName('')
      setChildLastName('')
      setChildBirthNumber('')
      setShowChildForm(false)
      await reload()
    } catch {
      setError('Přidání dítěte se nezdařilo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (notFound) {
    return (
      <AppShell breadcrumb={[{ label: 'Rodiny', href: '/rodiny' }, { label: 'Nenalezeno' }]}>
        <p className="text-sm text-text-secondary">Tenhle Spis se nepodařilo najít.</p>
      </AppShell>
    )
  }

  return (
    <AppShell
      breadcrumb={[{ label: 'Rodiny', href: '/rodiny' }, { label: familyUid ?? '' }]}
    >
      <h1 className="font-mono text-lg font-normal leading-normal text-text-primary">
        {familyUid}
      </h1>
      {family?.address && <p className="mt-1 text-sm text-text-secondary">{family.address}</p>}

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-normal leading-tight text-text-primary">Pěstouni</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowFosterForm((v) => !v)}>
            {showFosterForm ? 'Zrušit' : '+ Přidat pěstouna'}
          </Button>
        </div>

        {showFosterForm && (
          <form
            onSubmit={handleAddFoster}
            className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
          >
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
                <Input required value={fosterFirstName} onChange={(e) => setFosterFirstName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Příjmení</span>
                <Input required value={fosterLastName} onChange={(e) => setFosterLastName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Telefon</span>
                <Input value={fosterPhone} onChange={(e) => setFosterPhone(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">E-mail</span>
                <Input type="email" value={fosterEmail} onChange={(e) => setFosterEmail(e.target.value)} />
              </label>
            </div>
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? 'Přidávám…' : 'Přidat'}
            </Button>
          </form>
        )}

        <div className="mt-4">
          {fosterPersons.length === 0 ? (
            <EmptyState icon={UserRound} text="Zatím žádní pěstouni." />
          ) : (
            <Table>
              <TableHeaderRow columns={FOSTER_COLUMNS} labels={['UID', 'Jméno', 'Telefon', 'E-mail']} />
              {fosterPersons.map((fp) => (
                <TableRow key={fp.uid} columns={FOSTER_COLUMNS}>
                  <span className="font-mono text-sm text-text-primary">{fp.uid}</span>
                  <span className="text-sm text-text-primary">
                    {fp.firstName} {fp.lastName}
                  </span>
                  <span className="text-sm text-text-secondary">{fp.phone || '—'}</span>
                  <span className="truncate text-sm text-text-secondary">{fp.email || '—'}</span>
                </TableRow>
              ))}
            </Table>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-normal leading-tight text-text-primary">Svěřené děti</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowChildForm((v) => !v)}>
            {showChildForm ? 'Zrušit' : '+ Přidat dítě'}
          </Button>
        </div>

        {showChildForm && (
          <form
            onSubmit={handleAddChild}
            className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
          >
            <div className="grid grid-cols-3 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Jméno</span>
                <Input required value={childFirstName} onChange={(e) => setChildFirstName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Příjmení</span>
                <Input required value={childLastName} onChange={(e) => setChildLastName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Rodné číslo</span>
                <Input required value={childBirthNumber} onChange={(e) => setChildBirthNumber(e.target.value)} />
              </label>
            </div>
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? 'Přidávám…' : 'Přidat'}
            </Button>
          </form>
        )}

        <div className="mt-4">
          {children.length === 0 ? (
            <EmptyState icon={Baby} text="Zatím žádné svěřené děti." />
          ) : (
            <Table>
              <TableHeaderRow columns={CHILD_COLUMNS} labels={['UID', 'Jméno', 'Rodné číslo']} />
              {children.map((child) => (
                <TableRow key={child.uid} columns={CHILD_COLUMNS}>
                  <span className="font-mono text-sm text-text-primary">{child.uid}</span>
                  <span className="text-sm text-text-primary">
                    {child.firstName} {child.lastName}
                  </span>
                  <span className="text-sm text-text-secondary">{child.birthNumber}</span>
                </TableRow>
              ))}
            </Table>
          )}
        </div>
      </section>
    </AppShell>
  )
}
