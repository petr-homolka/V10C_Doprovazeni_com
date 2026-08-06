import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { actorFields, auditWriteInto } from '@/services/auditLogService'
import type { AuditActor } from '@/types/auditLog'
import { allocateUid } from '@/lib/uidAllocator'
import type { DocumentVersionDoc, FamilyDocumentDoc, FamilyDocumentStatus } from '@/types/familyDocument'
import type { SubjectRef } from '@/types/timelineEntry'
import type { HistoryDigestDoc } from '@/types/historyDigest'

/**
 * Barrel service (ZADANI §11 bod 3) pro §6 A1 schvalovací workflow — M5.
 * Rules hlídají KDO smí zapsat KTEROU cílovou `status` hodnotu
 * (bezpečnostní hranice), přesnou posloupnost přechodů hlídá TENHLE
 * soubor (stejný dělicí vzor jako `importJobs`, viz firestore.rules
 * komentář) — volající (UI, M5.3) navíc nabízí jen tlačítka odpovídající
 * AKTUÁLNÍMU stavu, takže nesprávný přechod se v praxi nedá ani spustit.
 *
 * Každá funkce tady = JEDEN krok automatu z FamilyDocumentDoc komentáře.
 * `sha256Hex` — Web Crypto (`crypto.subtle`), stejný mechanismus jako
 * `backupService.ts`, žádná nová závislost jen kvůli hashi.
 */

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function documentRef(familyDocId: string, docId: string) {
  return doc(db, 'families', familyDocId, 'documents', docId)
}

function versionsCollection(familyDocId: string, docId: string) {
  return collection(db, 'families', familyDocId, 'documents', docId, 'versions')
}

export interface CreateDocumentInput {
  familyDocId: string
  organizationId: string
  createdByUid: string
  title: string
  body: string
  subjectRefs: SubjectRef[]
}

export async function createDocument(
  input: CreateDocumentInput,
): Promise<{ docId: string; document: FamilyDocumentDoc }> {
  const ref = doc(collection(db, 'families', input.familyDocId, 'documents'))
  const uid = await allocateUid('document', input.organizationId)
  const hash = await sha256Hex(input.body)
  const now = new Date().toISOString()

  const data: FamilyDocumentDoc = {
    uid,
    createdByOrgId: input.organizationId,
    createdByUid: input.createdByUid,
    familyId: input.familyDocId,
    kind: 'markdown',
    title: input.title,
    status: 'draft',
    subjectRefs: input.subjectRefs,
    body: input.body,
    currentVersion: 1,
    hash,
    createdAt: now,
    updatedAt: now,
  }
  const versionData: DocumentVersionDoc = {
    createdByOrgId: input.organizationId,
    version: 1,
    body: input.body,
    editedByUid: input.createdByUid,
    createdAt: now,
    hash,
  }

  const batch = writeBatch(db)
  batch.set(ref, data)
  batch.set(doc(versionsCollection(input.familyDocId, ref.id)), versionData)
  await batch.commit()

  return { docId: ref.id, document: data }
}

export async function getDocumentById(familyDocId: string, docId: string): Promise<FamilyDocumentDoc | null> {
  const snap = await getDoc(documentRef(familyDocId, docId))
  return snap.exists() ? (snap.data() as FamilyDocumentDoc) : null
}

