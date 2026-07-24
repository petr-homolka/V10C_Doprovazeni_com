import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

/**
 * MANDATORY §11.2 test — `organizations/{orgId}/enumOptions/{listId}`
 * (Cesta B 2026-07-23, "číselníky nesmí mít konečný počet variant").
 * Klíčové riziko: tenhle typ je ZÁMĚRNĚ volnější než `organizations/{orgId}`
 * samotný (KTERÝKOLI staff smí přidat položku, ne jen org_admin) — testy
 * musí dokázat, že "kterýkoli staff" pořád znamená STEJNÁ organizace
 * (žádný přístup napříč org), a že delete zůstává `if false`.
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

    await setDoc(doc(db, 'users', 'zam1'), {
      uid: 'zam1',
      role: 'zamestnanec',
      organizationId: ORG,
      displayName: 'Zaměstnanec Jedna',
      email: 'zam1@test.cz',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'zam-other-org'), {
      uid: 'zam-other-org',
      role: 'zamestnanec',
      organizationId: OTHER_ORG,
      displayName: 'Zaměstnanec Cizí',
      email: 'zam-other@test.cz',
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

    await setDoc(doc(db, 'organizations', ORG, 'enumOptions', 'calendarEventKind'), {
      options: [{ key: 'doprovod-lekar', label: 'Doprovod k lékaři', createdByUid: 'zam1', createdAt: 'seed' }],
    })
  })
})

describe('organizations/{orgId}/enumOptions/{listId} — čtení', () => {
  it('staff STEJNÉ organizace MŮŽE číst', async () => {
    const asZam = testEnv.authenticatedContext('zam1')
    await assertSucceeds(
      getDoc(doc(asZam.firestore(), 'organizations', ORG, 'enumOptions', 'calendarEventKind')),
    )
  })

  it('staff JINÉ organizace NEMŮŽE číst', async () => {
    const asOther = testEnv.authenticatedContext('zam-other-org')
    await assertFails(
      getDoc(doc(asOther.firestore(), 'organizations', ORG, 'enumOptions', 'calendarEventKind')),
    )
  })

  it('nepřihlášený NEMŮŽE číst', async () => {
    const anon = testEnv.unauthenticatedContext()
    await assertFails(
      getDoc(doc(anon.firestore(), 'organizations', ORG, 'enumOptions', 'calendarEventKind')),
    )
  })
})

describe('organizations/{orgId}/enumOptions/{listId} — zápis', () => {
  it('BĚŽNÝ zaměstnanec (ne jen org_admin) MŮŽE přidat novou položku (update)', async () => {
    const asZam = testEnv.authenticatedContext('zam1')
    await assertSucceeds(
      updateDoc(doc(asZam.firestore(), 'organizations', ORG, 'enumOptions', 'calendarEventKind'), {
        options: [
          { key: 'doprovod-lekar', label: 'Doprovod k lékaři', createdByUid: 'zam1', createdAt: 'seed' },
          { key: 'ucastnicky-poplatek', label: 'Účastnický poplatek', createdByUid: 'zam1', createdAt: 'test' },
        ],
      }),
    )
  })

  it('BĚŽNÝ zaměstnanec MŮŽE založit nový číselník (create), pokud ještě neexistuje', async () => {
    const asZam = testEnv.authenticatedContext('zam1')
    await assertSucceeds(
      setDoc(doc(asZam.firestore(), 'organizations', ORG, 'enumOptions', 'noveCiselniky'), {
        options: [{ key: 'prvni', label: 'První', createdByUid: 'zam1', createdAt: 'test' }],
      }),
    )
  })

  it('staff JINÉ organizace NEMŮŽE zapisovat', async () => {
    const asOther = testEnv.authenticatedContext('zam-other-org')
    await assertFails(
      updateDoc(doc(asOther.firestore(), 'organizations', ORG, 'enumOptions', 'calendarEventKind'), {
        options: [{ key: 'x', label: 'X', createdByUid: 'zam-other-org', createdAt: 'test' }],
      }),
    )
  })

  it('pěstoun NEMÁ přístup vůbec', async () => {
    const asFoster = testEnv.authenticatedContext('pestoun-x')
    await assertFails(
      getDoc(doc(asFoster.firestore(), 'organizations', ORG, 'enumOptions', 'calendarEventKind')),
    )
    await assertFails(
      updateDoc(doc(asFoster.firestore(), 'organizations', ORG, 'enumOptions', 'calendarEventKind'), {
        options: [{ key: 'x', label: 'X', createdByUid: 'pestoun-x', createdAt: 'test' }],
      }),
    )
  })

  it('nepřihlášený NEMŮŽE zapisovat', async () => {
    const anon = testEnv.unauthenticatedContext()
    await assertFails(
      updateDoc(doc(anon.firestore(), 'organizations', ORG, 'enumOptions', 'calendarEventKind'), {
        options: [{ key: 'x', label: 'X', createdByUid: 'anon', createdAt: 'test' }],
      }),
    )
  })

  it('delete zůstává ZAKÁZANÉ pro kohokoli', async () => {
    const asZam = testEnv.authenticatedContext('zam1')
    await assertFails(
      deleteDoc(doc(asZam.firestore(), 'organizations', ORG, 'enumOptions', 'calendarEventKind')),
    )
  })
})
