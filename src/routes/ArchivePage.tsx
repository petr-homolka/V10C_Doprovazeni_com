import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { PageHead } from '@/components/spis/PageBody'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { EntitySearch } from '@/components/search/EntitySearch'
import { useAuth } from '@/hooks/useAuth'
import { auditActor } from '@/services/auditLogService'
import { listSegmentsForOrg, unarchiveSegment } from '@/services/agreementService'
import { listFamiliesWithDocIds, listFosterPersonsByRefs } from '@/services/familyService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import {
  RETENTION_CHILD_CARE_YEARS,
  isRetentionReviewDue,
} from '@/lib/retentionPolicy'
import type { AgreementDoc } from '@/types/agreement'
import type { FamilyDoc } from '@/types/family'
import { FileText } from '@/components/ui/icons'

interface ArchivedRow {
  docId: string
  family: FamilyDoc
  agreement: AgreementDoc
  label: string
}

/**
 * /archiv — spisy, které si organizace uklidila z cesty.
 *
 * Tohle je druhá polovina archivace; ta první je, že archivovaný spis
 * NENÍ nikde jinde vidět (seznam rodin ho vynechá, fulltext ho nenabídne).
 * Zadání 2026-07-25: „tam už se s daty nepracuje a fulltext výsledky
 * z archivovaného nenabízí — pouze pokud to uživatel vysloveně chce, a to
 * může projevit pouze tím, že použije vyhledávání v sekci Archivováno".
 *
 * Proto má tahle stránka VLASTNÍ hledání (`includeArchived`), oddělené od
 * toho v hlavičce. Vyhledat archivovaného člověka jde jedině tak, že sem
 * člověk vědomě přijde — a to je právě ten výslovný projev vůle.
 *
 * Archiv NENÍ koš: data jsou nedotčená, jen skrytá. Mazání se řídí
 * retenční politikou (`lib/retentionPolicy.ts`) a u dokumentace o dítěti
 * začíná úvahou po 30 letech, ne automatickým výmazem.
 */
export default function ArchivePage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const navigate = useNavigate()

  const [rows, setRows] = useState<ArchivedRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)

  async function reload() {
    if (!organizationId) return
    setError(null)
    try {
      const [families, segments] = await Promise.all([
        listFamiliesWithDocIds(organizationId),
        listSegmentsForOrg(organizationId),
      ])
      const archived = families.filter(({ docId }) => !!segments[docId]?.archivedAt)
      const fosterRefs = [...new Set(archived.flatMap(({ family }) => family.fosterPersonRefs))]
      const fosters = fosterRefs.length > 0 ? await listFosterPersonsByRefs(fosterRefs) : []
      const nameByRef = Object.fromEntries(
        fosters.map(({ docId, fosterPerson }) => [docId, `${fosterPerson.firstName} ${fosterPerson.lastName}`]),
      )
      setRows(
        archived
          .map(({ docId, family }) => ({
            docId,
            family,
            agreement: segments[docId],
            label: resolveFamilyDisplayName(family, nameByRef[family.fosterPersonRefs[0]] ?? null),
          }))
          .sort((a, b) => (b.agreement.archivedAt ?? '').localeCompare(a.agreement.archivedAt ?? '')),
      )
    } catch {
      setError('Archiv se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const reviewDue = useMemo(() => (rows ?? []).filter((r) => isRetentionReviewDue(r.agreement.retentionReviewDueAt)), [rows])

  async function handleUnarchive(row: ArchivedRow) {
    if (!organizationId || !userDoc) return
    setBusyId(row.docId)
    setError(null)
    try {
      await unarchiveSegment(row.docId, organizationId, {
        actor: auditActor(userDoc),
        familyLabel: row.label,
      })
      await reload()
    } catch {
      setError('Vrácení z archivu se nezdařilo.')
    } finally {
      setBusyId(null)
    }
  }

  if (!organizationId) {
    return (
      <AppShell>
        <PageHead title="Archivováno" />
        <section className="sp__card sp__card--pad">
          <p className="text-sm text-text-secondary">Tahle stránka je pro zaměstnance konkrétní organizace.</p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHead
        title="Archivováno"
        description="Spisy uklizené z běžného provozu. Data zůstávají nedotčená — jen se s nimi nepracuje a fulltext je jinde nenabízí."
        count={rows?.length}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setShowSearch((v) => !v)}>
            {showSearch ? 'Skrýt hledání' : 'Hledat v archivu'}
          </Button>
        }
      >
        {(error || showSearch) && (
          <>
            {error && (
              <p className="mb-3 text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            {showSearch && (
              <div className="max-w-[560px]">
                <EntitySearch organizationId={organizationId} includeArchived />
              </div>
            )}
          </>
        )}
      </PageHead>

      {reviewDue.length > 0 && (
        <section className="sp__card sp__card--pad border-l-2 border-l-accent">
          <p className="text-sm text-text-primary">
            {reviewDue.length === 1
              ? 'U jednoho spisu uplynula archivační doba.'
              : `U ${reviewDue.length} spisů uplynula archivační doba.`}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Minimální doba uchování ({RETENTION_CHILD_CARE_YEARS} let od skončení Dohody) je pryč. Systém sám
            nic nemaže — je na vedení rozhodnout, co se spisem dál.
          </p>
        </section>
      )}

      <section className="sp__card sp__card--pad">
        {rows === null ? (
          <p className="text-sm text-text-tertiary">Načítám…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={FileText} text="V archivu zatím nic není." />
        ) : (
          <div className="flex flex-col">
            {rows.map((row) => {
              const due = isRetentionReviewDue(row.agreement.retentionReviewDueAt)
              return (
                <div key={row.docId} className="sp__row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => navigate(`/rodiny/${row.family.uid}`)}
                  >
                    <p className="truncate text-sm text-text-primary">{row.label}</p>
                    <p className="truncate text-xs text-text-tertiary">
                      Archivováno {row.agreement.archivedAt?.slice(0, 10)}
                      {row.agreement.retentionReviewDueAt && (
                        <> · revize {row.agreement.retentionReviewDueAt.slice(0, 10)}</>
                      )}
                    </p>
                  </button>
                  {due ? <span className="sp__chip shrink-0 text-danger">Lhůta uplynula</span> : <span />}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === row.docId}
                    onClick={() => handleUnarchive(row)}
                  >
                    Vrátit do provozu
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </AppShell>
  )
}
