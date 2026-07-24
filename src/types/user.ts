import type { CollaboratorModuleKey } from './collaborator'

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
  'spolupracovnik',
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
  /** UX zpětná vazba 2026-07-21 (M9) — externí spolupracovník (např.
   * lektor doučování) s VLASTNÍM přihlášením, ale bez plného staffového
   * přístupu: vidí JEN jednotlivé děti/pěstouny, co mu KO/vedení výslovně
   * přiřadí (`collaboratorAssignments`), a jen moduly, co mu povolí
   * (`UserDoc.collaboratorModules`). Záměrně NENÍ v `isStaff()` v
   * firestore.rules (viz komentář tam) — na rozdíl od ostatních rolí v
   * tomhle poli nedostává obecný organizační přístup jen tím, že je STAFF_ROLES. */
  spolupracovnik: 'Spolupracovník',
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
  /** §6 A9 kapacita KO (DOPLNENI_ZADANI-DO-M5 §1) — úvazek 0,1–1,0,
   * výchozí 1,0 (plný). Násobí efektivní práh kapacity — poloviční
   * úvazek → poloviční práh. Relevantní jen pro role, co mohou být
   * `assignedTo` na Dohodě, ale nezakazujeme ho vyplnit ostatním. */
  fte?: number
  /** Per-KO override prahu kapacity — NEJVYŠŠÍ priorita v kaskádě
   * (override ?? organizationId.koCapacityThreshold ?? platformDefaults),
   * nastavuje org_admin. Flat číslo PŘED FTE násobením. */
  capacityThresholdOverride?: number
  createdAt: string
  disabledAt?: string | null
  /** Jen na jednom (Petrově) účtu — povolí přepínač náhledu role v avataru
   * (TopBar/AccountMenu), pro rychlé posouzení UI z pohledu různých rolí
   * beze zakládání dalších účtů. Mění POUZE klient-side zobrazovanou roli
   * (viz AuthContext previewRole) — skutečná Firestore oprávnění se vždy
   * řídí SKUTEČNOU hodnotou tohohle pole, ne náhledem. */
  devRolePreview?: boolean
  /** Jen role 'spolupracovnik' — které moduly smí vidět/používat pro
   * SVOJI přiřazené osoby (`collaboratorAssignments`). Nenastavené pole =
   * modul vypnutý (výchozí stav = vše zakázáno, stejný princip jako M8
   * PERMISSION_KEYS). Nastavuje org_admin/vedení, viz collaboratorService.ts. */
  collaboratorModules?: Partial<Record<CollaboratorModuleKey, boolean>>
  /** Narozeninová upozornění dětí/pěstounů v Provozních upozorněních
   * (2026-07-23) — ryze osobní preference, self-editovatelná (viz
   * firestore.rules). Nenastavené = zapnuto (výchozí stav). NEZÁVISLÉ na
   * `notifyNameDays` (2026-07-24, Petrovo zadání — samostatné vypínatelné
   * přepínače, ne jeden společný), nastavení na `/nastaveni/kalendar`. */
  notifyBirthdays?: boolean
  /** Jmeninová upozornění — viz `notifyBirthdays` výš pro plné zdůvodnění,
   * stejný princip, nezávislý přepínač. */
  notifyNameDays?: boolean
  /** Profilová fotka zaměstnance (Cloud Storage download URL, cesta
   * `avatars/users/{uid}/avatar.jpg`) — jen zobrazovací cache, zdroj pravdy
   * je Storage objekt. Nahrává `avatarService.uploadUserAvatar`. */
  photoURL?: string | null
}
