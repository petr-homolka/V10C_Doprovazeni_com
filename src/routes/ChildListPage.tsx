import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { RecordCard, RecordCardList } from '@/components/ui/record-card'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { RowMenu, type RowMenuItem } from '@/components/ui/row-menu'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { SidePanel } from '@/components/ui/side-panel'
import { EmptyState } from '@/components/ui/empty-state'
import { PersonLink } from '@/components/ui/person-link'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { addChildToFamily, listChildrenForOrg, listFamiliesWithDocIds } from '@/services/familyService'
import { getOrganization } from '@/services/organizationService'
import { uploadEntityAvatar } from '@/services/avatarService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import {
  resolveChildBirthDate,
  genderFromBirthNumber,
  ageFromBirthDate,
  formatBirthDateCs,
  birthDateFromBirthNumber,
} from '@/lib/birthNumber'
import { Baby, Plus, Search } from '@/components/ui/icons'

/**
 * /deti — plochý seznam VŠECH dětí organizace napříč rodinami. Řádek ve
 * stylu Woorkroom reference: fotka + jméno, a sloupce „LABEL nad hodnotou"
 * (Rodina / Pohlaví / Narození / Věk). Pohlaví, narození i věk se dopočtou
 * z rodného čísla. Jméno i rodina jsou proklik na profil.
 */
