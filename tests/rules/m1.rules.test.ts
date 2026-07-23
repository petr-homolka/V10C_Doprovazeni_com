import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'

/**
 * M1 rules — organization bootstrap + staff creation (§6 A9). Not one of
 * the two MANDATORY suites (§11.2 — those are §4.5/§5.1, M2/M8), written
 * anyway because the bootstrap logic (a brand-new, profile-less user
 * founding both an org and their own org_admin profile) is genuinely
 * easy to get subtly wrong. Same NOT-YET-VERIFIED caveat as m0/m2 — see
 * CURRENT_STATE.md.
 */

let testEnv: RulesTestEnvironment

const ORG_A = 'org-a'
const ORG_B = 'org-b'

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-doprovazeni',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A), {
      orgCode: '0001',
      name: 'Org A',
      createdByUid: 'org-admin-a',
      createdAt: 'seed',
      capacityWarningThreshold: 25,
    })
    await setDoc(doc(db, 'users', 'org-admin-a'), {
      uid: 'org-admin-a',
      role: 'org_admin',
      organizationId: ORG_A,
      displayName: 'Admin Alice',
      email: 'alice@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'ko-a1'), {
      uid: 'ko-a1',
      role: 'klicova_osoba',
      organizationId: ORG_A,
      displayName: 'KO Bob',
      email: 'bob@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'org-admin-b'), {
      uid: 'org-admin-b',
      role: 'org_admin',
      organizationId: ORG_B,
      displayName: 'Admin Carla',
      email: 'carla@example.com',
      createdAt: 'seed',
    })
  })
})

describe('organizations/{orgId} bootstrap create', () => {
  it('a profile-less user can found an organization claiming themselves as owner', async () => {
    const asNewUser = testEnv.authenticatedContext('brand-new-user')
    await assertSucceeds(
      setDoc(doc(asNewUser.firestore(), 'organizations', 'org-new'), {
        orgCode: '0002',
        name: 'New Org',
        createdByUid: 'brand-new-user',
        createdAt: 'test',
        capacityWarningThreshold: 25,
      }),
    )
  })

  it('a profile-less user CANNOT found an organization claiming someone else as owner', async () => {
    const asNewUser = testEnv.authenticatedContext('brand-new-user')
    await assertFails(
      setDoc(doc(asNewUser.firestore(), 'organizations', 'org-new'), {
        orgCode: '0002',
        name: 'New Org',
        createdByUid: 'someone-else',
        createdAt: 'test',
        capacityWarningThreshold: 25,
      }),
    )
  })

  it('a user who already has a profile cannot use the bootstrap path to found a second org', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertFails(
      setDoc(doc(asKoA1.firestore(), 'organizations', 'org-new'), {
        orgCode: '0002',
        name: 'New Org',
        createdByUid: 'ko-a1',
        createdAt: 'test',
        capacityWarningThreshold: 25,
      }),
    )
  })
})

describe('users/{uid} bootstrap self-registration', () => {
  it('a profile-less user can create their own org_admin profile for the org they just founded', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'organizations', 'org-bootstrap'), {
        orgCode: '0003',
        name: 'Bootstrap Org',
        createdByUid: 'brand-new-user',
        createdAt: 'seed',
        capacityWarningThreshold: 25,
      })
    })
    const asNewUser = testEnv.authenticatedContext('brand-new-user')
    await assertSucceeds(
      setDoc(doc(asNewUser.firestore(), 'users', 'brand-new-user'), {
        uid: 'brand-new-user',
        role: 'org_admin',
        organizationId: 'org-bootstrap',
        displayName: 'New Admin',
        email: 'new@example.com',
        createdAt: 'test',
      }),
    )
  })

  it('cannot self-register as org_admin against an org founded by someone else', async () => {
    const asImpersonator = testEnv.authenticatedContext('impersonator')
    await assertFails(
      setDoc(doc(asImpersonator.firestore(), 'users', 'impersonator'), {
        uid: 'impersonator',
        role: 'org_admin',
        organizationId: ORG_A, // founded by org-admin-a, not "impersonator"
        displayName: 'Impersonator',
        email: 'bad@example.com',
        createdAt: 'test',
      }),
    )
  })

  it('cannot self-register with a role other than org_admin via the bootstrap path', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'organizations', 'org-bootstrap2'), {
        orgCode: '0004',
        name: 'Bootstrap Org 2',
        createdByUid: 'sneaky-user',
        createdAt: 'seed',
        capacityWarningThreshold: 25,
      })
    })
    const asSneaky = testEnv.authenticatedContext('sneaky-user')
    await assertFails(
      setDoc(doc(asSneaky.firestore(), 'users', 'sneaky-user'), {
        uid: 'sneaky-user',
        role: 'superadmin',
        organizationId: 'org-bootstrap2',
        displayName: 'Sneaky',
        email: 'sneaky@example.com',
        createdAt: 'test',
      }),
    )
  })
})

