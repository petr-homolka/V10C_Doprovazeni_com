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
 * MANDATORY §11.2 test — `users/{uid}/starredFamilies/{familyId}` (UX
 * zpětná vazba 2026-07-21, seznam Rodin). Rule je nejjednodušší možná
 * ("vidí jen ten, kdo si hvězdičku udělal") — žádný `sameOrg`/staff
 * výjimka, žádné `userDoc()` čtení, proto samostatný lehký soubor místo
 * rozšiřování m1/m2 seedu.
 */
let testEnv: RulesTestEnvironment

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
})

describe('users/{uid}/starredFamilies/{familyId}', () => {
  it('vlastník MŮŽE založit vlastní hvězdičku', async () => {
    const asOwner = testEnv.authenticatedContext('user-a')
    await assertSucceeds(
      setDoc(doc(asOwner.firestore(), 'users', 'user-a', 'starredFamilies', 'family-1'), {
        starredAt: 'test',
      }),
    )
  })

  it('vlastník MŮŽE přečíst vlastní hvězdičku', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'user-a', 'starredFamilies', 'family-1'), { starredAt: 'test' })
    })
    const asOwner = testEnv.authenticatedContext('user-a')
    await assertSucceeds(getDoc(doc(asOwner.firestore(), 'users', 'user-a', 'starredFamilies', 'family-1')))
  })

  it('JINÝ přihlášený uživatel NEMŮŽE přečíst cizí hvězdičku', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'user-a', 'starredFamilies', 'family-1'), { starredAt: 'test' })
    })
    const asOther = testEnv.authenticatedContext('user-b')
    await assertFails(getDoc(doc(asOther.firestore(), 'users', 'user-a', 'starredFamilies', 'family-1')))
  })

  it('JINÝ přihlášený uživatel NEMŮŽE založit hvězdičku pod cizím uid', async () => {
    const asOther = testEnv.authenticatedContext('user-b')
    await assertFails(
      setDoc(doc(asOther.firestore(), 'users', 'user-a', 'starredFamilies', 'family-1'), { starredAt: 'test' }),
    )
  })

  it('nepřihlášený NEMŮŽE číst ani zapisovat', async () => {
    const anon = testEnv.unauthenticatedContext()
    await assertFails(getDoc(doc(anon.firestore(), 'users', 'user-a', 'starredFamilies', 'family-1')))
  })
})
