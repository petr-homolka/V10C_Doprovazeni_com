import { doc, collection, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createStaffAuthAccount } from '@/lib/secondaryAuth'
import { STAFF_ROLES, type StaffRole, type UserDoc } from '@/types/user'

/**
 * Barrel service (ZADANI §11 bod 3) — jeden import bod pro CRUD nad
 * zaměstnanci dané organizace. Nepoužívá se realtime `onSnapshot` (§10 —
 * jediný listener v appce je vlastní profil, viz AuthContext.tsx),
 * seznam se natahuje jednorázově a ručně obnovuje.
 */

export async function listStaff(organizationId: string): Promise<UserDoc[]> {
  const q = query(
    collection(db, 'users'),
    where('organizationId', '==', organizationId),
    where('role', 'in', [...STAFF_ROLES]),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as UserDoc)
}

export interface CreateStaffMemberInput {
  email: string
  password: string
  displayName: string
  role: StaffRole
  organizationId: string
}

/**
 * §6 A9: org_admin zakládá zaměstnance. Auth účet vzniká přes sekundární
 * app instanci (viz secondaryAuth.ts), aby to volajícího org_admina
 * neodhlásilo. `firestore.rules` ověří, že volající je org_admin ve STEJNÉ
 * organizaci a že přiřazovaná role je platná staff role (nikdy
 * `superadmin`) — viz pravidlo `users/{uid}` create, druhý disjunkt.
 */
export async function createStaffMember(input: CreateStaffMemberInput): Promise<UserDoc> {
  const uid = await createStaffAuthAccount(input.email, input.password)
  const userData: UserDoc = {
    uid,
    role: input.role,
    displayName: input.displayName,
    email: input.email,
    organizationId: input.organizationId,
    createdAt: new Date().toISOString(),
  }
  await setDoc(doc(db, 'users', uid), userData)
  return userData
}

/** Soft-delete (§5 append-only/audit princip — nikdy hard delete profilu). */
export async function setStaffMemberDisabled(uid: string, disabled: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    disabledAt: disabled ? new Date().toISOString() : null,
  })
}

export async function updateStaffMemberRole(uid: string, role: StaffRole): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role })
}
