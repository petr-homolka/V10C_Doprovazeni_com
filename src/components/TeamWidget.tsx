import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { listStaff } from '@/services/staffService'
import { STAFF_ROLE_LABELS, type UserDoc } from '@/types/user'

/**
 * "Tým" — Cesta D "Workload" widget (SPEC.md Dashboard sekce): mřížka
 * karet po jednom zaměstnanci (avatar + jméno + role), reálná data ze
 * `staffService.listStaff` (stejný zdroj jako StaffPage). Appka žádnou
 * úroveň seniority nemá (na rozdíl od reference "Middle/Junior/Senior"
 * pillu) — role sama o sobě nese tu informaci, proto se zobrazuje ta.
 */
export function TeamWidget({ organizationId }: { organizationId: string }) {
  const [staff, setStaff] = useState<UserDoc[] | null>(null)

  useEffect(() => {
    listStaff(organizationId)
      .then(setStaff)
      .catch(() => setStaff([]))
  }, [organizationId])

  if (staff !== null && staff.length === 0) return null

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-heading text-lg font-bold text-text-primary">Tým</h2>
        <Link to="/zamestnanci" className="text-sm font-medium text-primary hover:underline">
          Zobrazit vše →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {staff === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[132px] animate-pulse rounded-lg bg-surface-soft shadow-raised" />
            ))
          : staff.map((member) => (
              // Celá karta je proklik na profil — jméno v platformě vždycky
              // někam vede, a tady je klikací plocha přirozeně celá karta.
              <Link
                key={member.uid}
                to={`/zamestnanci/${member.uid}`}
                className="flex flex-col items-center gap-1.5 rounded-lg bg-surface-soft p-4 text-center shadow-raised transition-shadow hover:shadow-overlay"
              >
                <EntityAvatar photoURL={member.avatarUrl} label={member.displayName} size="lg" ring className="size-12" />
                <p className="mt-1 w-full truncate text-sm font-semibold text-text-primary">{member.displayName}</p>
                <p className="w-full truncate text-xs text-text-secondary">{STAFF_ROLE_LABELS[member.role as keyof typeof STAFF_ROLE_LABELS] ?? member.role}</p>
              </Link>
            ))}
      </div>
    </section>
  )
}