describe('users/{uid} — org_admin creates staff', () => {
  it('org_admin can create a staff member in their own org', async () => {
    const asAdminA = testEnv.authenticatedContext('org-admin-a')
    await assertSucceeds(
      setDoc(doc(asAdminA.firestore(), 'users', 'new-hire-a'), {
        uid: 'new-hire-a',
        role: 'zamestnanec',
        organizationId: ORG_A,
        displayName: 'New Hire',
        email: 'new@example.com',
        createdAt: 'test',
      }),
    )
  })

  it('org_admin CANNOT create a staff member in a DIFFERENT org', async () => {
    const asAdminA = testEnv.authenticatedContext('org-admin-a')
    await assertFails(
      setDoc(doc(asAdminA.firestore(), 'users', 'new-hire-b'), {
        uid: 'new-hire-b',
        role: 'zamestnanec',
        organizationId: ORG_B,
        displayName: 'New Hire',
        email: 'new@example.com',
        createdAt: 'test',
      }),
    )
  })

  it('org_admin CANNOT assign the superadmin role to a new staff member', async () => {
    const asAdminA = testEnv.authenticatedContext('org-admin-a')
    await assertFails(
      setDoc(doc(asAdminA.firestore(), 'users', 'new-hire-a'), {
        uid: 'new-hire-a',
        role: 'superadmin',
        organizationId: ORG_A,
        displayName: 'New Hire',
        email: 'new@example.com',
        createdAt: 'test',
      }),
    )
  })
})

describe('users/{uid} update rules', () => {
  it('a user can update their own displayName', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertSucceeds(
      updateDoc(doc(asKoA1.firestore(), 'users', 'ko-a1'), { displayName: 'Bob Renamed' }),
    )
  })

  it('a user CANNOT promote themselves to org_admin', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertFails(updateDoc(doc(asKoA1.firestore(), 'users', 'ko-a1'), { role: 'org_admin' }))
  })

  it('a user can toggle their own notifyBirthdays preference', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertSucceeds(
      updateDoc(doc(asKoA1.firestore(), 'users', 'ko-a1'), { notifyBirthdays: false }),
    )
  })

  it('a user CANNOT sneak role change in alongside notifyBirthdays', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertFails(
      updateDoc(doc(asKoA1.firestore(), 'users', 'ko-a1'), { notifyBirthdays: false, role: 'org_admin' }),
    )
  })

  it('a user can toggle their own notifyNameDays preference INDEPENDENTLY of notifyBirthdays', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertSucceeds(
      updateDoc(doc(asKoA1.firestore(), 'users', 'ko-a1'), { notifyNameDays: false }),
    )
  })

  it('a user CANNOT sneak role change in alongside notifyNameDays', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertFails(
      updateDoc(doc(asKoA1.firestore(), 'users', 'ko-a1'), { notifyNameDays: false, role: 'org_admin' }),
    )
  })

  it('org_admin can disable a colleague in their own org (soft-delete via disabledAt)', async () => {
    const asAdminA = testEnv.authenticatedContext('org-admin-a')
    await assertSucceeds(
      updateDoc(doc(asAdminA.firestore(), 'users', 'ko-a1'), { disabledAt: 'test' }),
    )
  })

  it('org_admin CANNOT disable a colleague in a DIFFERENT org', async () => {
    const asAdminB = testEnv.authenticatedContext('org-admin-b')
    await assertFails(
      updateDoc(doc(asAdminB.firestore(), 'users', 'ko-a1'), { disabledAt: 'test' }),
    )
  })
})
