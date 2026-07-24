import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { DOCUMENT_STATUS_LABELS } from '@/components/documents/documentStatusLabels'
import { useAuth } from '@/hooks/useAuth'
import { listOrganizationDocuments } from '@/services/documentService'
import { listFamiliesWithDocIds } from '@/services/familyService'
import type { FamilyDoc } from '@/types/family'
import { FileText } from '@/components/ui/icons'

const TABLE_COLUMNS = '2fr 2fr 1fr 1fr'

/**
 * /dokumenty — M5.4. Napříč VŠEMI rodinami organizace (na rozdíl od
 * FamilyDetailPage sekce, která je vždy jen jedné rodiny) — dřív mrtvý
 * odkaz v Sidebaru (viz Sidebar.tsx NAV_ITEMS), teď skutečná stránka.
 */
export default function DocumentListPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [documents, setDocuments] = useState<Awaited<ReturnType<typeof listOrganizationDocuments>> | null>(null)
  const [familiesByDocId, setFamiliesByDocId] = useState<Record<string, FamilyDoc>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    setError(null)
    Promise.all([listOrganizationDocuments(organizationId), listFamiliesWithDocIds(organizationId)])
      .then(([docs, families]) => {
        setDocuments(docs)
        setFamiliesByDocId(Object.fromEntries(families.map(({ docId, family }) => [docId, family])))
      })
      .catch(() => setError('Seznam dokumentů se nepodařilo načíst.'))
  }, [organizationId])

  if (!organizationId) {
    return (
      <AppShell breadcrumb={[{ label: 'Dokumenty' }]}>
        <PageHeader title="Dokumenty" />
        <p className="mt-4 text-sm text-text-secondary">Tahle stránka je pro zaměstnance konkrétní organizace.</p>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumb={[{ label: 'Dokumenty' }]}>
      <PageHeader title="Dokumenty" />

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6">
        {documents === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : documents.length === 0 ? (
          <EmptyState icon={FileText} text="Zatím tu nejsou žádné dokumenty." />
        ) : (
          <Table>
            <TableHeaderRow columns={TABLE_COLUMNS} labels={['Rodina', 'Název', 'UID', 'Stav']} />
            {documents.map(({ docId, familyId, document }) => {
              const family = familiesByDocId[familyId]
              return (
                <Link
                  key={docId}
                  to={family ? `/rodiny/${family.uid}/dokumenty/${docId}` : '#'}
                  className="contents"
                >
                  <TableRow columns={TABLE_COLUMNS}>
                    <span className="truncate text-sm text-text-primary">{family?.address || '—'}</span>
                    <span className="truncate text-sm text-text-secondary">{document.title}</span>
                    <span className="text-sm text-text-secondary">{document.uid}</span>
                    <span className="text-sm text-text-secondary">{DOCUMENT_STATUS_LABELS[document.status]}</span>
                  </TableRow>
                </Link>
              )
            })}
          </Table>
        )}
      </div>
    </AppShell>
  )
}
