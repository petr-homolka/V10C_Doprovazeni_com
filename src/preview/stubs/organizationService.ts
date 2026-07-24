import { organization } from '../fixtures'
export const getOrganization = async () => organization as never
export const getPlatformDefaults = async () => ({ koCapacityThreshold: 25, agreementDefaultDurationMonths: 12 }) as never
export const updateOrgCapacityThreshold = async () => {}
export const setPlatformKoCapacityThreshold = async () => {}
export const updateOrgAgreementDurationMonths = async () => {}
export const setPlatformAgreementDefaultDurationMonths = async () => {}
