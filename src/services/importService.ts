import { Workbook } from 'exceljs'
import type { Worksheet } from 'exceljs'
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createFamily, addFosterPersonToFamily, addChildToFamily } from '@/services/familyService'
import { createAgreement } from '@/services/agreementService'
import type { CareType } from '@/types/agreement'
import {
  ROLLBACK_WINDOW_DAYS,
  type ImportJobDoc,
  type ImportManifest,
  type ImportMethod,
  type ImportSummary,
} from '@/types/importJob'
import type {
  StagingAgreementFields,
  StagingChildFields,
  StagingFosterPersonFields,
  StagingRecordDoc,
} from '@/types/stagingRecord'

/**
 * Barrel service (ZADANI §11 bod 3) pro hromadný import — M1.5, cesta B
 * (šablona). Staví jen na tomhle: nahraný .xlsx se PARSUJE čistě na
 * klientovi (`parseImportTemplate`, žádný Firestore zápis), teprve
 * `startImportJob` výsledek uloží jako `importJobs`/`stagingRecords`
 * (§5.5 "staging → report → commit → undo"). Cesty A/C sdílí od
 * `startImportJob` dál stejný mechanismus, ale svoje vlastní parsování
 * (AI mapování / API kontrakt) tenhle soubor nestaví — viz importJob.ts.
 *
 * Scope rozhodnutí (M1.5, ne libovolné): import VŽDY zakládá NOVÉ rodiny,
 * nikdy neslučuje s existujícím záznamem (deduplikace/merge je mimo
 * rozsah). Řádek s chybou (`issues.length > 0`) se PŘESKOČÍ při
 * `commitImportJob` — organizace opraví soubor a chybějící řádky
 * doimportuje zvlášť; M1.5 nemá in-app editor jednotlivých řádků.
 */

const FOSTER_HEADERS = ['ID rodiny', 'Jméno', 'Příjmení', 'Telefon', 'E-mail'] as const
const CHILD_HEADERS = ['ID rodiny', 'Jméno', 'Příjmení', 'Rodné číslo'] as const
const AGREEMENT_HEADERS = ['ID rodiny', 'Typ péče', 'Platnost od'] as const

const BIRTH_NUMBER_RE = /^\d{6}\/?\d{3,4}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ---------------------------------------------------------------------
// 1) Generování šablony — čistě klient-side, žádný Firestore zápis.
// ---------------------------------------------------------------------

export async function generateImportTemplate(): Promise<Blob> {
  const workbook = new Workbook()
  workbook.creator = 'Doprovázení.com'

  const fosterSheet = workbook.addWorksheet('Pěstouni')
  fosterSheet.columns = FOSTER_HEADERS.map((header) => ({ header, key: header, width: 22 }))
  fosterSheet.getRow(1).font = { bold: true }

  const childSheet = workbook.addWorksheet('Děti')
  childSheet.columns = CHILD_HEADERS.map((header) => ({ header, key: header, width: 22 }))
  childSheet.getRow(1).font = { bold: true }

  const agreementSheet = workbook.addWorksheet('Dohody')
  agreementSheet.columns = AGREEMENT_HEADERS.map((header) => ({ header, key: header, width: 22 }))
  agreementSheet.getRow(1).font = { bold: true }

  const infoSheet = workbook.addWorksheet('Instrukce')
  infoSheet.columns = [{ header: '', key: 'text', width: 100 }]
  ;[
    'Jak vyplnit šablonu pro hromadný import:',
    '1) "ID rodiny" je VLASTNÍ označení, kterým propojíte řádky napříč listy (např. vaše interní číslo spisu). Nikam se neukládá, slouží jen k tomuhle importu.',
    '2) Jedna rodina může mít víc pěstounů i víc dětí — přidejte další řádky se stejným "ID rodiny".',
    '3) "Typ péče" vyplňte přesně jedno z: zprostředkovaná / nezprostředkovaná.',
    '4) "Platnost od" a "Rodné číslo" vyplňte ve formátu uvedeném v datovém sloupci (nebo jako datum, pokud to Excel umožní).',
    '5) Import vždy zakládá NOVÉ rodiny — neslučuje řádky s už existujícími záznamy v systému.',
  ].forEach((text) => infoSheet.addRow({ text }))

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ---------------------------------------------------------------------
// 2) Parsování nahraného souboru — čistě klient-side, žádný Firestore zápis.
// ---------------------------------------------------------------------

function cellToDisplayString(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (value && typeof value === 'object' && 'richText' in (value as Record<string, unknown>)) {
    const richText = (value as { richText: Array<{ text: string }> }).richText
    return richText.map((run) => run.text).join('')
  }
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function readSheetRows(
  worksheet: Worksheet | undefined,
  expectedHeaders: readonly string[],
): Array<Record<string, unknown>> {
  if (!worksheet) return []
  const columnIndexByHeader = new Map<string, number>()
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    columnIndexByHeader.set(cellToDisplayString(cell.value), colNumber)
  })

  const rows: Array<Record<string, unknown>> = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const record: Record<string, unknown> = {}
    let hasAnyValue = false
    for (const header of expectedHeaders) {
      const colIndex = columnIndexByHeader.get(header)
      const value = colIndex ? row.getCell(colIndex).value : ''
      if (cellToDisplayString(value)) hasAnyValue = true
      record[header] = value
    }
    if (hasAnyValue) rows.push(record)
  })
  return rows
}

