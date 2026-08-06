import { staff } from '../fixtures'
export const listStaff = async () => staff
export const createStaffMember = async () => staff[0]
export const setStaffMemberDisabled = async () => {}
export const setStaffMemberDisabledAudited = async () => {}
export const updateStaffMemberRoleAudited = async () => {}
export const updateStaffMemberRole = async () => {}
export const getStaffMember = async (uid: string) => staff.find((s) => s.uid === uid) ?? null
export const updateStaffCapacitySettings = async () => {}
export const updateNotifyBirthdays = async () => {}
export const updateNotifyNameDays = async () => {}