export async function listFamilyDocuments(
  familyDocId: string,
  organizationId: string,
): Promise<Array<{ docId: string; document: FamilyDocumentDoc }>> {
  const q = query(
    collection(db, 'families', familyDocId, 'documents'),
    where('createdByOrgId', '==', organizationId),
    orderBy('updatedAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ docId: d.id, document: d.data() as FamilyDocumentDoc }))
}

/** Napříč VŠEMI rodinami organizace — `/dokumenty` (M5.4). Vyžaduje
 * složený index (`createdByOrgId` + `updatedAt`, `COLLECTION_GROUP`
 * scope — živě ověřená past z M3/M4, viz firestore.indexes.json). */
export async function listOrganizationDocuments(
  organizationId: string,
): Promise<Array<{ docId: string; familyId: string; document: FamilyDocumentDoc }>> {
  const q = query(
    collectionGroup(db, 'documents'),
    where('createdByOrgId', '==', organizationId),
    orderBy('updatedAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({
    docId: d.id,
    familyId: (d.data() as FamilyDocumentDoc).familyId,
    document: d.data() as FamilyDocumentDoc,
  }))
}

/** 001-IDENTITY_MODEL.md §8 ověřovací stránka (`/d/:uid`, M5.3) — lookup
 * podle human-facing `uid`, ne interního Firestore document ID (§4.3
 * pozn. 1). Filtruje i na `createdByOrgId`, jinak by Firestore zamítl
 * CELÝ list dotaz (nezrcadlil by `documents` read pravidlo) — staff stejně
 * nemá důvod ověřovat UID mimo vlastní organizaci. */
export async function getDocumentByUid(
  organizationId: string,
  uid: string,
): Promise<{ docId: string; familyId: string; document: FamilyDocumentDoc } | null> {
  const q = query(
    collectionGroup(db, 'documents'),
    where('createdByOrgId', '==', organizationId),
    where('uid', '==', uid),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  const document = d.data() as FamilyDocumentDoc
  return { docId: d.id, familyId: document.familyId, document }
}

/** `organizationId` filtr MUSÍ být v dotazu, i když v tomhle Spisu je vždy
 * jen jedna organizace — `versions` read pravidlo testuje
 * `resource.data.createdByOrgId`, a Firestore zamítne CELÝ list dotaz,
 * pokud rule podmínka neodpovídá žádnému filtru v samotném dotazu (živě
 * odhaleno, stejná past jako M3 timeline/M4 indexy). */
export async function listDocumentVersions(
  familyDocId: string,
  docId: string,
  organizationId: string,
): Promise<Array<{ docId: string; version: DocumentVersionDoc }>> {
  const q = query(
    versionsCollection(familyDocId, docId),
    where('createdByOrgId', '==', organizationId),
    orderBy('version', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ docId: d.id, version: d.data() as DocumentVersionDoc }))
}

/** §6 A1 bod 2: "KO edituje — nová verze do append-only versions." Smí se
 * volat jen dokud je dokument v `draft`/`commented` (vynuceno UI, ne
 * rules — viz komentář nahoře). */
export async function editDocument(
  familyDocId: string,
  docId: string,
  organizationId: string,
  editedByUid: string,
  title: string,
  body: string,
  currentVersion: number,
): Promise<void> {
  const hash = await sha256Hex(body)
  const nextVersion = currentVersion + 1
  const now = new Date().toISOString()
  const versionData: DocumentVersionDoc = {
    createdByOrgId: organizationId,
    version: nextVersion,
    body,
    editedByUid,
    createdAt: now,
    hash,
  }
  const batch = writeBatch(db)
  batch.update(documentRef(familyDocId, docId), {
    title,
    body,
    currentVersion: nextVersion,
    hash,
    updatedAt: now,
  })
  batch.set(doc(versionsCollection(familyDocId, docId)), versionData)
  await batch.commit()
}

/** §6 A1 bod 3: KO → pěstoun. */
export async function sendToFosterReview(familyDocId: string, docId: string): Promise<void> {
  await updateDoc(documentRef(familyDocId, docId), { status: 'foster_review', updatedAt: new Date().toISOString() })
}

/** §6 A1 bod 4 (schválit). Rules vyžadují `status=='foster_review'` a
 * nemění `body`/`title` — viz firestore.rules "Pěstoun" disjunkt. */
export async function fosterApproveDocument(familyDocId: string, docId: string, fosterUid: string): Promise<void> {
  const now = new Date().toISOString()
  await updateDoc(documentRef(familyDocId, docId), {
    status: 'approved_foster',
    fosterApprovedAt: now,
    fosterApprovedByUid: fosterUid,
    updatedAt: now,
  })
}

/** §6 A1 bod 4 (okomentovat — smyčka 3↔4 pokračuje). */
export async function fosterCommentDocument(familyDocId: string, docId: string, comment: string): Promise<void> {
  await updateDoc(documentRef(familyDocId, docId), {
    status: 'commented',
    fosterComments: comment,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * §6 A1 bod 5: KO označí Konečný — dosažitelné z `approved_foster` I
 * `commented` (KO smí pokračovat i bez výslovného schválení pěstounem,
 * viz FamilyDocumentDoc komentář k `closed_*_unapproved`).
 * `assignedKoUid` = `agreement.assignedTo` pro tenhle Spis — pokud se
 * shoduje s `actingUid`, jde o PŘÍMÉ potvrzení přiřazenou klíčovou osobou
 * (`assignedKoApprovedAt` se nastaví), jinak ne (jiný staff/asistent
 * dokument jen posunul dál).
 */
export async function markDocumentFinal(
  familyDocId: string,
  docId: string,
  actingUid: string,
  assignedKoUid: string | null | undefined,
): Promise<void> {
  const now = new Date().toISOString()
  const isAssignedKo = !!assignedKoUid && actingUid === assignedKoUid
  await updateDoc(documentRef(familyDocId, docId), {
    status: 'final',
    updatedAt: now,
    ...(isAssignedKo ? { assignedKoApprovedAt: now, assignedKoApprovedByUid: actingUid } : {}),
  })
}

/** §6 A1 bod 6: KO → vedení, výběr schvalovatele (jen informativní, viz
 * `mgmtReviewerUid` komentář v typu). */
export async function sendToMgmtReview(familyDocId: string, docId: string, reviewerUid?: string): Promise<void> {
  await updateDoc(documentRef(familyDocId, docId), {
    status: 'mgmt_review',
    mgmtReviewerUid: reviewerUid ?? null,
    updatedAt: new Date().toISOString(),
  })
}

/** §6 A1 bod 7 (zamítne — zpět draft s důvodem). */
export async function rejectDocumentToDraft(familyDocId: string, docId: string, reason: string): Promise<void> {
  await updateDoc(documentRef(familyDocId, docId), {
    status: 'draft',
    rejectionReason: reason,
    updatedAt: new Date().toISOString(),
  })
}

/** §6 A1 bod 7 (schválí/uzavře s výhradou) — koncový stav se ODVOZUJE z
 * `fosterApprovedAt`/`assignedKoApprovedAt`, vedení nevybírá ručně ze 4
 * tlačítek (viz FamilyDocumentDoc komentář). */
export function deriveClosedStatus(document: FamilyDocumentDoc): FamilyDocumentStatus {
  const fosterOk = !!document.fosterApprovedAt
  const koOk = !!document.assignedKoApprovedAt
  if (fosterOk && koOk) return 'closed'
  if (!fosterOk && koOk) return 'closed_foster_unapproved'
  if (fosterOk && !koOk) return 'closed_ko_unapproved'
  return 'closed_both_unapproved'
}

export async function closeDocument(familyDocId: string, docId: string, document: FamilyDocumentDoc): Promise<void> {
  await updateDoc(documentRef(familyDocId, docId), {
    status: deriveClosedStatus(document),
    updatedAt: new Date().toISOString(),
  })
}

export interface SendToAuthorityInput {
  familyDocId: string
  docId: string
  organizationId: string
  title: string
  sentTo: 'ospod' | 'soud'
  /** Kdo odesílá — jde do auditní stopy v TÉŽE dávce. */
  actor: AuditActor
  /** Popisek rodiny do logu (log musí zůstat čitelný, i když rodina zmizí). */
  familyLabel: string
}

/**
 * §6 A1 bod 8 (odeslat na úřad). JEDEN atomický batch — dokument →
 * `sent` + `historyDigest` (§4.5, kind `document_sent`) — stejný vzor
 * jako M3 `createVisitTimelineEntry`. `fileRef` je SEAM (žádný skutečný
 * PDF export, viz FamilyDocumentDoc komentář) — prázdná hodnota s jasným
 * sentinelem, ne tichý fake soubor.
 */
export async function sendDocumentToAuthority(input: SendToAuthorityInput): Promise<void> {
  const now = new Date().toISOString()
  const digestData: HistoryDigestDoc = {
    kind: 'document_sent',
    createdByOrgId: input.organizationId,
    segmentValidTo: null,
    sentAt: now,
    title: input.title,
    sentTo: input.sentTo,
    fileRef: 'SEAM:pdf-export-not-built',
  }
  const batch = writeBatch(db)
  batch.update(documentRef(input.familyDocId, input.docId), {
    status: 'sent',
    sentTo: input.sentTo,
    sentAt: now,
    updatedAt: now,
  })
  batch.set(doc(collection(db, 'families', input.familyDocId, 'historyDigest')), digestData)
  // Auditní záznam je součástí TÉŽE dávky, ne zápis navíc po ní: tohle je
  // okamžik, kdy údaje o dítěti opouštějí organizaci. Nesmí nastat stav
  // „odesláno, ale v logu nic".
  auditWriteInto(batch, {
    organizationId: input.organizationId,
    action: 'document_sent_authority',
    ...actorFields(input.actor),
    subject: { kind: 'family', id: input.familyDocId, label: input.familyLabel },
    target: { kind: 'document', id: input.docId, label: input.title },
    detail: `Odesláno na ${input.sentTo === 'soud' ? 'soud' : 'OSPOD'}.`,
  })
  await batch.commit()
}

/** §6 A1 bod 8 (uložit do spisu — bez odeslání, bez historyDigest, viz
 * historyDigest.ts komentář: jen `sent` spouští digest, `filed` je čistě
 * interní archivace). */
export async function fileDocument(familyDocId: string, docId: string): Promise<void> {
  const now = new Date().toISOString()
  await updateDoc(documentRef(familyDocId, docId), { status: 'filed', filedAt: now, updatedAt: now })
}
