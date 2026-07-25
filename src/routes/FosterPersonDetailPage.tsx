import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { PageBody, PageHead } from '@/components/spis/PageBody'
import { SpisSection } from '@/components/spis/SpisSection'
import { PropertyEmpty, PropertyList, PropertyRow } from '@/components/ui/property-list'
import { Button } from '@/components/ui/button'
import { EditableAvatar } from '@/components/ui/editable-avatar'
import { DatePicker } from '@/components/ui/date-picker'
import { FosterPersonEducationSection } from '@/components/family/FosterPersonEducationSection'
import { FosterPersonCourseEnrollmentsSection } from '@/components/family/FosterPersonCourseEnrollmentsSection'
import { EducationPlanSection } from '@/components/family/EducationPlanSection'
import { EntityAgenda } from '@/components/calendar/EntityAgenda'
import { EntityTasks } from '@/components/tasks/EntityTasks'
import { useAuth } from '@/hooks/useAuth'
import {
  getFamilyByUid,
  getFosterPerson,
  listChildrenForFamily,
  listFosterPersonsByRefs,
  updateFosterPersonBirthDate,
} from '@/services/familyService'
import { sendFosterInvitation } from '@/services/fosterInvitationService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import { UserRound, UserSquare2 } from '@/components/ui/icons'


/**
 * /rodiny/:familyUid/pestoun/:fosterPersonId — UX zpětná vazba
 * 2026-07-20 (§2): pěstoun dostává vlastní profil místo řádku v tabulce
 * na FamilyDetailPage. Sekce Vzdělávání/Přihlášky/Plán jsou stejné,
 * beze změny vlastního obsahu komponenty — jen se sem přestěhovaly z
 * `.map()` smyčky.
 */
