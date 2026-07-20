import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { ProfileSectionNav, type ProfileSection } from '@/components/profile/ProfileSectionNav'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DangerZone, DangerZoneAction } from '@/components/ui/danger-zone'
import { IppdSection } from '@/components/family/IppdSection'
import { useAuth } from '@/hooks/useAuth'
import { getOrganization } from '@/services/organizationService'
import { listStaff } from '@/services/staffService'
import { getFamilyByUid, listChildrenForFamily, listFosterPersonsByRefs } from '@/services/familyService'
import { checkKoCapacity, createAgreement, endAgreement, getActiveAgreement } from '@/services/agreementService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { AgreementDoc, CareType } from '@/types/agreement'
import type { UserDoc } from '@/types/user'
import { FileText } from 'lucide-react'

const CARE_TYPE_LABELS: Record<CareType, string> = {
  zprostredkovana: 'Zprostředkovaná (24 h/12 měsíců)',
  nezprostredkovana: 'Nezprostředkovaná — příbuzenská (18 h/12 měsíců)',
}

const SECTIONS: ProfileSection[] = [
  { key: 'prehled', label: 'Přehled' },
  { key: 'ippd', label: 'IPPD' },
]

/**
 * /rodiny/:familyUid/dohoda — UX zpětná vazba 2026-07-20 (§4). Dohoda má
 * VLASTNÍ profil, oddělený od rodiny — "Ukončit Dohodu" žije až tady, v
 * jasně označené nebezpečné zóně na konci Přehledu, ne hned vedle
 * nadpisu jako dřív na FamilyDetailPage.
 */
export default function AgreementDetailPage() {
  const { familyUid } = useParams<{ familyUid: string }>()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [docId, setDocId] = useState<string | null>(null)
  const [family, setFamily] = useState<FamilyDoc | null>(null)
  const [fosterPersons, setFosterPersons] = useState<Array<{ docId: string; fosterPerson: FosterPersonDoc }>>([])
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [agreement, setAgreement] = useState<AgreementDoc | null>(null)
  const [koOptions, setKoOptions] = useState<UserDoc[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [activeSection, setActiveSection] = useState('prehled')

  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [careType, setCareType] = useState<CareType>('zprostredkovana')
  const [assignedTo, setAssignedTo] = useState('')
  const [capacityNote, setCapacityNote] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const primaryFosterName = fosterPersons[0]
    ? `${fosterPersons[0].fosterPerson.firstName} ${fosterPersons[0].fosterPerson.lastName}`
    : null
  const familyName = family ? resolveFamilyDisplayName(family, primaryFosterName) : ''

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
      setError('Dohodu se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyUid, organizationId])

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
    await endAgreement(docId, organizationId)
    await reload()
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
      breadcrumb={[
        { label: 'Rodiny', href: '/rodiny' },
        { label: familyName, href: `/rodiny/${familyUid}` },
        { label: 'Dohoda' },
      ]}
      secondaryPanel={<ProfileSectionNav sections={SECTIONS} active={activeSection} onSelect={setActiveSection} />}
    >
      <h1 className="text-lg font-normal leading-normal text-text-primary">Dohoda</h1>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {activeSection === 'prehled' && (
        <div className="mt-6 flex flex-col gap-6">
          {agreement ? (
            <div className="rounded-lg border border-border bg-surface p-5">
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
            <>
              {!showAgreementForm && (
                <div className="flex flex-col items-center gap-3">
                  <EmptyState icon={FileText} text="Zatím žádná Dohoda s vaší organizací." />
                  <Button variant="secondary" size="sm" onClick={() => setShowAgreementForm(true)}>
                    + Založit Dohodu
                  </Button>
                </div>
              )}
              {showAgreementForm && (
                <form
                  onSubmit={handleCreateAgreement}
                  className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
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
                  <div className="flex gap-2">
                    <Button type="submit" disabled={submitting} className="w-fit">
                      {submitting ? 'Zakládám…' : 'Založit Dohodu'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAgreementForm(false)}
                      disabled={submitting}
                    >
                      Zrušit
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}

          {agreement && (
            <DangerZone>
              <DangerZoneAction
                label="Ukončit Dohodu"
                description="Dohoda skončí k dnešnímu dni. Historie (časová osa, dokumenty) zůstane zachovaná."
                actionLabel="Ukončit Dohodu"
                onAction={handleEndAgreement}
              />
            </DangerZone>
          )}
        </div>
      )}

      {activeSection === 'ippd' && docId && organizationId && userDoc && (
        <div className="mt-6">
          <IppdSection
            familyDocId={docId}
            organizationId={organizationId}
            currentUid={userDoc.uid}
            fosterPersons={fosterPersons}
            children={children}
          />
        </div>
      )}
    </AppShell>
  )
}
