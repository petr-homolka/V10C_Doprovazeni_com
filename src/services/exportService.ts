import { Workbook } from 'exceljs'
import { getOrganization } from '@/services/organizationService'
import {
  listFamiliesWithDocIds,
  listFosterPersonsByRefs,
  listChildrenForFamily,
} from '@/services/familyService'
import { getActiveAgreement } from '@/services/agreementService'
import { EDUCATION_HOURS_TARGET } from '@/types/agreement'

/**
 * Barrel service (ZADANI §11 bod 3) pro self-service export celé
 * organizace — M1.5, §5.5 "organizace má vždy právo na kompletní export
 * svých dat, nezávisle na dodavateli". Čte přesně to, na co organizace má
 * přístup přes `firestore.rules` (žádná zvláštní exportní cesta/oprávnění
 * navíc) — reálně tedy `families` (přes `orgAccessList`), jejich pěstouny,
 * jejich DĚTI (jen ty s AKTUÁLNÍM `organizationId` = tahle organizace,
 * §4.2 bod 7 — na rozdíl od Spisu/pěstouna dítě nemá historický seznam
 * organizací, viz child.ts), a vlastní Dohodu (deterministické ID).
 *
 * O(počet rodin) dotazů — pro typickou organizaci (desítky až nízké
 * stovky rodin) v pořádku; opravdu velká organizace by časem chtěla
 * server-side agregaci (Cloud Function), což tenhle build nemá.
 */

export interface OrgExportSummary {
  familiesCount: number
  fosterPersonsCount: number
  childrenCount: number
  agreementsCount: number
}

export interface OrgExportResult {
  workbook: Workbook
  filename: string
  summary: OrgExportSummary
}

interface FamilyExportRow {
  familyUid: string
  address: string | undefined
  createdAt: string
  fosterPersons: Awaited<ReturnType<typeof listFosterPersonsByRefs>>
  children: Awaited<ReturnType<typeof listChildrenForFamily>>
  agreement: Awaited<ReturnType<typeof getActiveAgreement>>
}

async function buildExportRows(organizationId: string): Promise<FamilyExportRow[]> {
  const families = await listFamiliesWithDocIds(organizationId)
  return Promise.all(
    families.map(async ({ docId, family }) => {
      const [fosterPersons, children, agreement] = await Promise.all([
        listFosterPersonsByRefs(family.fosterPersonRefs),
        listChildrenForFamily(docId, organizationId),
        getActiveAgreement(docId, organizationId),
      ])
      return {
        familyUid: family.uid,
        address: family.address,
        createdAt: family.createdAt,
        fosterPersons,
        children,
        agreement,
      }
    }),
  )
}

function buildWorkbook(rows: FamilyExportRow[]): Workbook {
  const workbook = new Workbook()
  workbook.creator = 'Doprovázení.com'

  const familySheet = workbook.addWorksheet('Rodiny')
  familySheet.columns = [
    { header: 'UID rodiny', key: 'uid', width: 18 },
    { header: 'Adresa', key: 'address', width: 32 },
    { header: 'Založeno', key: 'createdAt', width: 22 },
  ]
  familySheet.getRow(1).font = { bold: true }
  for (const row of rows) {
    familySheet.addRow({ uid: row.familyUid, address: row.address ?? '', createdAt: row.createdAt })
  }

  const fosterSheet = workbook.addWorksheet('Pěstouni')
  fosterSheet.columns = [
    { header: 'UID rodiny', key: 'familyUid', width: 18 },
    { header: 'UID pěstouna', key: 'uid', width: 18 },
    { header: 'Jméno', key: 'firstName', width: 20 },
    { header: 'Příjmení', key: 'lastName', width: 20 },
    { header: 'Telefon', key: 'phone', width: 16 },
    { header: 'E-mail', key: 'email', width: 28 },
  ]
  fosterSheet.getRow(1).font = { bold: true }
  for (const row of rows) {
    for (const fp of row.fosterPersons) {
      fosterSheet.addRow({
        familyUid: row.familyUid,
        uid: fp.uid,
        firstName: fp.firstName,
        lastName: fp.lastName,
        phone: fp.phone ?? '',
        email: fp.email ?? '',
      })
    }
  }

  const childSheet = workbook.addWorksheet('Děti')
  childSheet.columns = [
    { header: 'UID rodiny', key: 'familyUid', width: 18 },
    { header: 'UID dítěte', key: 'uid', width: 18 },
    { header: 'Jméno', key: 'firstName', width: 20 },
    { header: 'Příjmení', key: 'lastName', width: 20 },
    { header: 'Rodné číslo', key: 'birthNumber', width: 18 },
    { header: 'Datum narození', key: 'birthDate', width: 18 },
  ]
  childSheet.getRow(1).font = { bold: true }
  for (const row of rows) {
    for (const child of row.children) {
      childSheet.addRow({
        familyUid: row.familyUid,
        uid: child.uid,
        firstName: child.firstName,
        lastName: child.lastName,
        birthNumber: child.birthNumber,
        birthDate: child.birthDate ?? '',
      })
    }
  }

  const agreementSheet = workbook.addWorksheet('Dohody')
  agreementSheet.columns = [
    { header: 'UID rodiny', key: 'familyUid', width: 18 },
    { header: 'Typ péče', key: 'careType', width: 22 },
    { header: 'Stav', key: 'status', width: 12 },
    { header: 'Platnost od', key: 'validFrom', width: 22 },
    { header: 'Platnost do', key: 'validTo', width: 22 },
    { header: 'Cíl vzdělávání (h)', key: 'educationHoursTarget', width: 20 },
    { header: 'Interval návštěv (dny)', key: 'visitIntervalDays', width: 22 },
  ]
  agreementSheet.getRow(1).font = { bold: true }
  for (const row of rows) {
    if (!row.agreement) continue
    agreementSheet.addRow({
      familyUid: row.familyUid,
      careType: row.agreement.careType,
      status: row.agreement.status,
      validFrom: row.agreement.validFrom,
      validTo: row.agreement.validTo ?? '',
      educationHoursTarget: row.agreement.educationHoursTarget ?? EDUCATION_HOURS_TARGET[row.agreement.careType],
      visitIntervalDays: row.agreement.visitIntervalDays,
    })
  }

  return workbook
}

export async function generateOrganizationExport(organizationId: string): Promise<OrgExportResult> {
  const [org, rows] = await Promise.all([getOrganization(organizationId), buildExportRows(organizationId)])
  const workbook = buildWorkbook(rows)

  const datePart = new Date().toISOString().slice(0, 10)
  const orgLabel = org?.orgCode ?? organizationId
  const filename = `export-${orgLabel}-${datePart}.xlsx`

  return {
    workbook,
    filename,
    summary: {
      familiesCount: rows.length,
      fosterPersonsCount: rows.reduce((sum, r) => sum + r.fosterPersons.length, 0),
      childrenCount: rows.reduce((sum, r) => sum + r.children.length, 0),
      agreementsCount: rows.filter((r) => r.agreement).length,
    },
  }
}

export async function exportOrganizationDataToBlob(
  organizationId: string,
): Promise<{ blob: Blob; filename: string; summary: OrgExportSummary }> {
  const { workbook, filename, summary } = await generateOrganizationExport(organizationId)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  return { blob, filename, summary }
}
