import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Baby, ChevronRight, Search } from '@/components/ui/icons'
import { MobileShell } from '@/components/mobile/MobileShell'
import { MobileFamilyNavTabs } from '@/components/mobile/MobileFamilyNavTabs'
import { GroupedList, GroupedListRow } from '@/components/mobile/GroupedList'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { listChildrenForOrg, listFamiliesWithDocIds } from '@/services/familyService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'

/**
 * Mobilní Děti (M11 doplněno 2026-07-22) — stejný princip jako
 * `MobileFosterPersonListPage`: ťuknutí naviguje na mobilní profil RODINY
 * (`/mobil/rodiny/:uid`), žádný samostatný mobilní profil dítěte (v terénu
 * není co dělat s rodným číslem samotným, jen dohledat rodinu).
 */
export default function MobileChildListPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [rows, setRows] = useState<Array<{ docId: string; child: import('@/types/child').ChildDoc }> | null>(null)
  const [familiesByDocId, setFamiliesByDocId] = useState<Record<string, { uid: string; label: string }>>({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!organizationId) return
    Promise.all([listChildrenForOrg(organizationId), listFamiliesWithDocIds(organizationId)]).then(([children, fams]) => {
      setRows(children)
      const map: Record<string, { uid: string; label: string }> = {}
      for (const { docId, family } of fams) map[docId] = { uid: family.uid, label: resolveFamilyDisplayName(family, null) }
      setFamiliesByDocId(map)
    })
  }, [organizationId])

  const filtered = useMemo(() => {
    if (!rows) return null
    const q = search.trim().toLowerCase()
    return rows
      .map((row) => ({ ...row, name: `${row.child.firstName} ${row.child.lastName}` }))
      .filter((row) => !q || row.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  }, [rows, search])

  return (
    <MobileShell>
      <div className="flex flex-col gap-4 px-5 pb-6 pt-6">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-text-primary">Děti</h1>
        <MobileFamilyNavTabs active="deti" />
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat dítě…" className="h-12 pl-10 text-base" />
        </div>

        {filtered === null ? (
          <p className="text-base text-text-secondary">Načítám…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Baby} text="Žádné dítě neodpovídá hledání." />
        ) : (
          <GroupedList>
            {filtered.map(({ docId, name, child }) => {
              const fam = familiesByDocId[child.familyId]
              return (
                <GroupedListRow key={docId} onClick={() => fam && navigate(`/mobil/rodiny/${fam.uid}`)}>
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    <span className="text-lg font-medium text-text-primary">{name}</span>
                    {fam && <span className="text-base text-text-secondary">{fam.label}</span>}
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
                </GroupedListRow>
              )
            })}
          </GroupedList>
        )}
      </div>
    </MobileShell>
  )
}
