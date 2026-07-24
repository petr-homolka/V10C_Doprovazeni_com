import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { RecordCard, RecordCardList, MetaColumn } from '@/components/ui/record-card'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { RowMenu } from '@/components/ui/row-menu'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { listFamiliesWithDocIds, listFosterPersonsForOrg } from '@/services/familyService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { ageFromBirthDate, formatBirthDateCs } from '@/lib/birthNumber'
import { Search, UserRound } from 'lucide-react'

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
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="font-heading text-[26px] font-bold leading-tight text-text-primary">
          Pěstouni {filtered && <span className="text-text-tertiary">({filtered.length})</span>}
        </h1>
      </div>

      <div className="relative max-w-[320px]">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat pěstouna…" className="pl-9" />
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4">
        {filtered === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg bg-surface-soft p-8 shadow-raised">
            <EmptyState icon={UserRound} text="Žádný pěstoun neodpovídá hledání." />
          </div>
        ) : (
          <RecordCardList>
            {filtered.map(({ docId, fosterPerson: fp, name }) => {
              const fam = familiesByDocId[fp.familyId]
              const profileHref = fam ? `/rodiny/${fam.uid}/pestoun/${docId}` : undefined
              const age = ageFromBirthDate(fp.birthDate)
              return (
                <RecordCard
                  key={docId}
                  onClick={profileHref ? () => navigate(profileHref) : undefined}
                  leading={<EntityAvatar photoURL={fp.avatarUrl} label={name} fallbackIcon={UserRound} />}
                  title={name}
                  subtitle={fp.email ?? undefined}
                  meta={
                    <>
                      <MetaColumn
                        label="Rodina"
                        hideBelow="sm"
                        value={
                          fam ? (
                            <Link
                              to={`/rodiny/${fam.uid}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-text-secondary hover:text-primary hover:underline"
                            >
                              {fam.label}
                            </Link>
                          ) : (
                            '—'
                          )
                        }
                      />
                      <MetaColumn
                        label="Telefon"
                        value={
                          fp.phone ? (
                            <a href={`tel:${fp.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline">
                              {fp.phone}
                            </a>
                          ) : (
                            '—'
                          )
                        }
                      />
                      <MetaColumn label="Narození" value={formatBirthDateCs(fp.birthDate)} />
                      <MetaColumn label="Věk" width="w-16" value={age != null ? `${age} let` : '—'} />
                    </>
                  }
                  trailing={
                    profileHref ? (
                      <RowMenu items={[{ label: 'Otevřít profil', onSelect: () => navigate(profileHref) }]} />
                    ) : undefined
                  }
                />
              )
            })}
          </RecordCardList>
        )}
      </div>
    </AppShell>
  )
}
