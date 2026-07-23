import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { listFamiliesWithDocIds, listFosterPersonsForOrg } from '@/services/familyService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { Search, UserRound } from 'lucide-react'

const TABLE_COLUMNS = '1.3fr 1.3fr 1fr 1.3fr'

/**
 * /pestouni — plochý seznam VŠECH pěstounů organizace napříč rodinami
 * (na žádost Petra, 2026-07-22 — dřív dostupní jen přes profil konkrétní
 * rodiny). Read-only přehled, žádosti/editace zůstávají na
 * `FosterPersonDetailPage` (přes klik na řádek) — stejné dělení jako
 * `FamilyListPage` vs. `FamilyDetailPage`.
 */
export default function FosterPersonListPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [rows, setRows] = useState<Array<{ docId: string; fosterPerson: import('@/types/fosterPerson').FosterPersonDoc }> | null>(null)
  const [familiesByDocId, setFamiliesByDocId] = useState<Record<string, { uid: string; label: string }>>({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    setError(null)
    Promise.all([listFosterPersonsForOrg(organizationId), listFamiliesWithDocIds(organizationId)])
      .then(([fosters, fams]) => {
        setRows(fosters)
        const map: Record<string, { uid: string; label: string }> = {}
        for (const { docId, family } of fams) map[docId] = { uid: family.uid, label: resolveFamilyDisplayName(family, null) }
        setFamiliesByDocId(map)
      })
      .catch(() => setError('Seznam pěstounů se nepodařilo načíst.'))
  }, [organizationId])

  const filtered = useMemo(() => {
    if (!rows) return null
    const q = search.trim().toLowerCase()
    return rows
      .map((row) => ({ ...row, name: `${row.fosterPerson.firstName} ${row.fosterPerson.lastName}` }))
      .filter((row) => !q || row.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  }, [rows, search])

  return (
    <AppShell breadcrumb={[{ label: 'Pěstouni' }]}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[26px] font-bold leading-tight text-text-primary">Pěstouni</h1>
      </div>

      <div className="relative mt-4 max-w-[320px]">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat pěstouna…" className="pl-9" />
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
          <EmptyState icon={UserRound} text="Žádný pěstoun neodpovídá hledání." />
        ) : (
          <Table>
            <TableHeaderRow columns={TABLE_COLUMNS} labels={['Jméno', 'Rodina', 'Telefon', 'E-mail']} />
            {filtered.map(({ docId, fosterPerson, name }) => {
              const fam = familiesByDocId[fosterPerson.familyId]
              return (
                <div key={docId} onClick={() => fam && navigate(`/rodiny/${fam.uid}/pestoun/${docId}`)} className="contents cursor-pointer">
                  <TableRow columns={TABLE_COLUMNS}>
                    <span className="text-sm font-medium text-text-primary">{name}</span>
                    <span className="truncate text-sm text-text-secondary">{fam?.label ?? '—'}</span>
                    <span className="text-sm text-text-secondary">
                      {fosterPerson.phone ? (
                        <a href={`tel:${fosterPerson.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-text-primary hover:underline">
                          {fosterPerson.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </span>
                    <span className="truncate text-sm text-text-secondary">{fosterPerson.email ?? '—'}</span>
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