export default function FosterPersonDetailPage() {
  const { familyUid, fosterPersonId } = useParams<{ familyUid: string; fosterPersonId: string }>()
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [family, setFamily] = useState<FamilyDoc | null>(null)
  const [fosterPerson, setFosterPerson] = useState<FosterPersonDoc | null>(null)
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [invitingFoster, setInvitingFoster] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)

  const [primaryFosterName, setPrimaryFosterName] = useState<string | null>(null)
  const familyName = family ? resolveFamilyDisplayName(family, primaryFosterName) : ''
  const [birthDate, setBirthDate] = useState('')

  async function reload() {
    if (!familyUid || !fosterPersonId || !organizationId) return
    setError(null)
    try {
      const found = await getFamilyByUid(familyUid, organizationId)
      const fp = await getFosterPerson(fosterPersonId)
      if (!found || !fp) {
        setNotFound(true)
        return
      }
      setFamily(found.family)
      setFosterPerson(fp)
      setBirthDate(fp.birthDate ?? '')
      const [kids, fosters] = await Promise.all([
        listChildrenForFamily(found.docId, organizationId),
        listFosterPersonsByRefs(found.family.fosterPersonRefs),
      ])
      setChildren(kids)
      setPrimaryFosterName(fosters[0] ? `${fosters[0].fosterPerson.firstName} ${fosters[0].fosterPerson.lastName}` : null)
    } catch {
      setError('Profil pěstouna se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyUid, fosterPersonId, organizationId])

  async function handleBirthDateChange(value: string) {
    if (!fosterPersonId) return
    setBirthDate(value)
    try {
      await updateFosterPersonBirthDate(fosterPersonId, value)
    } catch {
      setError('Datum narození se nepodařilo uložit.')
    }
  }

  async function handleInvite() {
    if (!familyUid || !fosterPersonId || !organizationId || !userDoc || !fosterPerson?.email) return
    const found = await getFamilyByUid(familyUid, organizationId)
    if (!found) return
    setInvitingFoster(true)
    setInviteMessage(null)
    try {
      await sendFosterInvitation({
        email: fosterPerson.email,
        organizationId,
        familyId: found.docId,
        fosterPersonRef: fosterPersonId,
        fosterPersonDisplayName: `${fosterPerson.firstName} ${fosterPerson.lastName}`,
        invitedByUid: userDoc.uid,
        invitedByDisplayName: userDoc.displayName,
      })
      setInviteMessage(`Pozvánka odeslána na ${fosterPerson.email}.`)
    } catch {
      setInviteMessage('Pozvánku se nepodařilo odeslat.')
    } finally {
      setInvitingFoster(false)
    }
  }

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
          <Link to="/pestouni" className="shrink-0 text-text-tertiary transition-colors duration-150 hover:text-text-primary">
            Pěstouni
          </Link>
          <span className="text-text-faint">/</span>
          <span className="truncate text-text-primary">
            {fosterPerson ? `${fosterPerson.firstName} ${fosterPerson.lastName}` : 'Pěstoun'}
          </span>
        </nav>
      }
      fullBleed
    >
      <PageBody>
        {fosterPerson && (
          <>
            <PageHead
              title={`${fosterPerson.firstName} ${fosterPerson.lastName}`}
              actions={
                <>
                  <Button
                    variant="secondary"
                    disabled={!fosterPerson.email || invitingFoster}
                    onClick={handleInvite}
                    title={!fosterPerson.email ? 'Pěstoun nemá vyplněný e-mail' : undefined}
                  >
                    {invitingFoster ? 'Odesílám…' : 'Pozvat do portálu'}
                  </Button>
                  {fosterPersonId && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigate(`/externiste?entityType=fosterPerson&entityId=${encodeURIComponent(fosterPersonId)}`)
                      }
                    >
                      <UserSquare2 size={17} /> Přidat externistu
                    </Button>
                  )}
                </>
              }
            >
              <div className="flex items-center gap-4">
                <EditableAvatar
                  kind="fosterPerson"
                  id={fosterPersonId!}
                  photoURL={fosterPerson.avatarUrl}
                  label={`${fosterPerson.firstName} ${fosterPerson.lastName}`}
                  fallbackIcon={UserRound}
                  size="sm"
                  onUploaded={(url) => setFosterPerson((prev) => (prev ? { ...prev, avatarUrl: url } : prev))}
                />
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-text-tertiary">
                  <span>{fosterPerson.phone || 'bez telefonu'}</span>
                  <span>·</span>
                  <span>{fosterPerson.email || 'bez e-mailu'}</span>
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
              {inviteMessage && <p className="mt-2 text-sm text-text-secondary">{inviteMessage}</p>}
              {error && (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {error}
                </p>
              )}
            </PageHead>

            <SpisSection id="prehled" title="Přehled" description="Kontakt, datum narození a rodina, ke které patří.">
              <PropertyList>
                <PropertyRow label="Telefon">{fosterPerson.phone || <PropertyEmpty />}</PropertyRow>
                <PropertyRow label="E-mail">{fosterPerson.email || <PropertyEmpty />}</PropertyRow>
                <PropertyRow label="Datum narození">
                  <DatePicker value={birthDate} onChange={handleBirthDateChange} className="max-w-[220px]" />
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
              </PropertyList>
            </SpisSection>

            <SpisSection
              id="vzdelavani"
              title="Vzdělávání"
              description="Absolvované hodiny proti zákonnému limitu."
              lazy
              padded
            >
              {fosterPersonId && organizationId && userDoc && (
                <FosterPersonEducationSection
                  fosterPersonId={fosterPersonId}
                  fosterPerson={fosterPerson}
                  organizationId={organizationId}
                  currentUid={userDoc.uid}
                />
              )}
            </SpisSection>

            <SpisSection id="prihlasky" title="Přihlášky na kurzy" description="Co je přihlášené a v jakém stavu." lazy padded>
              {fosterPersonId && organizationId && userDoc && (
                <FosterPersonCourseEnrollmentsSection
                  fosterPersonId={fosterPersonId}
                  organizationId={organizationId}
                  currentUid={userDoc.uid}
                  currentRole={userDoc.role}
                />
              )}
            </SpisSection>

            <SpisSection id="plan" title="Plán vzdělávání" description="Co má pěstoun v tomhle období absolvovat." lazy padded>
              {fosterPersonId && organizationId && userDoc && (
                <EducationPlanSection
                  fosterPersonId={fosterPersonId}
                  fosterPersonName={`${fosterPerson.firstName} ${fosterPerson.lastName}`}
                  organizationId={organizationId}
                  agreementId={organizationId}
                  currentUid={userDoc.uid}
                  children={children}
                />
              )}
            </SpisSection>

            <SpisSection id="kalendar" title="Kalendář" description="Události, které se týkají tohohle pěstouna." lazy>
              {fosterPersonId && organizationId && (
                <EntityAgenda organizationId={organizationId} subjectKind="fosterPerson" subjectId={fosterPersonId} />
              )}
            </SpisSection>

            <SpisSection id="ukoly" title="Úkoly" description="Co je kolem pěstouna potřeba udělat." lazy padded>
              {fosterPersonId && organizationId && (
                <EntityTasks organizationId={organizationId} subjectKind="fosterPerson" subjectId={fosterPersonId} />
              )}
            </SpisSection>
          </>
        )}
      </PageBody>
    </AppShell>
  )
}
