import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { Tabs, type TabItem } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { DatePicker } from '@/components/ui/date-picker'
import { FosterPersonEducationSection } from '@/components/family/FosterPersonEducationSection'
import { FosterPersonCourseEnrollmentsSection } from '@/components/family/FosterPersonCourseEnrollmentsSection'
import { EducationPlanSection } from '@/components/family/EducationPlanSection'
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
import { UserRound, UserSquare2 } from 'lucide-react'

const SECTIONS: TabItem[] = [
  { key: 'prehled', label: 'Přehled' },
  { key: 'vzdelavani', label: 'Vzdělávání a dávky' },
  { key: 'prihlasky', label: 'Přihlášky na kurzy' },
  { key: 'plan', label: 'Plán vzdělávání' },
]

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
  const [activeSection, setActiveSection] = useState('prehled')
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
      <AppShell breadcrumb={[{ label: 'Rodiny', href: '/rodiny' }, { label: 'Nenalezeno' }]}>
        <p className="text-sm text-text-secondary">Tenhle profil se nepodařilo najít.</p>
      </AppShell>
    )
  }

  return (
    <AppShell
      breadcrumb={[
        { label: 'Rodiny', href: '/rodiny' },
        { label: familyName, href: `/rodiny/${familyUid}` },
        { label: fosterPerson ? `${fosterPerson.firstName} ${fosterPerson.lastName}` : '' },
      ]}
    >
      <Tabs items={SECTIONS} active={activeSection} onSelect={setActiveSection} />

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {fosterPerson && (
        <>
          {activeSection === 'prehled' && (
            <div className="mt-2 flex max-w-[928px] items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <EntityAvatar
                  photoURL={fosterPerson.avatarUrl}
                  label={`${fosterPerson.firstName} ${fosterPerson.lastName}`}
                  fallbackIcon={UserRound}
                  size="lg"
                />
                <div>
                  <h1 className="text-[26px] font-bold leading-tight text-text-primary">
                    {fosterPerson.firstName} {fosterPerson.lastName}
                  </h1>
                  <p className="mt-1 text-sm text-text-secondary">{fosterPerson.phone || '—'}</p>
                  <p className="text-sm text-text-secondary">{fosterPerson.email || '—'}</p>
                  <label className="mt-3 flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-text-primary">Datum narození (volitelné)</span>
                    <DatePicker value={birthDate} onChange={handleBirthDateChange} className="max-w-[220px]" />
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={!fosterPerson.email || invitingFoster}
                    onClick={handleInvite}
                    title={!fosterPerson.email ? 'Pěstoun nemá vyplněný e-mail' : undefined}
                  >
                    {invitingFoster ? 'Odesílám…' : 'Pozvat'}
                  </Button>
                  {inviteMessage && <p className="mt-2 text-sm text-text-secondary">{inviteMessage}</p>}
                </div>
              </div>
              {fosterPersonId && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    navigate(
                      `/externiste?entityType=fosterPerson&entityId=${encodeURIComponent(fosterPersonId)}`,
                    )
                  }
                >
                  <UserSquare2 size={16} /> Přidat externistu
                </Button>
              )}
            </div>
          )}

          {activeSection === 'vzdelavani' && fosterPersonId && organizationId && userDoc && (
            <FosterPersonEducationSection
              fosterPersonId={fosterPersonId}
              fosterPerson={fosterPerson}
              organizationId={organizationId}
              currentUid={userDoc.uid}
            />
          )}

          {activeSection === 'prihlasky' && fosterPersonId && organizationId && userDoc && (
            <FosterPersonCourseEnrollmentsSection
              fosterPersonId={fosterPersonId}
              organizationId={organizationId}
              currentUid={userDoc.uid}
              currentRole={userDoc.role}
            />
          )}

          {activeSection === 'plan' && fosterPersonId && organizationId && userDoc && (
            <EducationPlanSection
              fosterPersonId={fosterPersonId}
              fosterPersonName={`${fosterPerson.firstName} ${fosterPerson.lastName}`}
              organizationId={organizationId}
              agreementId={organizationId}
              currentUid={userDoc.uid}
              children={children}
            />
          )}
        </>
      )}
    </AppShell>
  )
}
