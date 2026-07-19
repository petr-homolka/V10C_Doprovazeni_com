import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { getOrganization } from '@/services/organizationService'
import { listStaff } from '@/services/staffService'
import {
  addChildToFamily,
  addFosterPersonToFamily,
  getFamilyByUid,
  listChildrenForFamily,
  listFosterPersonsByRefs,
} from '@/services/familyService'
import { checkKoCapacity, createAgreement, endAgreement, getActiveAgreement } from '@/services/agreementService'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { AgreementDoc, CareType } from '@/types/agreement'
import type { UserDoc } from '@/types/user'
import { Baby, FileText, UserRound } from 'lucide-react'

const FOSTER_COLUMNS = '1fr 1fr 1fr 1fr'
const CHILD_COLUMNS = '1fr 1fr 1fr'

const CARE_TYPE_LABELS: Record<CareType, string> = {
  zprostredkovana: 'Zprostředkovaná (24 h/12 měsíců)',
  nezprostredkovana: 'Nezprostředkovaná — příbuzenská (18 h/12 měsíců)',
}

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
  const [agreement, setAgreement] = useState<AgreementDoc | null>(null)
  const [koOptions, setKoOptions] = useState<UserDoc[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [careType, setCareType] = useState<CareType>('zprostredkovana')
  const [assignedTo, setAssignedTo] = useState('')
  const [capacityNote, setCapacityNote] = useState<string | null>(null)

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
      const [fosters, kids, activeAgreement, staff] = await Promise.all([
        listFosterPersonsByRefs(found.family.fosterPersonRefs),
        listChildrenForFamily(found.docId, organizationId),
        getActiveAgreement(found.docId, organizationId),
        listStaff(organizationId),
      ])
      setFosterPersons(fosters)
      setChildren(kids)
      setAgreement(activeAgreement)
      setKoOptions(staff.filter((s) => s.role === 'klicova_osoba'))
    } catch {
      setError('Detail rodiny se nepodařilo načíst.')
    }
  }

  async function handleAssignedToChange(uid: string) {
    setAssignedTo(uid)
    setCapacityNote(null)
    if (!uid || !organizationId) return
    const capacity = await checkKoCapacity(organizationId, uid)
    if (capacity.overThreshold) {
      setCapacityNote(
        `Pozor: tahle klíčová osoba už má ${capacity.activeCaseload} aktivních rodin (orientační práh je ${capacity.threshold}) — zvažte přerozdělení.`,
      )
    }
  }

  async function handleCreateAgreement(e: FormEvent) {
    e.preventDefault()
    if (!docId || !organizationId) return
    setSubmitting(true)
    setError(null)
    try {
      const org = await getOrganization(organizationId)
      if (!org) throw new Error('org not found')
      await createAgreement({
        familyDocId: docId,
        organizationId,
        orgCode: org.orgCode,
        careType,
        assignedTo: assignedTo || undefined,
      })
      setShowAgreementForm(false)
      setCapacityNote(null)
      await reload()
    } catch {
      setError('Založení Dohody se nezdařilo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEndAgreement() {
    if (!docId || !organizationId) return
    setSubmitting(true)
    setError(null)
    try {
      await endAgreement(docId, organizationId)
      await reload()
    } catch {
      setError('Ukončení Dohody se nezdařilo.')
    } finally {
      setSubmitting(false)
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
          <h2 className="text-lg font-normal leading-tight text-text-primary">Dohoda</h2>
          {!agreement && (
            <Button variant="secondary" size="sm" onClick={() => setShowAgreementForm((v) => !v)}>
              {showAgreementForm ? 'Zrušit' : '+ Založit Dohodu'}
            </Button>
          )}
          {agreement && (
            <Button variant="outline" size="sm" onClick={handleEndAgreement} disabled={submitting}>
              Ukončit Dohodu
            </Button>
          )}
        </div>

        {agreement ? (
          <div className="mt-4 rounded-lg border border-border bg-surface p-5">
            <p className="text-sm text-text-primary">{CARE_TYPE_LABELS[agreement.careType]}</p>
            <p className="mt-1 text-sm text-text-secondary">
              Platí od {new Date(agreement.validFrom).toLocaleDateString('cs-CZ')}
              {agreement.assignedTo &&
                ` · klíčová osoba: ${koOptions.find((k) => k.uid === agreement.assignedTo)?.displayName ?? agreement.assignedTo}`}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Návštěva min. 1× za {agreement.visitIntervalDays} dní · vzdělávání{' '}
              {agreement.educationHoursTarget} h/12 měsíců · zápis do {agreement.noteDeadlineHours} h
            </p>
          </div>
        ) : (
          !showAgreementForm && <EmptyState icon={FileText} text="Zatím žádná Dohoda s vaší organizací." />
        )}

        {showAgreementForm && !agreement && (
          <form
            onSubmit={handleCreateAgreement}
            className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
          >
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Typ péče</span>
                <select
                  value={careType}
                  onChange={(e) => setCareType(e.target.value as CareType)}
                  className="h-10 w-full rounded-sm border border-border-medium bg-inset px-3 text-text-primary"
                >
                  {(Object.keys(CARE_TYPE_LABELS) as CareType[]).map((ct) => (
                    <option key={ct} value={ct}>
                      {CARE_TYPE_LABELS[ct]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Klíčová osoba</span>
                <select
                  value={assignedTo}
                  onChange={(e) => handleAssignedToChange(e.target.value)}
                  className="h-10 w-full rounded-sm border border-border-medium bg-inset px-3 text-text-primary"
                >
                  <option value="">Nepřiřazeno</option>
                  {koOptions.map((ko) => (
                    <option key={ko.uid} value={ko.uid}>
                      {ko.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {capacityNote && <p className="text-sm text-warning">{capacityNote}</p>}
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? 'Zakládám…' : 'Založit Dohodu'}
            </Button>
          </form>
        )}
      </section>

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
