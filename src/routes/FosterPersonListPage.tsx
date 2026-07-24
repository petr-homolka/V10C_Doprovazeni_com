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
import { DatePicker } from '@/components/ui/date-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { PersonLink } from '@/components/ui/person-link'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { addFosterPersonToFamily, listFamiliesWithDocIds, listFosterPersonsForOrg } from '@/services/familyService'
import { getOrganization } from '@/services/organizationService'
import { uploadEntityAvatar } from '@/services/avatarService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { checkEmail, checkPhone } from '@/lib/contactValidation'
import { ageFromBirthDate, formatBirthDateCs } from '@/lib/birthNumber'
import { Plus, Search, UserRound } from 'lucide-react'

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

  /** Zakládání pěstouna PŘÍMO odsud (2026-07-24) — dřív šlo jen z profilu
   * rodiny, takže kdo měl pěstouna po ruce a rodinu už zavedenou, musel se
   * k ní nejdřív proklikat. Rodina se vybírá v panelu, protože pěstoun bez
   * rodiny nemá v datovém modelu kde být (`FosterPersonDoc.familyId`). */
  const [creating, setCreating] = useState(false)
  const [newFamilyDocId, setNewFamilyDocId] = useState('')
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPhoneError, setNewPhoneError] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newEmailError, setNewEmailError] = useState<string | null>(null)
  const [newBirthDate, setNewBirthDate] = useState('')
  const { loading: saving, run: runSave } = useAsyncSubmit()

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

  function openCreate() {
    setNewFamilyDocId('')
    setNewFirstName('')
    setNewLastName('')
    setNewPhone('')
    setNewPhoneError(null)
    setNewEmail('')
    setNewEmailError(null)
    setNewBirthDate('')
    setError(null)
    setCreating(true)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!organizationId || !newFamilyDocId) return
    const phone = newPhone.trim()
    const email = newEmail.trim()
    // Stejná validace jako na profilu rodiny — telefon/e-mail se nesmí
    // rozejít podle toho, odkud se pěstoun zakládá.
    const phoneCheck = phone ? checkPhone(phone) : null
    if (phoneCheck && !phoneCheck.ok) {
      setNewPhoneError(phoneCheck.message ?? 'Neplatné telefonní číslo.')
      return
    }
    const emailCheck = email ? checkEmail(email) : null
    if (emailCheck && !emailCheck.ok) {
      setNewEmailError(emailCheck.message ?? 'Neplatný e-mail.')
      return
    }
    setError(null)
    try {
      await runSave(async () => {
        const org = await getOrganization(organizationId)
        if (!org) throw new Error('Organizace nenalezena.')
        await addFosterPersonToFamily(newFamilyDocId, organizationId, org.orgCode, {
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          ...(phoneCheck?.ok ? { phone: phoneCheck.value } : {}),
          ...(emailCheck?.ok ? { email: emailCheck.value } : {}),
          ...(newBirthDate ? { birthDate: newBirthDate } : {}),
        })
        await reload()
      })
      setCreating(false)
    } catch {
      setError('Pěstouna se nepodařilo založit.')
    }
  }

  const familyOptions = useMemo(
    () =>
      Object.entries(familiesByDocId)
        .map(([docId, fam]) => ({ value: docId, label: fam.label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'cs')),
    [familiesByDocId],
  )

  const filtered = useMemo(() => {
    if (!rows) return null
    const q = search.trim().toLowerCase()
    return rows
      .map((row) => ({ ...row, name: `${row.fosterPerson.firstName} ${row.fosterPerson.lastName}` }))
      .filter((row) => !q || row.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  }, [rows, search])

  const sidePanel = creating ? (
    <SidePanel title="Nový pěstoun" onClose={() => setCreating(false)}>
      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg bg-inset p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Rodina</h3>
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
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Osoba</h3>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Jméno</span>
            <Input required value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Příjmení</span>
            <Input required value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Datum narození</span>
            <DatePicker value={newBirthDate} onChange={setNewBirthDate} />
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-inset p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Kontakt</h3>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Telefon</span>
            <Input
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value)
                setNewPhoneError(null)
              }}
            />
            {newPhoneError && <span className="text-xs text-danger">{newPhoneError}</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">E-mail</span>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value)
                setNewEmailError(null)
              }}
            />
            {newEmailError && <span className="text-xs text-danger">{newEmailError}</span>}
          </label>
        </div>

        <Button type="submit" loading={saving} disabled={!newFamilyDocId}>
          Založit pěstouna
        </Button>
      </form>
    </SidePanel>
  ) : undefined

  return (
    <AppShell breadcrumb={[{ label: 'Pěstouni' }]} fullBleed sidePanel={sidePanel}>
      <div className="flex h-full min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h1 className="font-heading text-[26px] font-bold leading-tight text-text-primary">
                Pěstouni {filtered && <span className="text-text-tertiary">({filtered.length})</span>}
              </h1>
              <Button size="sm" onClick={openCreate}>
                <Plus size={16} /> Nový pěstoun
              </Button>
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
                <RecordCardList
                  cellCount={3}
                  columns={{
                    lg: 'minmax(220px,1fr) minmax(0,200px) minmax(0,150px) minmax(0,120px)',
                    md: 'minmax(200px,1fr) minmax(0,180px) minmax(0,150px)',
                    sm: 'minmax(160px,1fr) minmax(0,160px)',
                  }}
                >
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
                        title={<PersonLink kind="fosterPerson" id={docId} familyUid={fam?.uid} name={name} />}
                        subtitle={
                          // Věk se vejde k e-mailu — vlastní sloupec by byl
                          // čtvrtý a na první užší šířce by zmizel (§4).
                          [fp.email, age != null ? `${age} let` : null].filter(Boolean).join(' · ') || undefined
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
                          {
                            label: 'Telefon',
                            value: fp.phone ? (
                              <a href={`tel:${fp.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline">
                                {fp.phone}
                              </a>
                            ) : (
                              '—'
                            ),
                          },
                          { label: 'Narození', value: formatBirthDateCs(fp.birthDate), align: 'right' },
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
