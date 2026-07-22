import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Baby, Search } from 'lucide-react'
import { MobileShell } from '@/components/mobile/MobileShell'
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
        <h1 className="text-2xl font-normal text-text-primary">Děti</h1>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat dítě…" className="h-12 pl-10 text-base" />
        </div>

        <div className="flex flex-col gap-2">
          {filtered === null ? (
            <p className="text-sm text-text-secondary">Načítám…</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Baby} text="Žádné dítě neodpovídá hledání." />
          ) : (
            filtered.map(({ docId, name, child }) => {
              const fam = familiesByDocId[child.familyId]
              return (
                <button
                  key={docId}
                  type="button"
                  onClick={() => fam && navigate(`/mobil/rodiny/${fam.uid}`)}
                  className="flex flex-col items-start gap-0.5 rounded-lg border border-border bg-surface-soft p-4 text-left"
                >
                  <span className="text-base font-medium text-text-primary">{name}</span>
                  {fam && <span className="text-sm text-text-secondary">{fam.label}</span>}
                </button>
              )
            })
          )}
        </div>
      </div>
    </MobileShell>
  )
}