function buildRawRow(row: Record<string, unknown>): Record<string, string> {
  const rawRow: Record<string, string> = {}
  for (const [header, value] of Object.entries(row)) {
    rawRow[header] = cellToDisplayString(value)
  }
  return rawRow
}

function stripDiacritics(text: string): string {
  // NFD rozloží "ě"/"á"/"ř"... na základní písmeno + kombinující diakritické
  // znaménko (Unicode blok U+0300–U+036F) — ten pak jen odfiltrujeme podle
  // kódu, bez regex Unicode rozsahu (nečitelný/křehký v prostém zdrojáku).
  return Array.from(text.normalize('NFD'))
    .filter((ch) => ch.codePointAt(0)! < 0x0300 || ch.codePointAt(0)! > 0x036f)
    .join('')
}

function parseCareType(raw: string): CareType | null {
  const normalized = stripDiacritics(raw.toLowerCase())
  if (normalized.startsWith('nezprostredkovan')) return 'nezprostredkovana'
  if (normalized.startsWith('zprostredkovan')) return 'zprostredkovana'
  return null
}

function parseDateCell(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString()
  const text = cellToDisplayString(raw)
  if (!text) return null
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const d = new Date(`${text}T00:00:00.000Z`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const czechMatch = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (czechMatch) {
    const [, day, month, year] = czechMatch
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

function processFosterSheet(rows: Array<Record<string, unknown>>): StagingRecordDoc[] {
  return rows.map((row) => {
    const externalFamilyRef = cellToDisplayString(row['ID rodiny'])
    const firstName = cellToDisplayString(row['Jméno'])
    const lastName = cellToDisplayString(row['Příjmení'])
    const phone = cellToDisplayString(row['Telefon'])
    const email = cellToDisplayString(row['E-mail'])
    const issues: string[] = []
    if (!externalFamilyRef) issues.push('Chybí "ID rodiny"')
    if (!firstName) issues.push('Chybí "Jméno"')
    if (!lastName) issues.push('Chybí "Příjmení"')
    if (email && !EMAIL_RE.test(email)) issues.push('Neplatný formát e-mailu')

    const fields: StagingFosterPersonFields = {
      externalFamilyRef,
      firstName,
      lastName,
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
    }
    return {
      rawRow: buildRawRow(row),
      mappedEntity: { type: 'fosterPerson', fields },
      confidence: issues.length === 0 ? 1 : 0.4,
      issues,
    }
  })
}

function processChildSheet(rows: Array<Record<string, unknown>>): StagingRecordDoc[] {
  return rows.map((row) => {
    const externalFamilyRef = cellToDisplayString(row['ID rodiny'])
    const firstName = cellToDisplayString(row['Jméno'])
    const lastName = cellToDisplayString(row['Příjmení'])
    const birthNumber = cellToDisplayString(row['Rodné číslo'])
    const issues: string[] = []
    if (!externalFamilyRef) issues.push('Chybí "ID rodiny"')
    if (!firstName) issues.push('Chybí "Jméno"')
    if (!lastName) issues.push('Chybí "Příjmení"')
    if (!birthNumber) issues.push('Chybí "Rodné číslo"')
    else if (!BIRTH_NUMBER_RE.test(birthNumber)) issues.push('Neplatný formát rodného čísla')

    const fields: StagingChildFields = { externalFamilyRef, firstName, lastName, birthNumber }
    return {
      rawRow: buildRawRow(row),
      mappedEntity: { type: 'child', fields },
      confidence: issues.length === 0 ? 1 : 0.4,
      issues,
    }
  })
}

function processAgreementSheet(rows: Array<Record<string, unknown>>): StagingRecordDoc[] {
  return rows.map((row) => {
    const externalFamilyRef = cellToDisplayString(row['ID rodiny'])
    const careTypeRaw = cellToDisplayString(row['Typ péče'])
    const careType = parseCareType(careTypeRaw)
    const validFrom = parseDateCell(row['Platnost od'])
    const issues: string[] = []
    if (!externalFamilyRef) issues.push('Chybí "ID rodiny"')
    if (!careType) issues.push('"Typ péče" musí být "zprostředkovaná" nebo "nezprostředkovaná"')
    if (!validFrom) issues.push('Neplatný nebo chybějící formát "Platnost od"')

    const fields: StagingAgreementFields = {
      externalFamilyRef,
      careType: careType ?? 'zprostredkovana',
      validFrom: validFrom ?? '',
    }
    return {
      rawRow: buildRawRow(row),
      mappedEntity: { type: 'agreement', fields },
      confidence: issues.length === 0 ? 1 : 0.4,
      issues,
    }
  })
}

export interface ParsedImportData {
  summary: ImportSummary
  records: StagingRecordDoc[]
}

export async function parseImportTemplate(file: File): Promise<ParsedImportData> {
  const workbook = new Workbook()
  const buffer = await file.arrayBuffer()
  await workbook.xlsx.load(buffer)

  const fosterRecords = processFosterSheet(readSheetRows(workbook.getWorksheet('Pěstouni'), FOSTER_HEADERS))
  const childRecords = processChildSheet(readSheetRows(workbook.getWorksheet('Děti'), CHILD_HEADERS))
  const agreementRecords = processAgreementSheet(
    readSheetRows(workbook.getWorksheet('Dohody'), AGREEMENT_HEADERS),
  )

  // Cross-row: nejvýš JEDNA čistá Dohoda na rodinu v tomhle souboru (jedna
  // organizace, jeden import = strukturální předpoklad §4.5, viz agreement.ts).
  const seenAgreementRefs = new Set<string>()
  for (const record of agreementRecords) {
    if (record.issues.length > 0) continue
    const ref = (record.mappedEntity.fields as StagingAgreementFields).externalFamilyRef
    if (seenAgreementRefs.has(ref)) {
      record.issues.push(
        `Rodina "${ref}" má v souboru víc než jednu Dohodu — použije se první, tenhle řádek se přeskočí`,
      )
    } else {
      seenAgreementRefs.add(ref)
    }
  }

  const allRecords = [...fosterRecords, ...childRecords, ...agreementRecords]

  const familyRefs = new Set(
    allRecords
      .map((r) => (r.mappedEntity.fields as { externalFamilyRef: string }).externalFamilyRef)
      .filter(Boolean),
  )
  const warnings: string[] = []
  for (const ref of familyRefs) {
    const hasClean = (records: StagingRecordDoc[]) =>
      records.some(
        (r) => r.issues.length === 0 && (r.mappedEntity.fields as { externalFamilyRef: string }).externalFamilyRef === ref,
      )
    if (!hasClean(fosterRecords)) warnings.push(`Rodina "${ref}": v souboru chybí pěstoun`)
    if (!hasClean(agreementRecords)) warnings.push(`Rodina "${ref}": v souboru chybí Dohoda`)
  }

  const summary: ImportSummary = {
    fostersDetected: fosterRecords.filter((r) => r.issues.length === 0).length,
    childrenDetected: childRecords.filter((r) => r.issues.length === 0).length,
    agreementsDetected: agreementRecords.filter((r) => r.issues.length === 0).length,
    warnings,
    errors: allRecords.filter((r) => r.issues.length > 0).map((r) => r.issues.join('; ')),
  }

  return { summary, records: allRecords }
}

// ---------------------------------------------------------------------
// 3) Firestore zápisy — staging → review → commit → rollback.
// ---------------------------------------------------------------------

const BATCH_CHUNK_SIZE = 400 // Firestore batch limit je 500 operací

async function writeInChunks<T>(items: T[], writeChunk: (chunk: T[]) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_CHUNK_SIZE) {
    await writeChunk(items.slice(i, i + BATCH_CHUNK_SIZE))
  }
}

export async function startImportJob(
  organizationId: string,
  method: ImportMethod,
  parsed: ParsedImportData,
  createdBy: string,
): Promise<string> {
  const jobRef = doc(collection(db, 'organizations', organizationId, 'importJobs'))
  const jobData: ImportJobDoc = {
    organizationId,
    method,
    status: 'reviewing',
    summary: parsed.summary,
    createdBy,
    createdAt: new Date().toISOString(),
  }
  await setDoc(jobRef, jobData)

  const stagingCollection = collection(jobRef, 'stagingRecords')
  await writeInChunks(parsed.records, async (chunk) => {
    const batch = writeBatch(db)
    for (const record of chunk) {
      batch.set(doc(stagingCollection), record)
    }
    await batch.commit()
  })

  return jobRef.id
}

export async function listImportJobs(
  organizationId: string,
): Promise<Array<{ docId: string; job: ImportJobDoc }>> {
  const snap = await getDocs(collection(db, 'organizations', organizationId, 'importJobs'))
  return snap.docs
    .map((d) => ({ docId: d.id, job: d.data() as ImportJobDoc }))
    .sort((a, b) => b.job.createdAt.localeCompare(a.job.createdAt))
}

export async function listStagingRecords(
  organizationId: string,
  jobId: string,
): Promise<Array<{ docId: string; record: StagingRecordDoc }>> {
  const snap = await getDocs(
    collection(db, 'organizations', organizationId, 'importJobs', jobId, 'stagingRecords'),
  )
  return snap.docs.map((d) => ({ docId: d.id, record: d.data() as StagingRecordDoc }))
}

export async function confirmImportJob(organizationId: string, jobId: string): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId, 'importJobs', jobId), {
    status: 'confirmed',
  })
}

