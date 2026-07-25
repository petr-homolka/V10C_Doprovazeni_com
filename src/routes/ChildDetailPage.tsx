import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { Tabs, type TabItem } from '@/components/ui/tabs'
import { EditableAvatar } from '@/components/ui/editable-avatar'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { ChildSupportSection } from '@/components/family/ChildSupportSection'
import { ChildHandoversSection } from '@/components/family/ChildHandoversSection'
import { EntityAgenda } from '@/components/calendar/EntityAgenda'
import { EntityTasks } from '@/components/tasks/EntityTasks'
import { useAuth } from '@/hooks/useAuth'
import { getChild, getFamilyByUid, listFosterPersonsByRefs, updateChildBirthDate } from '@/services/familyService'
import { getChildRespitDaysForYear } from '@/services/respitEventService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { birthDateFromBirthNumber } from '@/lib/birthNumber'
import type { FamilyDoc } from '@/types/family'
import type { ChildDoc } from '@/types/child'
import { Baby, Calendar, CheckSquare, Handshake, Receipt, UserSquare2 } from '@/components/ui/icons'

const SECTIONS: TabItem[] = [
  { key: 'prehled', label: 'Přehled', icon: UserSquare2 },
  { key: 'podpora', label: 'Podpůrné aktivity a výdaje', icon: Receipt },
  { key: 'predani', label: 'Předání dítěte', icon: Handshake },
  { key: 'kalendar', label: 'Kalendář', icon: Calendar },
  { key: 'ukoly', label: 'Úkoly', icon: CheckSquare },
]

/**
 * /rodiny/:familyUid/dite/:childId — UX zpětná vazba 2026-07-20 (§2).
 * Respit se ZAKLÁDÁ na profilu rodiny (typicky pokrývá víc dětí najednou,
 * viz `FamilyCareEventsSection`), tady je jen READ-ONLY součet dní za
 * aktuální rok pro tohle konkrétní dítě.
 */
