import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AppShell } from '@/components/shell/AppShell'
import { Button } from '@/components/ui/button'
import { DOCUMENT_STATUS_LABELS } from '@/components/documents/documentStatusLabels'
import { useAuth } from '@/hooks/useAuth'
import { getDocumentByUid } from '@/services/documentService'
import type { FamilyDocumentDoc } from '@/types/familyDocument'
import type { FamilyDoc } from '@/types/family'

/**
 * `/d/:uid` — 001-IDENTITY_MODEL.md §8 ověřovací stránka (QR cíl na
 * DocumentDetailPage). Staff-only (uvnitř RequireAuth) — potvrzuje, že UID
 * na papírovém/PDF výstupu odpovídá reálnému dokumentu dané organizace, a
 * odkazuje na plný editor. `familyUid` pro odkaz se dohledává zvlášť —
 * `getDocumentByUid` vrací interní `familyId` (Firestore doc ID), ne
 * lidsky čitelné UID rodiny, které routy používají.
 */
export default function DocumentVerifyPage() {
  const { uid } = useParams<{ uid: string }>()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [result, setResult] = useState<{ docId: string; familyId: string; familyUid: string; document: FamilyDocumentDoc } | null>(
    null,
  )
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid || !organizationId) return
    setError(null)
    setNotFound(false)
    getDocumentByUid(organizationId, uid)
      .then(async (found) => {
        if (!found) {
          setNotFound(true)
          return
        }
        const familySnap = await getDoc(doc(db, 'families', found.familyId))
        const family = familySnap.exists() ? (familySnap.data() as FamilyDoc) : null
        setResult({ ...found, familyUid: family?.uid ?? found.familyId })
      })
      .catch(() => setError('Ověření se nezdařilo.'))
  }, [uid, organizationId])

  return (
    <AppShell breadcrumb={[{ label: 'Ověření dokumentu' }]}>
      <h1 className="text-xl font-bold leading-tight text-text-primary">Ověření dokumentu {uid}</h1>

      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {notFound && (
        <p className="mt-4 text-sm text-text-secondary">
          Dokument s tímto UID nebyl ve vaší organizaci nalezen — buď neexistuje, nebo patří jiné organizaci.
        </p>
      )}

      {result && (
        <div className="mt-4 flex max-w-[560px] flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-text-primary">
            <span className="font-medium">{result.document.title}</span> · verze {result.document.currentVersion}
          </p>
          <p className="text-sm text-text-secondary">Stav: {DOCUMENT_STATUS_LABELS[result.document.status]}</p>
          <p className="text-xs text-text-tertiary">hash {result.document.hash}</p>
          <Link to={`/rodiny/${result.familyUid}/dokumenty/${result.docId}`} className="w-fit">
            <Button size="sm">Otevřít dokument</Button>
          </Link>
        </div>
      )}
    </AppShell>
  )
}
