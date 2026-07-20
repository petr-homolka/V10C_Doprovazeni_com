import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { ProfileSectionNav, type ProfileSection } from '@/components/profile/ProfileSectionNav'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { ChildSupportSection } from '@/components/family/ChildSupportSection'
import { useAuth } from '@/hooks/useAuth'
import { getChild, getFamilyByUid, listFosterPersonsByRefs } from '@/services/familyService'
import { getChildRespitDaysForYear } from '@/services/respitEventService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { FamilyDoc } from '@/types/family'
import type { ChildDoc } from '@/types/child'
import { Baby } from 'lucide-react'

const SECTIONS: ProfileSection[] = [
  { key: 'prehled', label: 'Přehled' },
  { key: 'podpora', label: 'Podpůrné aktivity a výdaje' },
]

/**
 * /rodiny/:familyUid/dite/:childId — UX zpětná vazba 2026-07-20 (§2).
 * Respit se ZAKLÁDÁ na profilu rodiny (typicky pokrývá víc dětí najednou,
 * viz `FamilyCareEventsSection`), tady je jen READ-ONLY součet dní za
 * aktuální rok pro tohle konkrétní dítě.
 */
export default function ChildDetailPage() {
  const { familyUid, childId } = useParams<{ familyUid: string; childId: string }>()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [family, setFamily] = useState<FamilyDoc | null>(null)
  const [child, setChild] = useState<ChildDoc | null>(null)
  const [respitDays, setRespitDays] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [activeSection, setActiveSection] = useState('prehled')

  const [primaryFosterName, setPrimaryFosterName] = useState<string | null>(null)
  const familyName = family ? resolveFamilyDisplayName(family, primaryFosterName) : ''

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
        setChild(c)
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
        { label: child ? `${child.firstName} ${child.lastName}` : '' },
      ]}
      secondaryPanel={<ProfileSectionNav sections={SECTIONS} active={activeSection} onSelect={setActiveSection} />}
    >
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {child && (
        <>
          {activeSection === 'prehled' && (
            <div className="mt-2 flex items-start gap-4">
              <EntityAvatar
                photoURL={child.avatarUrl}
                label={`${child.firstName} ${child.lastName}`}
                fallbackIcon={Baby}
                size="lg"
              />
              <div>
                <h1 className="text-lg font-normal leading-normal text-text-primary">
                  {child.firstName} {child.lastName}
                </h1>
                <p className="mt-1 font-mono text-sm text-text-secondary">{child.birthNumber}</p>
                <p className="mt-3 text-sm text-text-secondary">
                  Respit v {new Date().getFullYear()}: {respitDays ?? 0} dní čerpáno
                  <span className="ml-1 text-text-tertiary">
                    (zaznamenává se na profilu rodiny)
                  </span>
                </p>
              </div>
            </div>
          )}

          {activeSection === 'podpora' && childId && organizationId && userDoc && (
            <ChildSupportSection
              childId={childId}
              childName={`${child.firstName} ${child.lastName}`}
              organizationId={organizationId}
              currentUid={userDoc.uid}
            />
          )}
        </>
      )}
    </AppShell>
  )
}
