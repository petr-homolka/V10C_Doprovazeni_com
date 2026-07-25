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
    <div>
      {/* Nadpis „Tým" i odkaz na seznam nese `SpisSection` v levém okraji —
          druhý nadpis uvnitř karty by byl tentýž titulek dvakrát. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {staff === null
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="sp__sub h-[128px] animate-pulse" />
            ))
          : staff.map((member) => (
              // Celá karta je proklik na profil — jméno v platformě vždycky
              // někam vede, a tady je klikací plocha přirozeně celá karta.
              <Link
                key={member.uid}
                to={`/zamestnanci/${member.uid}`}
                className="sp__sub flex flex-col items-center gap-1.5 text-center transition-colors hover:bg-overlay-hover"
              >
                <EntityAvatar photoURL={member.avatarUrl} label={member.displayName} size="lg" ring className="size-12" />
                <p className="mt-1 w-full truncate text-sm text-text-primary">{member.displayName}</p>
                <p className="w-full truncate text-xs text-text-tertiary">{STAFF_ROLE_LABELS[member.role as keyof typeof STAFF_ROLE_LABELS] ?? member.role}</p>
              </Link>
            ))}
      </div>
    </div>
  )
}
