import { agreementsByFamilyId, staff } from '../fixtures'
export const agreementRef = () => ({}) as never
export const getActiveAgreement = async (familyDocId: string) => agreementsByFamilyId[familyDocId] ?? null
export const scheduleAgreementEnd = async () => {}
export const archiveSegment = async () => {}
export const unarchiveSegment = async () => {}
export const listSegmentsForOrg = async () => ({})
export const listArchivedFamilyIds = async () => new Set<string>()
export const scheduleAgreementEndAudited = async () => {}
export const cancelPendingAgreementEndAudited = async () => {}
export const cancelPendingAgreementEnd = async () => {}
export const updateAgreementAssignedTo = async () => {}
export const createAgreement = async () => ({}) as never
export const checkKoCapacity = async () => ({ ok: true, activeCaseload: 12, threshold: 25 }) as never
export const listActiveCaseloadByKo = async () => ({ 'u-eva': 27, 'u-marek': 8, 'u-tomas': 3 })
export const listOverCapacityKos = async () => [
  { uid: 'u-eva', displayName: staff[0].displayName, activeCaseload: 27, threshold: 25 },
]
export const listActiveAgreementsForOrg = async () => agreementsByFamilyId
