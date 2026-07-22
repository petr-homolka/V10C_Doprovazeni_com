import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Search, UserRound } from 'lucide-react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { listFamiliesWithDocIds, listFosterPersonsForOrg } from '@/services/familyService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'

/**
 * Mobilní Pěstouni (M11 doplněno 2026-07-22) — stejný "velké dotykové cíle,
 * ne zmenšenina tabulky" princip jako `MobileFamiliesPage`. Ťuknutí na
 * telefon rovnou VOLÁ (`tel:`), ťuknutí na kartu naviguje na mobilní
 * profil RODINY (`/mobil/rodiny/:uid`) — vlastní mobilní profil pěstouna
 * (vzdělávání/kurzy/plán) by v terénu nikdo neřešil, tohle je jen rychlé
 * dohledání kontaktu.
 */
export default function MobileFosterPersonListPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [rows, setRows] = useState<Array<{ docId: string; fosterPerson: import('@/types/fosterPerson').FosterPersonDoc }> | null>(null)
  const [familiesByDocId, setFamiliesByDocId] = useState<Record<string, { uid: string; label: string }>>({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!organizationId) return
    Promise.all([listFosterPersonsForOrg(organizationId), listFamiliesWithDocIds(organizationId)]).then(([fosters, fams]) => {
      setRows(fosters)
      const map: Record<string, { uid: string; label: string }> = {}
      for (const { docId, family } of fams) map[docId] = { uid: family.uid, label: resolveFamilyDisplayName(family, null) }
      setFamiliesByDocId(map)
    })
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
    <MobileShell>
      <div className="flex flex-col gap-4 px-5 pb-6 pt-6">
        <h1 className="text-2xl font-normal text-text-primary">Pěstouni</h1>
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat pěstouna…" className="h-12 pl-10 text-base" />
        </div>

        <div className="flex flex-col gap-2">
          {filtered === null ? (
            <p className="text-sm text-text-secondary">Načítám…</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon={UserRound} text="Žádný pěstoun neodpovídá hledání." />
          ) : (
            filtered.map(({ docId, fosterPerson, name }) => {
              const fam = familiesByDocId[fosterPerson.familyId]
              return (
                <button
                  key={docId}
                  type="button"
                  onClick={() => fam && navigate(`/mobil/rodiny/${fam.uid}`)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-soft p-4 text-left"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-base font-medium text-text-primary">{name}</span>
                    {fam && <span className="text-sm text-text-secondary">{fam.label}</span>}
                  </span>
                  {fosterPerson.phone && (
                    <a
                      href={`tel:${fosterPerson.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Zavolat ${name}`}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                    >
                      <Phone size={18} />
                    </a>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </MobileShell>
  )
}
