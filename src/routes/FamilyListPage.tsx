import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { VoiceRecorderModal } from '@/components/timeline/VoiceRecorderModal'
import { useAuth } from '@/hooks/useAuth'
import { getOrganization } from '@/services/organizationService'
import { createFamily, listFamiliesWithDocIds } from '@/services/familyService'
import type { FamilyDoc } from '@/types/family'
import { Users } from 'lucide-react'

const TABLE_COLUMNS = '40px 2fr 1fr'

/**
 * /rodiny — M1 základ. Zatím jen identifikace (UID) + adresa; pěstouni a
 * děti se přidávají na detailu (FamilyDetailPage), ne tady při založení —
 * Spis smí existovat i bez nich (§4.5: Spis je nezávislá evidenční
 * jednotka, ne odvozená od toho, kdo je zrovna v ní zapsaný).
 */
export default function FamilyListPage() {
  const { userDoc } = useAuth()
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [address, setAddress] = useState('')
  const [recorderFamily, setRecorderFamily] = useState<{ docId: string; label: string } | null>(null)

  const organizationId = userDoc?.organizationId

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      setFamilies(await listFamiliesWithDocIds(organizationId))
    } catch {
      setError('Seznam rodin se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!organizationId) return
    setSubmitting(true)
    setError(null)
    try {
      const org = await getOrganization(organizationId)
      if (!org) throw new Error('org not found')
      await createFamily(organizationId, org.orgCode, address || undefined)
      setAddress('')
      setShowForm(false)
      await reload()
    } catch {
      setError('Založení rodiny se nezdařilo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!organizationId) {
    return (
      <AppShell breadcrumb={[{ label: 'Rodiny' }]}>
        <h1 className="text-lg font-normal leading-normal text-text-primary">Rodiny</h1>
        <p className="mt-4 text-sm text-text-secondary">
          Tahle stránka je pro zaměstnance konkrétní organizace.
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumb={[{ label: 'Rodiny' }]}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-normal leading-normal text-text-primary">Rodiny</h1>
        <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Zrušit' : '+ Nová rodina'}
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
        >
          <label className="flex max-w-[420px] flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">
              Adresa (volitelné)
            </span>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? 'Zakládám…' : 'Založit Spis'}
          </Button>
        </form>
      )}

      <div className="mt-6">
        {families === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : families.length === 0 ? (
          <EmptyState icon={Users} text="Zatím tu nejsou žádné rodiny." />
        ) : (
          <Table>
            <TableHeaderRow columns={TABLE_COLUMNS} labels={['', 'Adresa', 'Pěstouni']} />
            {families.map(({ docId, family }) => (
              <Link key={family.uid} to={`/rodiny/${family.uid}`} className="contents">
                <TableRow columns={TABLE_COLUMNS}>
                  <EntityAvatar
                    photoURL={family.avatarUrl}
                    label={family.address || 'Spis'}
                    fallbackIcon={Users}
                    onQuickRecord={() =>
                      setRecorderFamily({ docId, label: family.address || 'Spis' })
                    }
                  />
                  <span className="truncate text-sm text-text-secondary">
                    {family.address || '—'}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {family.fosterPersonRefs.length}
                  </span>
                </TableRow>
              </Link>
            ))}
          </Table>
        )}
      </div>

      {recorderFamily && organizationId && userDoc && (
        <VoiceRecorderModal
          familyDocId={recorderFamily.docId}
          organizationId={organizationId}
          createdByUid={userDoc.uid}
          availableSubjects={[{ kind: 'family', id: recorderFamily.docId, label: recorderFamily.label }]}
          preselectedKeys={[`family:${recorderFamily.docId}`]}
          onClose={() => setRecorderFamily(null)}
          onSaved={reload}
        />
      )}
    </AppShell>
  )
}
