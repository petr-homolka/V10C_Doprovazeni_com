import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

/**
 * MANDATORY §11.2 test — `organizations/{orgId}/tasks` (Úkoly). Stejné
 * riziko jako `m9.calendarEvents.rules.test.ts` (viz tam komentář) —
 * `update` je povolený (dokončení/přiřazení), testy musí dokázat, že se
 * nedá zneužít ke změně identity záznamu, a že `delete` zůstává `if false`.
 */
let testEnv: RulesTestEnvironment

const ORG = 'org1'
const OTHER_ORG = 'org2'

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

    await setDoc(doc(db, 'users', 'ko1'), {
      uid: 'ko1',
      role: 'klicova_osoba',
      organizationId: ORG,
      displayName: 'KO Jedna',
      email: 'ko1@test.cz',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'ko2'), {
      uid: 'ko2',
      role: 'klicova_osoba',
      organizationId: ORG,
      displayName: 'KO Dva',
      email: 'ko2@test.cz',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'ko-other-org'), {
      uid: 'ko-other-org',
      role: 'klicova_osoba',
      organizationId: OTHER_ORG,
      displayName: 'KO Cizí',
      email: 'ko-other@test.cz',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'pestoun-x'), {
      uid: 'pestoun-x',
      role: 'pestoun',
      organizationId: ORG,
      fosterFamilyId: 'fam1',
      displayName: 'Pěstoun X',
      email: 'pestoun@test.cz',
      createdAt: 'seed',
    })

    await setDoc(doc(db, 'organizations', ORG, 'tasks', 'task1'), {
      organizationId: ORG,
      createdByUid: 'ko1',
      assignedToUid: 'ko1',
      title: 'Zavolat pěstounovi',
      status: 'otevreny',
      createdAt: 'seed',
      updatedAt: 'seed',
    })
  })
})

describe('organizations/{orgId}/tasks/{id} — čtení', () => {
  it('staff STEJNÉ organizace MŮŽE číst', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(getDoc(doc(asKo.firestore(), 'organizations', ORG, 'tasks', 'task1')))
  })

  it('JINÝ staff STEJNÉ organizace (ne autor/přiřazený) TAKÉ MŮŽE číst — sdílený seznam úkolů', async () => {
    const asKo2 = testEnv.authenticatedContext('ko2')
    await assertSucceeds(getDoc(doc(asKo2.firestore(), 'organizations', ORG, 'tasks', 'task1')))
  })

  it('staff JINÉ organizace NEMŮŽE číst', async () => {
    const asOther = testEnv.authenticatedContext('ko-other-org')
    await assertFails(getDoc(doc(asOther.firestore(), 'organizations', ORG, 'tasks', 'task1')))
  })

  it('pěstoun NEMÁ k úkolům přístup vůbec', async () => {
    const asFoster = testEnv.authenticatedContext('pestoun-x')
    await assertFails(getDoc(doc(asFoster.firestore(), 'organizations', ORG, 'tasks', 'task1')))
  })
})

describe('organizations/{orgId}/tasks/{id} — zápis', () => {
  it('staff MŮŽE založit nový úkol', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(
      setDoc(doc(asKo.firestore(), 'organizations', ORG, 'tasks', 'new-task'), {
        organizationId: ORG,
        createdByUid: 'ko1',
        assignedToUid: 'ko2',
        title: 'Vyřídit žádost',
        status: 'otevreny',
        createdAt: 'test',
        updatedAt: 'test',
      }),
    )
  })

  it('staff NEMŮŽE založit úkol pro CIZÍ organizaci', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertFails(
      setDoc(doc(asKo.firestore(), 'organizations', OTHER_ORG, 'tasks', 'sneaky'), {
        organizationId: OTHER_ORG,
        createdByUid: 'ko1',
        assignedToUid: 'ko1',
        title: 'Pokus',
        status: 'otevreny',
        createdAt: 'test',
        updatedAt: 'test',
      }),
    )
  })

  it('JINÝ staff STEJNÉ organizace MŮŽE přeřadit/upravit cizí úkol — sdílený seznam', async () => {
    const asKo2 = testEnv.authenticatedContext('ko2')
    await assertSucceeds(
      updateDoc(doc(asKo2.firestore(), 'organizations', ORG, 'tasks', 'task1'), {
        assignedToUid: 'ko2',
        updatedAt: 'test',
      }),
    )
  })

  it('update NEMŮŽE změnit organizationId (padělání identity záznamu)', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertFails(
      updateDoc(doc(asKo.firestore(), 'organizations', ORG, 'tasks', 'task1'), {
        organizationId: OTHER_ORG,
        updatedAt: 'test',
      }),
    )
  })

  it('staff JINÉ organizace NEMŮŽE upravit', async () => {
    const asOther = testEnv.authenticatedContext('ko-other-org')
    await assertFails(
      updateDoc(doc(asOther.firestore(), 'organizations', ORG, 'tasks', 'task1'), {
        title: 'Pokus o úpravu',
      }),
    )
  })

  it('"dokončení"/"zrušení" = update status, NIKDY skutečné mazání', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(
      updateDoc(doc(asKo.firestore(), 'organizations', ORG, 'tasks', 'task1'), {
        status: 'hotovo',
        completedAt: 'test',
        updatedAt: 'test',
      }),
    )
  })

  it('mazání je VŽDY zakázané, i pro autora (§5 audit stopa)', async () => {
    const { deleteDoc } = await import('firebase/firestore')
    const asKo = testEnv.authenticatedContext('ko1')
    await assertFails(deleteDoc(doc(asKo.firestore(), 'organizations', ORG, 'tasks', 'task1')))
  })

  it('pěstoun NEMŮŽE zapsat vůbec', async () => {
    const asFoster = testEnv.authenticatedContext('pestoun-x')
    await assertFails(
      setDoc(doc(asFoster.firestore(), 'organizations', ORG, 'tasks', 'foster-attempt'), {
        organizationId: ORG,
        createdByUid: 'pestoun-x',
        assignedToUid: 'pestoun-x',
        title: 'Pokus pěstouna',
        status: 'otevreny',
        createdAt: 'test',
        updatedAt: 'test',
      }),
    )
  })
})
