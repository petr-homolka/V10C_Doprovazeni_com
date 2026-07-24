import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { RecordCard, RecordCardList, MetaColumn } from '@/components/ui/record-card'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { RowMenu, type RowMenuItem } from '@/components/ui/row-menu'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/useAuth'
import { listFamiliesWithDocIds, listFosterPersonsForOrg } from '@/services/familyService'
import { uploadEntityAvatar } from '@/services/avatarService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { ageFromBirthDate, formatBirthDateCs } from '@/lib/birthNumber'
import { Search, UserRound } from 'lucide-react'

/**
 * /pestouni — plochý seznam VŠECH pěstounů organizace napříč rodinami.
 * Read-only přehled, editace zůstává na `FosterPersonDetailPage` (klik na
 * řádek) — stejné dělení jako `FamilyListPage` vs. `FamilyDetailPage`.
 */
export default function FosterPersonListPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [rows, setRows] = useState<Array<{ docId: string; fosterPerson: import('@/types/fosterPerson').FosterPersonDoc }> | null>(null)
  const [familiesByDocId, setFamiliesByDocId] = useState<Record<string, { uid: string; label: string }>>({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoForRef = useRef<string | null>(null)

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      const [fosters, fams] = await Promise.all([
        listFosterPersonsForOrg(organizationId),
        listFamiliesWithDocIds(organizationId),
      ])
      setRows(fosters)
      const map: Record<string, { uid: string; label: string }> = {}
      for (const { docId, family } of fams) map[docId] = { uid: family.uid, label: resolveFamilyDisplayName(family, null) }
      setFamiliesByDocId(map)
    } catch {
      setError('Seznam pěstounů se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  /** Nahrání fotky přímo ze seznamu — nemusí se kvůli tomu otevírat profil. */
  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const id = photoForRef.current
    if (!file || !id) return
    setError(null)
    try {
      await uploadEntityAvatar({ kind: 'fosterPerson', id, file })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotku se nepodařilo nahrát.')
    }
  }

  const filtered = useMemo(() => {
    if (!rows) return null
    const q = search.trim().toLowerCase()
    return rows
      .map((row) => ({ ...row, name: `${row.fosterPerson.firstName} ${row.fosterPerson.lastName}` }))
      .filter((row) => !q || row.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  }, [rows, search])

  return (
    <AppShell breadcrumb={[{ label: 'Pěstouni' }]} fullBleed>
      <div className="flex h-full min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-8">
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

            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoFile}
            />

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
                    const menuItems: RowMenuItem[] = [
                      {
                        label: fp.avatarUrl ? 'Změnit fotku' : 'Nahrát fotku',
                        onSelect: () => {
                          photoForRef.current = docId
                          photoInputRef.current?.click()
                        },
                      },
                    ]
                    if (fp.phone) menuItems.push({ label: `Zavolat ${fp.phone}`, onSelect: () => { window.location.href = `tel:${fp.phone}` } })
                    if (fp.email) menuItems.push({ label: 'Napsat e-mail', onSelect: () => { window.location.href = `mailto:${fp.email}` } })
                    if (fam) menuItems.push({ label: 'Otevřít rodinu', onSelect: () => navigate(`/rodiny/${fam.uid}`) })
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
                        trailing={<RowMenu items={menuItems} />}
                      />
                    )
                  })}
                </RecordCardList>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
