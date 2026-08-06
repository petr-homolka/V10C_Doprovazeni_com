import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { PageBody, PageHead } from '@/components/spis/PageBody'
import { SpisSection } from '@/components/spis/SpisSection'
import { PropertyEmpty, PropertyList, PropertyRow } from '@/components/ui/property-list'
import { EditableAvatar } from '@/components/ui/editable-avatar'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { ChildSupportSection } from '@/components/family/ChildSupportSection'
import { ChildHandoversSection } from '@/components/family/ChildHandoversSection'
import { CustodySection } from '@/components/family/CustodySection'
import { EntityAgenda } from '@/components/calendar/EntityAgenda'
import { EntityTasks } from '@/components/tasks/EntityTasks'
import { useAuth } from '@/hooks/useAuth'
import { getChild, getFamilyByUid, listFosterPersonsByRefs, updateChildBirthDate } from '@/services/familyService'
import { getChildRespitDaysForYear } from '@/services/respitEventService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { birthDateFromBirthNumber } from '@/lib/birthNumber'
import type { FamilyDoc } from '@/types/family'
import type { ChildDoc } from '@/types/child'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import { Baby, UserSquare2 } from '@/components/ui/icons'


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

  // Pěstouni domácnosti se načítají už kvůli názvu rodiny; drží se celý
  // seznam, protože svěření do péče se zapisuje konkrétním osobám a
  // načítat je podruhé jen kvůli tomu by byl zbytečný dotaz navíc.
  const [fosterPersons, setFosterPersons] = useState<Array<{ docId: string; fosterPerson: FosterPersonDoc }>>([])
  const primaryFosterName = fosterPersons[0]
    ? `${fosterPersons[0].fosterPerson.firstName} ${fosterPersons[0].fosterPerson.lastName}`
    : null
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
        setFosterPersons(fosters)
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
      pageContext={
        <nav className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link to="/deti" className="shrink-0 text-text-tertiary transition-colors duration-150 hover:text-text-primary">
            Děti
          </Link>
          <span className="text-text-faint">/</span>
          <span className="truncate text-text-primary">
            {child ? `${child.firstName} ${child.lastName}` : 'Dítě'}
          </span>
        </nav>
      }
      fullBleed
    >
      <PageBody>
        {child && (
          <>
            <PageHead
              title={`${child.firstName} ${child.lastName}`}
              actions={
                childId && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigate(`/externiste?entityType=child&entityId=${encodeURIComponent(childId)}`)
                    }
                  >
                    <UserSquare2 size={17} /> Přidat externistu
                  </Button>
                )
              }
            >
              <div className="flex items-center gap-4">
                <EditableAvatar
                  kind="child"
                  id={childId!}
                  photoURL={child.avatarUrl}
                  label={`${child.firstName} ${child.lastName}`}
                  fallbackIcon={Baby}
                  size="sm"
                  onUploaded={(url) => setChild((prev) => (prev ? { ...prev, avatarUrl: url } : prev))}
                />
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-text-tertiary">
                  <span className="font-mono">{child.birthNumber}</span>
                  {/* „Čí je to dítě" je na téhle stránce zásadní informace —
                      dřív ji nesla drobečková navigace, teď stojí u jména. */}
                  {familyName && family && (
                    <>
                      <span>·</span>
                      <Link to={`/rodiny/${family.uid}`} className="hover:text-text-primary hover:underline">
                        {familyName}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              {error && (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {error}
                </p>
              )}
            </PageHead>

            <SpisSection id="prehled" title="Přehled" description="Základní údaje dítěte a čerpání respitu.">
              <PropertyList>
                <PropertyRow label="Rodné číslo">
                  <span className="font-mono">{child.birthNumber}</span>
                </PropertyRow>
                <PropertyRow label="Datum narození">
                  <span className="flex flex-col gap-1">
                    <DatePicker value={birthDate} onChange={handleBirthDateChange} className="max-w-[220px]" />
                    {isDerivedFromBirthNumber && (
                      <span className="text-xs text-text-tertiary">Odvozeno z rodného čísla — lze ručně opravit.</span>
                    )}
                  </span>
                </PropertyRow>
                <PropertyRow label="Rodina">
                  {familyName && family ? (
                    <Link to={`/rodiny/${family.uid}`} className="hover:text-text-primary hover:underline">
                      {familyName}
                    </Link>
                  ) : (
                    <PropertyEmpty />
                  )}
                </PropertyRow>
                <PropertyRow label={`Respit v ${new Date().getFullYear()}`}>
                  {respitDays ?? 0} dní čerpáno
                  <span className="ml-1 text-text-tertiary">(zaznamenává se na profilu rodiny)</span>
                </PropertyRow>
              </PropertyList>
            </SpisSection>

            {/* Svěření stojí hned za přehledem schválně: je to PRÁVNÍ TITUL,
                od kterého se odvíjí všechno ostatní. Dohoda, podpora ani
                předání nedávají smysl u dítěte, o kterém nevíme, komu bylo
                soudem svěřeno. */}
            <SpisSection
              id="svereni"
              title="Svěření do péče"
              description="Komu je dítě svěřené a jakým rozhodnutím soudu."
              lazy
              padded
            >
              {childId && organizationId && userDoc && (
                <CustodySection
                  childId={childId}
                  organizationId={organizationId}
                  userUid={userDoc.uid}
                  fosterPersons={fosterPersons}
                />
              )}
            </SpisSection>

            <SpisSection
              id="podpora"
              title="Podpůrné aktivity a výdaje"
              description="Kroužky, doučování, terapie — co dítě dostává a co to stojí."
              lazy
              padded
            >
              {childId && organizationId && userDoc && (
                <ChildSupportSection
                  childId={childId}
                  organizationId={organizationId}
                  currentUid={userDoc.uid}
                />
              )}
            </SpisSection>

            <SpisSection
              id="predani"
              title="Předání dítěte"
              description="Záznamy o předání mezi pěstouny a dalšími osobami."
              lazy
              padded
            >
              {childId && familyDocId && organizationId && userDoc && (
                <ChildHandoversSection
                  familyDocId={familyDocId}
                  childId={childId}
                  childName={`${child.firstName} ${child.lastName}`}
                  organizationId={organizationId}
                  currentUid={userDoc.uid}
                />
              )}
            </SpisSection>

            <SpisSection id="kalendar" title="Kalendář" description="Události, které se týkají tohohle dítěte." lazy>
              {childId && organizationId && (
                <EntityAgenda organizationId={organizationId} subjectKind="child" subjectId={childId} />
              )}
            </SpisSection>

            <SpisSection id="ukoly" title="Úkoly" description="Co je kolem dítěte potřeba udělat." lazy padded>
              {childId && organizationId && (
                <EntityTasks organizationId={organizationId} subjectKind="child" subjectId={childId} />
              )}
            </SpisSection>
          </>
        )}
      </PageBody>
    </AppShell>
  )
}
