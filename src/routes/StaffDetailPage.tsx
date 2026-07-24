import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Mail, UserCog } from 'lucide-react'
import { AppShell } from '@/components/shell/AppShell'
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
      <AppShell breadcrumb={[{ label: 'Zaměstnanci', href: '/zamestnanci' }, { label: '…' }]}>
        <p className="text-sm text-text-secondary">Načítám…</p>
      </AppShell>
    )
  }

  if (member === 'notFound') {
    return (
      <AppShell breadcrumb={[{ label: 'Zaměstnanci', href: '/zamestnanci' }, { label: 'Nenalezen' }]}>
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
    <AppShell breadcrumb={[{ label: 'Zaměstnanci', href: '/zamestnanci' }, { label: member.displayName }]}>
      <div className="flex max-w-[860px] flex-col gap-6">
        <div className="flex items-start gap-5 rounded-lg bg-surface-soft p-6 shadow-raised">
          {canEditPhoto ? (
            <EditableAvatar
              kind="staff"
              id={member.uid}
              photoURL={member.avatarUrl}
              label={member.displayName}
              fallbackIcon={UserCog}
              onUploaded={(url) => setMember((prev) => (prev && prev !== 'notFound' ? { ...prev, avatarUrl: url } : prev))}
            />
          ) : (
            <EntityAvatar size="lg" photoURL={member.avatarUrl} label={member.displayName} fallbackIcon={UserCog} />
          )}

          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-[26px] font-bold leading-tight text-text-primary">{member.displayName}</h1>
            <p className="mt-1">
              <span className="inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                {STAFF_ROLE_LABELS[member.role as StaffRole] ?? member.role}
              </span>
              {member.disabledAt && <span className="ml-2 text-xs font-medium text-danger">Zablokován</span>}
            </p>
            <div className="mt-3 flex flex-col gap-1.5 text-sm">
              {member.email && (
                <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-text-secondary hover:text-primary hover:underline">
                  <Mail size={15} className="shrink-0 text-text-tertiary" />
                  {member.email}
                </a>
              )}
            </div>
          </div>

          {!isCollaborator && caseload !== null && (
            <div className="shrink-0 text-center">
              <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Kapacita</p>
              <div className="mt-1 flex justify-center">
                <CapacityRing value={caseload} max={threshold} />
              </div>
              <Link to="/zamestnanci" className="mt-1 block text-[11px] text-primary hover:underline">
                Nastavit
              </Link>
            </div>
          )}
        </div>

        {/* Vlastní kalendář zaměstnance — "každá entita má svůj kalendář",
         * defaultní pohled AGENDA. U zaměstnance to znamená události, které
         * má přiřazené. */}
        {organizationId && (
          <div>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">Kalendář</h2>
            <EntityAgenda organizationId={organizationId} subjectKind="staff" subjectId={member.uid} />
          </div>
        )}

        {/* Úkoly, které má na sobě — u zaměstnance je to "co má rozdělané",
         * ne "co se ho týká jako klienta". */}
        {organizationId && (
          <div>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">Úkoly</h2>
            <EntityTasks organizationId={organizationId} subjectKind="staff" subjectId={member.uid} />
          </div>
        )}
      </div>
    </AppShell>
  )
}

