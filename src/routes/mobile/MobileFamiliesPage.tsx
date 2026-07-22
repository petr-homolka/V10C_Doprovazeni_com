import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { listFamiliesWithDocIds, listFosterPersonsByRefs } from '@/services/familyService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { FamilyDoc } from '@/types/family'

/**
 * Mobilní Rodiny (M11) — jednoduchý vyhledatelný seznam s VELKÝMI
 * dotykovými cíli, ne zmenšenina desktopové tabulky (`FamilyListPage`
 * má checkboxy/hvězdičky/segmentaci — na 390px by to bylo nepoužitelné).
 * Ťuknutí vede na `MobileFamilyDetailPage` (vlastní, zjednodušená mobilní
 * varianta — ne plný desktopový profil s deseti sekcemi).
 */
export default function MobileFamiliesPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }> | null>(null)
  const [fosterNamesById, setFosterNamesById] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!userDoc?.organizationId) return
    listFamiliesWithDocIds(userDoc.organizationId).then(async (fams) => {
      setFamilies(fams)
      // Stejný "primární pěstoun" fallback jako desktopová `FamilyListPage`
      // (`resolveFamilyDisplayName`) — bez tohohle by se u rodin bez
      // ručně nastaveného `displayName` zobrazila adresa DVAKRÁT (jednou
      // jako "název", jednou jako podtitulek).
      const firstRefs = fams.map((r) => r.family.fosterPersonRefs[0]).filter((id): id is string => !!id)
      const fosters = await listFosterPersonsByRefs([...new Set(firstRefs)])
      const map: Record<string, string> = {}
      for (const { docId, fosterPerson } of fosters) map[docId] = `${fosterPerson.firstName} ${fosterPerson.lastName}`
      setFosterNamesById(map)
    })
  }, [userDoc?.organizationId])

  const filtered = useMemo(() => {
    if (!families) return null
    const q = search.trim().toLowerCase()
    return families
      .map((row) => {
        const primaryFosterName = row.family.fosterPersonRefs[0] ? (fosterNamesById[row.family.fosterPersonRefs[0]] ?? null) : null
        return { ...row, label: resolveFamilyDisplayName(row.family, primaryFosterName) }
      })
      .filter((row) => !q || row.label.toLowerCase().includes(q) || row.family.address?.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label, 'cs'))
  }, [families, fosterNamesById, search])

  return (
    <MobileShell>
      <div className="flex flex-col gap-4 px-5 pb-6 pt-6">
        <h1 className="text-2xl font-normal text-text-primary">Rodiny</h1>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat rodinu…"
            className="h-12 pl-10 text-base"
          />
        </div>

        <div className="flex flex-col gap-2">
          {filtered === null ? (
            <p className="text-sm text-text-secondary">Načítám…</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} text="Žádná rodina neodpovídá hledání." />
          ) : (
            filtered.map(({ docId, family, label }) => (
              <button
                key={docId}
                type="button"
                onClick={() => navigate(`/mobil/rodiny/${family.uid}`)}
                className="flex flex-col items-start gap-0.5 rounded-lg border border-border bg-surface-soft p-4 text-left"
              >
                <span className="text-base font-medium text-text-primary">{label}</span>
                {family.address && family.address !== label && (
                  <span className="text-sm text-text-secondary">{family.address}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </MobileShell>
  )
}
