/**
 * Role model — ZADANI §5. Role se čte VÝHRADNĚ z Firestore users/{uid},
 * NIKDY z Firebase Auth Custom Claims (viz §5 "Klíčová past").
 */

export const STAFF_ROLES = [
  'superadmin',
  'org_admin',
  'vedouci_pobocky',
  'teamleader',
  'klicova_osoba',
  'asistent_ko',
  'zamestnanec',
] as const

export const READ_ONLY_MANAGER_ROLES = ['vedouci_pobocky', 'teamleader'] as const

export const EXTERNAL_ROLES = ['pestoun', 'external', 'provider'] as const

export type StaffRole = (typeof STAFF_ROLES)[number]
export type ExternalRole = (typeof EXTERNAL_ROLES)[number]
export type UserRole = StaffRole | ExternalRole

export function isStaffRole(role: UserRole): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role)
}

export function isReadOnlyManagerRole(role: UserRole): boolean {
  return (READ_ONLY_MANAGER_ROLES as readonly string[]).includes(role)
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  superadmin: 'Superadmin',
  org_admin: 'Správce organizace',
  vedouci_pobocky: 'Vedoucí pobočky',
  teamleader: 'Teamleader',
  klicova_osoba: 'Klíčová osoba',
  asistent_ko: 'Asistent KO',
  zamestnanec: 'Zaměstnanec',
}

/**
 * users/{uid} — §4.1. Pole se liší podle role; nikdy nezaplňujeme
 * organizationId pro 'provider' (obsluhuje víc organizací najednou, scoping
 * jde přes providerInstitutionRef — viz §6 A10 bezpečnostní past).
 */
export interface UserDoc {
  uid: string
  role: UserRole
  displayName: string
  email: string
  organizationId?: string // chybí u role 'provider'
  fosterFamilyId?: string // jen role 'pestoun'
  fosterPersonRef?: string // jen role 'pestoun' — → fosterPersons/{fosterId}
  externalParticipantId?: string // jen role 'external'
  providerInstitutionRef?: string // jen role 'provider' — → institutions/{id}
  docApprover?: boolean
  createdAt: string
  disabledAt?: string | null
  /** Jen na jednom (Petrově) účtu — povolí přepínač náhledu role v avataru
   * (TopBar/AccountMenu), pro rychlé posouzení UI z pohledu různých rolí
   * beze zakládání dalších účtů. Mění POUZE klient-side zobrazovanou roli
   * (viz AuthContext previewRole) — skutečná Firestore oprávnění se vždy
   * řídí SKUTEČNOU hodnotou tohohle pole, ne náhledem. */
  devRolePreview?: boolean
}
