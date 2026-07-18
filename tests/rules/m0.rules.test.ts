import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'

/**
 * M0 rules smoke test — proves the emulator + rules-unit-testing harness
 * works end-to-end, and locks in the two foundational patterns from §5:
 * "sameOrg() must always be gated behind isStaff()" and "test as a
 * non-superadmin". The exhaustive §4.5 / §5.1 matrices land with M2/M8 —
 * this file is the scaffold they build on, not a replacement for them.
 *
 * Run with `npm run test:rules` (wraps this in `firebase emulators:exec`,
 * it will NOT pass under plain `npm run test` without a running emulator).
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
    await setDoc(doc(db, 'users', 'ko-a1'), {
      uid: 'ko-a1',
      role: 'klicova_osoba',
      organizationId: ORG_A,
      displayName: 'KO Alice',
      email: 'alice@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'ko-a2'), {
      uid: 'ko-a2',
      role: 'klicova_osoba',
      organizationId: ORG_A,
      displayName: 'KO Bob',
      email: 'bob@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'ko-b1'), {
      uid: 'ko-b1',
      role: 'org_admin',
      organizationId: ORG_B,
      displayName: 'Admin Carla',
      email: 'carla@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'pestoun-a1'), {
      uid: 'pestoun-a1',
      role: 'pestoun',
      organizationId: ORG_A, // pěstoun MÁ organizationId — přesně past z §5
      displayName: 'Pěstoun Dana',
      email: 'dana@example.com',
      createdAt: 'seed',
    })
  })
})

describe('users/{uid} read rules', () => {
  it('unauthenticated cannot read any user doc', async () => {
    const unauth = testEnv.unauthenticatedContext()
    await assertFails(getDoc(doc(unauth.firestore(), 'users', 'ko-a1')))
  })

  it('a signed-in user can always read their own doc', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertSucceeds(getDoc(doc(asKoA1.firestore(), 'users', 'ko-a1')))
  })

  it('staff can read a colleague in the SAME org', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertSucceeds(getDoc(doc(asKoA1.firestore(), 'users', 'ko-a2')))
  })

  it('staff CANNOT read a user in a DIFFERENT org', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertFails(getDoc(doc(asKoA1.firestore(), 'users', 'ko-b1')))
  })

  it('§5 "Klíčová past": a non-staff user (pěstoun) with the SAME organizationId cannot read a colleague', async () => {
    const asPestounA1 = testEnv.authenticatedContext('pestoun-a1')
    await assertFails(getDoc(doc(asPestounA1.firestore(), 'users', 'ko-a2')))
  })
})

describe('users/{uid} write rules — seam intentionally closed', () => {
  it('nobody can create a user doc via the client yet, not even org_admin (§6 A6/A9 land in M1/M4)', async () => {
    const asOrgAdminB1 = testEnv.authenticatedContext('ko-b1')
    await assertFails(
      setDoc(doc(asOrgAdminB1.firestore(), 'users', 'new-hire'), {
        uid: 'new-hire',
        role: 'zamestnanec',
        organizationId: ORG_B,
        displayName: 'New Hire',
        email: 'new@example.com',
        createdAt: 'test',
      }),
    )
  })
})

describe('counters/{orgId}_{typ} rules', () => {
  it('staff can write a counter doc for their own org', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertSucceeds(
      setDoc(doc(asKoA1.firestore(), 'counters', `${ORG_A}_20`), {
        organizationId: ORG_A,
        entityType: 'child',
        value: 1,
      }),
    )
  })

  it('staff CANNOT write a counter doc for a different org', async () => {
    const asKoA1 = testEnv.authenticatedContext('ko-a1')
    await assertFails(
      setDoc(doc(asKoA1.firestore(), 'counters', `${ORG_B}_20`), {
        organizationId: ORG_B,
        entityType: 'child',
        value: 1,
      }),
    )
  })

  it('non-staff (pěstoun) cannot write a counter doc even in their own org', async () => {
    const asPestounA1 = testEnv.authenticatedContext('pestoun-a1')
    await assertFails(
      setDoc(doc(asPestounA1.firestore(), 'counters', `${ORG_A}_20`), {
        organizationId: ORG_A,
        entityType: 'child',
        value: 1,
      }),
    )
  })
})
