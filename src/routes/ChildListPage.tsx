import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { listChildrenForOrg, listFamiliesWithDocIds } from '@/services/familyService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { Baby, Search } from 'lucide-react'

const TABLE_COLUMNS = '1.3fr 1.3fr 1.2fr 1fr'

/**
 * /deti — plochý seznam VŠECH dětí organizace napříč rodinami (na žádost
 * Petra, 2026-07-22 — dřív dostupné jen přes profil konkrétní rodiny).
 * Read-only přehled, stejné dělení jako `FosterPersonListPage`.
 */
export default function ChildListPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [rows, setRows] = useState<Array<{ docId: string; child: import('@/types/child').ChildDoc }> | null>(null)
  const [familiesByDocId, setFamiliesByDocId] = useState<Record<string, { uid: string; label: string }>>({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    setError(null)
    Promise.all([listChildrenForOrg(organizationId), listFamiliesWithDocIds(organizationId)])
      .then(([children, fams]) => {
        setRows(children)
        const map: Record<string, { uid: string; label: string }> = {}
        for (const { docId, family } of fams) map[docId] = { uid: family.uid, label: resolveFamilyDisplayName(family, null) }
        setFamiliesByDocId(map)
      })
      .catch(() => setError('Seznam dětí se nepodařilo načíst.'))
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
    <AppShell breadcrumb={[{ label: 'Děti' }]}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[26px] font-bold leading-tight text-text-primary">Děti</h1>
      </div>

      <div className="relative mt-4 max-w-[320px]">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat dítě…" className="pl-9" />
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 max-w-[928px]">
        {filtered === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Baby} text="Žádné dítě neodpovídá hledání." />
        ) : (
          <Table>
            <TableHeaderRow columns={TABLE_COLUMNS} labels={['Jméno', 'Rodina', 'Rodné číslo', 'Datum narození']} />
            {filtered.map(({ docId, child, name }) => {
              const fam = familiesByDocId[child.familyId]
              return (
                <div key={docId} onClick={() => fam && navigate(`/rodiny/${fam.uid}/dite/${docId}`)} className="contents cursor-pointer">
                  <TableRow columns={TABLE_COLUMNS}>
                    <span className="text-sm font-medium text-text-primary">{name}</span>
                    <span className="truncate text-sm text-text-secondary">{fam?.label ?? '—'}</span>
                    <span className="font-mono text-sm text-text-secondary">{child.birthNumber}</span>
                    <span className="text-sm text-text-secondary">{child.birthDate ?? '—'}</span>
                  </TableRow>
                </div>
              )
            })}
          </Table>
        )}
      </div>
    </AppShell>
  )
}