export default function ChildListPage() {
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [rows, setRows] = useState<Array<{ docId: string; child: import('@/types/child').ChildDoc }> | null>(null)
  const [familiesByDocId, setFamiliesByDocId] = useState<Record<string, { uid: string; label: string }>>({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const photoForRef = useRef<string | null>(null)

  /** Zakládání dítěte PŘÍMO odsud (2026-07-24) — dřív jen z profilu rodiny.
   * Rodina se vybírá v panelu, protože dítě bez rodiny nemá v datovém
   * modelu kde být (`ChildDoc.familyId`). */
  const [creating, setCreating] = useState(false)
  const [newFamilyDocId, setNewFamilyDocId] = useState('')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newBirthNumber, setNewBirthNumber] = useState('')
  const { loading: saving, run: runSave } = useAsyncSubmit()

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      const [children, fams] = await Promise.all([
        listChildrenForOrg(organizationId),
        listFamiliesWithDocIds(organizationId),
      ])
      setRows(children)
      const map: Record<string, { uid: string; label: string }> = {}
      for (const { docId, family } of fams) map[docId] = { uid: family.uid, label: resolveFamilyDisplayName(family, null) }
      setFamiliesByDocId(map)
    } catch {
      setError('Seznam dětí se nepodařilo načíst.')
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
      await uploadEntityAvatar({ kind: 'child', id, file })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotku se nepodařilo nahrát.')
    }
  }

  function openCreate() {
    setNewFamilyDocId('')
    setNewFirstName('')
    setNewLastName('')
    setNewBirthNumber('')
    setError(null)
    setCreating(true)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!organizationId || !newFamilyDocId) return
    setError(null)
    try {
      await runSave(async () => {
        const org = await getOrganization(organizationId)
        if (!org) throw new Error('Organizace nenalezena.')
        await addChildToFamily(newFamilyDocId, organizationId, org.orgCode, {
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          birthNumber: newBirthNumber.trim(),
        })
        await reload()
      })
      setCreating(false)
    } catch {
      setError('Dítě se nepodařilo založit.')
    }
  }

  const familyOptions = useMemo(
    () =>
      Object.entries(familiesByDocId)
        .map(([docId, fam]) => ({ value: docId, label: fam.label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'cs')),
    [familiesByDocId],
  )

  /** Náhled dopočteného data narození — okamžitá kontrola, že RČ je opsané
   * správně, ještě před uložením. */
  const newBirthDatePreview = useMemo(() => birthDateFromBirthNumber(newBirthNumber), [newBirthNumber])

  const filtered = useMemo(() => {
    if (!rows) return null
    const q = search.trim().toLowerCase()
    return rows
      .map((row) => ({ ...row, name: `${row.child.firstName} ${row.child.lastName}` }))
      .filter((row) => !q || row.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  }, [rows, search])

  const sidePanel = creating ? (
    <SidePanel title="Nové dítě" onClose={() => setCreating(false)}>
      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg bg-inset p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Rodina</h3>
          <Combobox
            options={familyOptions}
            value={newFamilyDocId}
            onChange={setNewFamilyDocId}
            placeholder="Vybrat rodinu…"
            emptyText="Žádná rodina neodpovídá."
          />
          {familyOptions.length === 0 && (
            <p className="text-xs text-text-tertiary">
              Zatím není žádná rodina — nejdřív ji založte v sekci Rodiny.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-inset p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Dítě</h3>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Jméno</span>
            <Input required value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Příjmení</span>
            <Input required value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Rodné číslo</span>
            <Input
              required
              value={newBirthNumber}
              onChange={(e) => setNewBirthNumber(e.target.value)}
              placeholder="150612/1234"
            />
            <span className="text-xs text-text-tertiary">
              {newBirthDatePreview
                ? `Datum narození: ${new Date(newBirthDatePreview).toLocaleDateString('cs-CZ')}`
                : 'Datum narození i pohlaví se dopočítají z rodného čísla.'}
            </span>
          </label>
        </div>

        <Button type="submit" loading={saving} disabled={!newFamilyDocId}>
          Založit dítě
        </Button>
      </form>
    </SidePanel>
  ) : undefined

  return (
    <AppShell breadcrumb={[{ label: 'Děti' }]} fullBleed sidePanel={sidePanel}>
      <div className="flex h-full min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h1 className="font-heading text-xl font-bold leading-tight text-text-primary">
                Děti {filtered && <span className="text-text-tertiary">({filtered.length})</span>}
              </h1>
              <Button size="sm" onClick={openCreate}>
                <Plus size={16} /> Nové dítě
              </Button>
            </div>

            <div className="relative max-w-[320px]">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat dítě…" className="pl-9" />
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
                  <EmptyState icon={Baby} text="Žádné dítě neodpovídá hledání." />
                </div>
              ) : (
                <RecordCardList
                  cellCount={3}
                  headers={['Rodina', 'Narození', 'Věk']}
                  lead={32}
                  trail={32}
                  columns={{
                    lg: 'minmax(220px,1fr) minmax(0,200px) minmax(0,130px) minmax(0,90px)',
                    md: 'minmax(200px,1fr) minmax(0,180px) minmax(0,130px)',
                    sm: 'minmax(160px,1fr) minmax(0,170px)',
                  }}
                >
                  {filtered.map(({ docId, child, name }) => {
                    const fam = familiesByDocId[child.familyId]
                    const profileHref = fam ? `/rodiny/${fam.uid}/dite/${docId}` : undefined
                    const bd = resolveChildBirthDate(child)
                    const gender = genderFromBirthNumber(child.birthNumber)
                    const age = ageFromBirthDate(bd)
                    const menuItems: RowMenuItem[] = [
                      {
                        label: child.avatarUrl ? 'Změnit fotku' : 'Nahrát fotku',
                        onSelect: () => {
                          photoForRef.current = docId
                          photoInputRef.current?.click()
                        },
                      },
                    ]
                    if (fam) menuItems.push({ label: 'Otevřít rodinu', onSelect: () => navigate(`/rodiny/${fam.uid}`) })
                    return (
                      <RecordCard
                        key={docId}
                        onClick={profileHref ? () => navigate(profileHref) : undefined}
                        leading={<EntityAvatar photoURL={child.avatarUrl} label={name} fallbackIcon={Baby} />}
                        title={<PersonLink kind="child" id={docId} familyUid={fam?.uid} name={name} />}
                        subtitle={
                          <>
                            <span className="font-mono">{child.birthNumber}</span>
                            {gender && ` · ${gender}`}
                          </>
                        }
                        cells={[
                          {
                            label: 'Rodina',
                            value: fam ? (
                              <Link
                                to={`/rodiny/${fam.uid}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-primary hover:underline"
                              >
                                {fam.label}
                              </Link>
                            ) : (
                              '—'
                            ),
                          },
                          { label: 'Narození', value: formatBirthDateCs(bd) },
                          // Věk i pohlaví jsou dopočet z rodného čísla, které je
                          // v podtextu — proto jsou až poslední a mizí první.
                          { label: 'Věk', value: age != null ? `${age} let` : '—', align: 'right' },
                        ]}
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
