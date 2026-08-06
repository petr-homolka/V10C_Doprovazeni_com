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
  listFamiliesWithDocIds,
  listFosterPersonsByRefs,
  moveFosterPersonToFamily,
  updateFosterPersonBirthDate,
} from '@/services/familyService'
import { auditActor, recordAudit, actorFields } from '@/services/auditLogService'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
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

  // Přestěhování do jiné domácnosti — viz `moveFosterPersonToFamily`.
  const [moveTargets, setMoveTargets] = useState<Array<{ docId: string; family: FamilyDoc }>>([])
  const [moveTarget, setMoveTarget] = useState('')
  const [moveReason, setMoveReason] = useState('')
  const [moving, setMoving] = useState(false)
  const [moveNotice, setMoveNotice] = useState<string | null>(null)

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

  async function handleMove() {
    if (!fosterPersonId || !organizationId || !userDoc || !moveTarget) return
    setError(null)
    setMoveNotice(null)
    setMoving(true)
    try {
      await moveFosterPersonToFamily({
        fosterPersonId,
        targetFamilyId: moveTarget,
        organizationId,
        reason: moveReason.trim() || undefined,
      })
      // Stopa je POVINNÁ, ne hezká: přesun mění, kdo se na koho smí dívat.
      await recordAudit({
        organizationId,
        action: 'foster_household_moved',
        ...actorFields(auditActor(userDoc)),
        subject: {
          kind: 'fosterPerson',
          id: fosterPersonId,
          label: fosterPerson ? `${fosterPerson.firstName} ${fosterPerson.lastName}` : fosterPersonId,
        },
        detail: moveReason.trim() ? `Důvod: ${moveReason.trim()}` : 'Bez uvedeného důvodu.',
      })
      setMoveNotice('Přesunuto. Pěstoun je teď v nové domácnosti.')
      setMoveTarget('')
      setMoveReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Přesun se nezdařil.')
    } finally {
      setMoving(false)
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

            {/*
              Pěstoun ovdoví, znovu se ožení, připojí se k jiné pěstounské
              rodině. Do 27. 7. to systém neuměl vůbec — byl navázaný na
              jednu domácnost napevno.
            */}
            <SpisSection
              id="stehovani"
              title="Přestěhování"
              description="Přesun pěstouna do jiné domácnosti — beze změny UID a bez ztráty historie."
              lazy
              padded
            >
              <div className="max-w-[560px]">
                <p className="text-sm text-text-secondary">
                  Zápisy, dokumenty a chaty zůstávají u dosavadní rodiny — patří k tomu, co se tam
                  tehdy dělo. Že tam pěstoun patřil, zůstane zaznamenané.
                </p>
                <p className="mt-1 text-sm text-text-tertiary">
                  Nabízí se jen domácnosti, které vede vaše organizace. Přesun k jiné organizaci není
                  stěhování, ale předání — a to má vlastní postup.
                </p>

                {moveNotice && <p className="mt-3 text-sm text-success">{moveNotice}</p>}

                <div className="sp__group mt-4">
                  <label className="sp__grouplabel" htmlFor="cilova-rodina">
                    Cílová domácnost
                  </label>
                  <Select
                    id="cilova-rodina"
                    value={moveTarget}
                    onChange={(e) => setMoveTarget(e.target.value)}
                    onFocus={async () => {
                      if (moveTargets.length || !organizationId) return
                      setMoveTargets(await listFamiliesWithDocIds(organizationId))
                    }}
                  >
                    <option value="">— vyberte —</option>
                    {moveTargets
                      .filter((f) => f.docId !== fosterPerson?.familyId)
                      .map((f) => (
                        <option key={f.docId} value={f.docId}>
                          {resolveFamilyDisplayName(f.family, null)} · {f.family.uid}
                        </option>
                      ))}
                  </Select>
                </div>

                <div className="sp__group">
                  <label className="sp__grouplabel" htmlFor="duvod-stehovani">
                    Důvod (volitelně)
                  </label>
                  <Input
                    id="duvod-stehovani"
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                    placeholder="Sňatek, ovdovění…"
                  />
                </div>

                <Button className="mt-3" variant="secondary" size="sm" disabled={!moveTarget || moving} onClick={handleMove}>
                  {moving ? 'Přesouvám…' : 'Přesunout'}
                </Button>
              </div>
            </SpisSection>
          </>
        )}
      </PageBody>
    </AppShell>
  )
}