export default function ChildDetailPage() {
  const { familyUid, childId } = useParams<{ familyUid: string; childId: string }>()
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [family, setFamily] = useState<FamilyDoc | null>(null)
  const [familyDocId, setFamilyDocId] = useState<string | null>(null)
  const [child, setChild] = useState<ChildDoc | null>(null)
  const [respitDays, setRespitDays] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [activeSection, setActiveSection] = useState('prehled')

  const [primaryFosterName, setPrimaryFosterName] = useState<string | null>(null)
  const familyName = family ? resolveFamilyDisplayName(family, primaryFosterName) : ''
  const [birthDate, setBirthDate] = useState('')
  // Datum narození není ručně vyplněné, ale JDE dopočítat z rodného čísla
  // (2026-07-24, Petrova poznámka "z rodného čísla jde narození poznat") —
  // pole se zobrazí PŘEDVYPLNĚNÉ odvozenou hodnotou, bez nutnosti cokoli
  // ukládat (`resolveChildBirthDate` v `dashboardService.ts` počítá totéž
  // za běhu pro upozornění). Uložení proběhne, jen pokud uživatel hodnotu
  // sám změní (např. oprava u cizího rodného čísla).
  const isDerivedFromBirthNumber = !child?.birthDate && !!child && birthDateFromBirthNumber(child.birthNumber) !== null

  async function handleBirthDateChange(value: string) {
    if (!childId) return
    setBirthDate(value)
    try {
      await updateChildBirthDate(childId, value)
    } catch {
      setError('Datum narození se nepodařilo uložit.')
    }
  }

  useEffect(() => {
    async function reload() {
      if (!familyUid || !childId || !organizationId) return
      setError(null)
      try {
        const [found, c] = await Promise.all([getFamilyByUid(familyUid, organizationId), getChild(childId)])
        if (!found || !c) {
          setNotFound(true)
          return
        }
        setFamily(found.family)
        setFamilyDocId(found.docId)
        setChild(c)
        setBirthDate(c.birthDate ?? birthDateFromBirthNumber(c.birthNumber) ?? '')
        const [days, fosters] = await Promise.all([
          getChildRespitDaysForYear(childId, new Date().getFullYear()),
          listFosterPersonsByRefs(found.family.fosterPersonRefs),
        ])
        setRespitDays(days)
        setPrimaryFosterName(fosters[0] ? `${fosters[0].fosterPerson.firstName} ${fosters[0].fosterPerson.lastName}` : null)
      } catch {
        setError('Profil dítěte se nepodařilo načíst.')
      }
    }
    reload()
  }, [familyUid, childId, organizationId])

  if (notFound) {
    return (
      <AppShell>
        <p className="text-sm text-text-secondary">Tenhle profil se nepodařilo najít.</p>
      </AppShell>
    )
  }

  return (
    <AppShell
    >
      <Tabs items={SECTIONS} active={activeSection} onSelect={setActiveSection} />

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {child && (
        <>
          {activeSection === 'prehled' && (
            <div className="mt-2 flex max-w-[928px] items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <EditableAvatar
                  kind="child"
                  id={childId!}
                  photoURL={child.avatarUrl}
                  label={`${child.firstName} ${child.lastName}`}
                  fallbackIcon={Baby}
                  onUploaded={(url) => setChild((prev) => (prev ? { ...prev, avatarUrl: url } : prev))}
                />
                <div>
                  <h1 className="text-xl font-bold leading-tight text-text-primary">
                    {child.firstName} {child.lastName}
                  </h1>
                  <p className="mt-1 font-mono text-sm text-text-secondary">{child.birthNumber}</p>
                  {/* Rodina byla v drobečkové navigaci; ta zmizela, ale
                      „čí je to dítě" je na téhle stránce zásadní informace,
                      takže je teď pod jménem — a jako proklik. */}
                  {familyName && family && (
                    <p className="text-sm text-text-tertiary">
                      <Link to={`/rodiny/${family.uid}`} className="hover:text-text-primary hover:underline">
                        {familyName}
                      </Link>
                    </p>
                  )}
                  <label className="mt-3 flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-text-primary">Datum narození</span>
                    <DatePicker value={birthDate} onChange={handleBirthDateChange} className="max-w-[220px]" />
                    {isDerivedFromBirthNumber && (
                      <span className="text-xs text-text-tertiary">Odvozeno z rodného čísla — lze ručně opravit.</span>
                    )}
                  </label>
                  <p className="mt-3 text-sm text-text-secondary">
                    Respit v {new Date().getFullYear()}: {respitDays ?? 0} dní čerpáno
                    <span className="ml-1 text-text-tertiary">
                      (zaznamenává se na profilu rodiny)
                    </span>
                  </p>
                </div>
              </div>
              {childId && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    navigate(
                      `/externiste?entityType=child&entityId=${encodeURIComponent(childId)}`,
                    )
                  }
                >
                  <UserSquare2 size={16} /> Přidat externistu
                </Button>
              )}
            </div>
          )}

          {activeSection === 'predani' && childId && familyDocId && organizationId && userDoc && (
            <ChildHandoversSection
              familyDocId={familyDocId}
              childId={childId}
              childName={`${child.firstName} ${child.lastName}`}
              organizationId={organizationId}
              currentUid={userDoc.uid}
            />
          )}

          {activeSection === 'podpora' && childId && organizationId && userDoc && (
            <ChildSupportSection
              childId={childId}
              childName={`${child.firstName} ${child.lastName}`}
              organizationId={organizationId}
              currentUid={userDoc.uid}
            />
          )}
          {activeSection === 'kalendar' && childId && organizationId && (
            <section className="mt-6">
              <EntityAgenda organizationId={organizationId} subjectKind="child" subjectId={childId} />
            </section>
          )}

          {activeSection === 'ukoly' && childId && organizationId && (
            <section className="mt-6">
              <EntityTasks organizationId={organizationId} subjectKind="child" subjectId={childId} />
            </section>
          )}
        </>
      )}
    </AppShell>
  )
}
