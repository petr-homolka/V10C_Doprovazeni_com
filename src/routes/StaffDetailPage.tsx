import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserCog } from '@/components/ui/icons'
import { AppShell } from '@/components/shell/AppShell'
import { PageBody, PageHead } from '@/components/spis/PageBody'
import { SpisSection } from '@/components/spis/SpisSection'
import { EditableAvatar } from '@/components/ui/editable-avatar'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { EntityAgenda } from '@/components/calendar/EntityAgenda'
import { EntityTasks } from '@/components/tasks/EntityTasks'
import { CapacityRing } from '@/components/ui/capacity-ring'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { getStaffMember } from '@/services/staffService'
import { listActiveCaseloadByKo } from '@/services/agreementService'
import { getOrganization, getPlatformDefaults } from '@/services/organizationService'
import { computeEffectiveCapacityThreshold } from '@/lib/capacityThreshold'
import { DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD } from '@/types/platformDefaults'
import { STAFF_ROLE_LABELS, type StaffRole, type UserDoc } from '@/types/user'

/**
 * `/zamestnanci/:uid` — profil zaměstnance. Vznikl proto, že jméno
 * zaměstnance se v platformě objevuje na desítkách míst (autor zápisu,
 * klíčová osoba na Dohodě, řešitel úkolu, účastník chatu) a "kdekoli se
 * objeví jméno, je proklikem na profil" — dosud ale žádný profil, kam
 * odkázat, neexistoval.
 *
 * Editace nastavení (kapacita, moduly, blokace) zůstává na `/zamestnanci`
 * — stejné dělení jako `FamilyListPage` vs. `FamilyDetailPage`. Tady jde
 * o "kdo to je a co má v kalendáři".
 */
export default function StaffDetailPage() {
  const { uid } = useParams<{ uid: string }>()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [member, setMember] = useState<UserDoc | null | 'notFound'>(null)
  const [caseload, setCaseload] = useState<number | null>(null)
  const [orgThreshold, setOrgThreshold] = useState<number | null | undefined>(undefined)
  const [platformThreshold, setPlatformThreshold] = useState(DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD)

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    getStaffMember(uid)
      .then((found) => { if (!cancelled) setMember(found ?? 'notFound') })
      .catch(() => { if (!cancelled) setMember('notFound') })
    return () => { cancelled = true }
  }, [uid])

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    Promise.all([
      listActiveCaseloadByKo(organizationId),
      getOrganization(organizationId),
      getPlatformDefaults(),
    ])
      .then(([byKo, org, defaults]) => {
        if (cancelled || !uid) return
        setCaseload(byKo[uid] ?? 0)
        setOrgThreshold(org?.koCapacityThreshold ?? null)
        if (defaults?.koCapacityThreshold) setPlatformThreshold(defaults.koCapacityThreshold)
      })
      .catch(() => { /* kapacita je doplňková informace — profil se ukáže i bez ní */ })
    return () => { cancelled = true }
  }, [organizationId, uid])

  if (member === null) {
    return (
      <AppShell>
        <p className="text-sm text-text-secondary">Načítám…</p>
      </AppShell>
    )
  }

  if (member === 'notFound') {
    return (
      <AppShell>
        <EmptyState icon={UserCog} text="Takového zaměstnance jsme nenašli." />
      </AppShell>
    )
  }

  // Fotku smí měnit sám uživatel, nebo org_admin téže organizace — přesně
  // to samé, co povolují firestore.rules a storage.rules.
  const canEditPhoto = userDoc?.uid === member.uid || (userDoc?.role === 'org_admin' && userDoc.organizationId === member.organizationId)
  const isCollaborator = member.role === 'spolupracovnik'
  const threshold = computeEffectiveCapacityThreshold(
    member.fte,
    member.capacityThresholdOverride,
    orgThreshold,
    platformThreshold,
  )

  return (
    <AppShell
      fullBleed
      pageContext={
        <nav className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link to="/zamestnanci" className="shrink-0 text-text-tertiary transition-colors duration-150 hover:text-text-primary">
            Zaměstnanci
          </Link>
          <span className="text-text-faint">/</span>
          <span className="truncate text-text-primary">{member.displayName}</span>
        </nav>
      }
    >
      <PageBody>
        <PageHead
          title={member.displayName}
          actions={
            !isCollaborator && caseload !== null ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm text-text-tertiary">Kapacita</p>
                  <Link to="/zamestnanci" className="text-sm text-text-secondary hover:text-text-primary hover:underline">
                    Nastavit
                  </Link>
                </div>
                <CapacityRing value={caseload} max={threshold} />
              </div>
            ) : undefined
          }
        >
          <div className="flex items-center gap-4">
            {canEditPhoto ? (
              <EditableAvatar
                kind="staff"
                id={member.uid}
                photoURL={member.avatarUrl}
                label={member.displayName}
                fallbackIcon={UserCog}
                size="sm"
                onUploaded={(url) =>
                  setMember((prev) => (prev && prev !== 'notFound' ? { ...prev, avatarUrl: url } : prev))
                }
              />
            ) : (
              <EntityAvatar photoURL={member.avatarUrl} label={member.displayName} fallbackIcon={UserCog} />
            )}
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-text-tertiary">
              <span>{STAFF_ROLE_LABELS[member.role as StaffRole] ?? member.role}</span>
              {member.email && (
                <>
                  <span>·</span>
                  <a href={`mailto:${member.email}`} className="hover:text-text-primary hover:underline">
                    {member.email}
                  </a>
                </>
              )}
              {member.disabledAt && (
                <>
                  <span>·</span>
                  <span className="text-accent">Zablokován</span>
                </>
              )}
            </p>
          </div>
        </PageHead>

        {/* Vlastní kalendář zaměstnance — „každá entita má svůj kalendář",
            defaultní pohled AGENDA. U zaměstnance to znamená události, které
            má přiřazené. */}
        <SpisSection id="kalendar" title="Kalendář" description="Události, které má tenhle člověk na sobě." lazy>
          {organizationId && (
            <EntityAgenda organizationId={organizationId} subjectKind="staff" subjectId={member.uid} />
          )}
        </SpisSection>

        {/* Úkoly, které má na sobě — u zaměstnance je to „co má rozdělané",
            ne „co se ho týká jako klienta". */}
        <SpisSection id="ukoly" title="Úkoly" description="Co má rozdělané." lazy padded>
          {organizationId && (
            <EntityTasks organizationId={organizationId} subjectKind="staff" subjectId={member.uid} />
          )}
        </SpisSection>
      </PageBody>
    </AppShell>
  )
}