/**
 * Zakládá entity POUZE z čistých (`issues.length === 0`) staging záznamů —
 * viz scope komentář nahoře. Chyba v JEDNÉ skupině (rodina) nepřeruší
 * zbytek importu: manifest se plní PRŮBĚŽNĚ (po každém úspěšném zápisu),
 * takže i částečně dokončený commit zůstává plně vratitelný přes
 * `rollbackImportJob` a chyba se přidá do `summary.errors` pro tenhle job.
 */
export async function commitImportJob(
  organizationId: string,
  orgCode: string,
  jobId: string,
): Promise<ImportManifest> {
  const jobRef = doc(db, 'organizations', organizationId, 'importJobs', jobId)
  const jobSnap = await getDoc(jobRef)
  if (!jobSnap.exists()) throw new Error('Import job nenalezen.')
  const job = jobSnap.data() as ImportJobDoc
  if (job.status !== 'confirmed') {
    throw new Error('Import lze spustit jen z potvrzeného stavu ("confirmed").')
  }

  const stagingSnap = await getDocs(collection(jobRef, 'stagingRecords'))
  const cleanRecords = stagingSnap.docs.map((d) => d.data() as StagingRecordDoc).filter((r) => r.issues.length === 0)

  const groupsByFamilyRef = new Map<string, StagingRecordDoc[]>()
  for (const record of cleanRecords) {
    const ref = (record.mappedEntity.fields as { externalFamilyRef: string }).externalFamilyRef
    if (!groupsByFamilyRef.has(ref)) groupsByFamilyRef.set(ref, [])
    groupsByFamilyRef.get(ref)!.push(record)
  }

  const manifest: ImportManifest = {
    familyDocIds: [],
    fosterPersonDocIds: [],
    childDocIds: [],
    agreementFamilyDocIds: [],
  }
  const commitErrors: string[] = []

  for (const [familyRef, groupRecords] of groupsByFamilyRef) {
    try {
      const { docId: familyDocId } = await createFamily(organizationId, orgCode, undefined, jobId)
      manifest.familyDocIds.push(familyDocId)

      for (const record of groupRecords) {
        if (record.mappedEntity.type === 'fosterPerson') {
          const fields = record.mappedEntity.fields
          const { docId } = await addFosterPersonToFamily(
            familyDocId,
            organizationId,
            orgCode,
            { firstName: fields.firstName, lastName: fields.lastName, phone: fields.phone, email: fields.email },
            jobId,
          )
          manifest.fosterPersonDocIds.push(docId)
        } else if (record.mappedEntity.type === 'child') {
          const fields = record.mappedEntity.fields
          const { docId } = await addChildToFamily(
            familyDocId,
            organizationId,
            orgCode,
            { firstName: fields.firstName, lastName: fields.lastName, birthNumber: fields.birthNumber },
            jobId,
          )
          manifest.childDocIds.push(docId)
        } else {
          const fields = record.mappedEntity.fields
          await createAgreement({
            familyDocId,
            organizationId,
            orgCode,
            careType: fields.careType,
            validFrom: fields.validFrom,
            createdByImportJobRef: jobId,
          })
          manifest.agreementFamilyDocIds.push(familyDocId)
        }
      }
    } catch (err) {
      commitErrors.push(`Rodina "${familyRef}": ${err instanceof Error ? err.message : 'neznámá chyba'}`)
    }
  }

  const now = new Date()
  const rollbackDeadline = new Date(now.getTime() + ROLLBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const committedAnything = manifest.familyDocIds.length > 0

  await updateDoc(jobRef, {
    status: committedAnything ? 'committed' : 'failed',
    manifest,
    committedAt: committedAnything ? now.toISOString() : null,
    rollbackDeadline: committedAnything ? rollbackDeadline.toISOString() : null,
    summary: {
      ...job.summary,
      errors: [...(job.summary?.errors ?? []), ...commitErrors],
    },
  })

  return manifest
}

/**
 * Pořadí mazání je záměrné: `canRollbackImportEntity` (firestore.rules) při
 * KAŽDÉM mazání čte STATUS tohoto importJobs dokumentu — musí zůstat
 * `'committed'` až do úplně poslední chvíle, proto se job aktualizuje na
 * `'rolled_back'` teprve PO všech entity-mazáních, ne před nimi.
 */
export async function rollbackImportJob(organizationId: string, jobId: string): Promise<void> {
  const jobRef = doc(db, 'organizations', organizationId, 'importJobs', jobId)
  const jobSnap = await getDoc(jobRef)
  if (!jobSnap.exists()) throw new Error('Import job nenalezen.')
  const job = jobSnap.data() as ImportJobDoc
  if (job.status !== 'committed') {
    throw new Error('Vrátit zpět lze jen dokončený import ("committed").')
  }
  if (!job.rollbackDeadline || isPastDeadline(job.rollbackDeadline)) {
    throw new Error(`Okno na vrácení importu (${ROLLBACK_WINDOW_DAYS} dní) už vypršelo.`)
  }
  const manifest = job.manifest
  if (!manifest) throw new Error('Import nemá manifest, není co vrátit.')

  for (const familyDocId of manifest.agreementFamilyDocIds) {
    await deleteDoc(doc(db, 'families', familyDocId, 'agreements', organizationId))
  }
  for (const docId of manifest.fosterPersonDocIds) {
    await deleteDoc(doc(db, 'fosterPersons', docId))
  }
  for (const docId of manifest.childDocIds) {
    await deleteDoc(doc(db, 'children', docId))
  }
  for (const familyDocId of manifest.familyDocIds) {
    await deleteDoc(doc(db, 'families', familyDocId))
  }

  await updateDoc(jobRef, { status: 'rolled_back' })
}

function isPastDeadline(isoDeadline: string): boolean {
  return new Date() > new Date(isoDeadline)
}
