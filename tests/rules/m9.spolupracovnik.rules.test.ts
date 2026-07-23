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
 * MANDATORY §11.2 test — Spolupracovník (M9, UX zpětná vazba 2026-07-21).
 * Klíčové riziko: `isStaff()`/`sameOrg()` MUSÍ zůstat bez 'spolupracovnik'
 * (viz firestore.rules komentář) — test 1 dokazuje, že i přes STAFF_ROLES
 * členství spolupracovník NEVIDÍ celou organizaci, jen výslovně přiřazené
 * osoby (`hasCollaboratorAssignment`).
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
    await setDoc(doc(db, 'users', 'collab1'), {
      uid: 'collab1',
      role: 'spolupracovnik',
      organizationId: ORG,
      displayName: 'Spolupracovník Jedna',
      email: 'collab1@test.cz',
      createdAt: 'seed',
      collaboratorModules: { viewName: true, writeTimeline: true },
    })
    await setDoc(doc(db, 'users', 'collab-no-write'), {
      uid: 'collab-no-write',
      role: 'spolupracovnik',
      organizationId: ORG,
      displayName: 'Spolupracovník Bez Zápisu',
      email: 'collab2@test.cz',
      createdAt: 'seed',
      collaboratorModules: {},
    })

    await setDoc(doc(db, 'children', 'child-assigned'), {
      uid: 'CHILD1',
      familyId: 'fam1',
      organizationId: ORG,
      firstName: 'Jan',
      lastName: 'Novák',
      birthNumber: '000101/0001',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'children', 'child-unassigned'), {
      uid: 'CHILD2',
      familyId: 'fam1',
      organizationId: ORG,
      firstName: 'Petr',
      lastName: 'Svoboda',
      birthNumber: '000101/0002',
      createdAt: 'seed',
    })

    await setDoc(doc(db, 'collaboratorAssignments', 'collab1_child_child-assigned'), {
      organizationId: ORG,
      collaboratorUid: 'collab1',
      entityType: 'child',
      entityId: 'child-assigned',
      entityName: 'Jan Novák',
      familyDocId: 'fam1',
      familyUid: 'FAM1',
      createdAt: 'seed',
      createdBy: 'ko1',
    })
  })
})

describe('children/{childId} — hasCollaboratorAssignment carve-out', () => {
  it('spolupracovník MŮŽE číst PŘIŘAZENÉ dítě', async () => {
    const asCollab = testEnv.authenticatedContext('collab1')
    await assertSucceeds(getDoc(doc(asCollab.firestore(), 'children', 'child-assigned')))
  })

  it('spolupracovník NEMŮŽE číst NEpřiřazené dítě ve STEJNÉ organizaci', async () => {
    const asCollab = testEnv.authenticatedContext('collab1')
    await assertFails(getDoc(doc(asCollab.firestore(), 'children', 'child-unassigned')))
  })

  it('JINÝ spolupracovník (bez přiřazení) NEMŮŽE číst totéž dítě', async () => {
    const asOther = testEnv.authenticatedContext('collab-no-write')
    await assertFails(getDoc(doc(asOther.firestore(), 'children', 'child-assigned')))
  })
})

describe('collaboratorAssignments/{assignmentId}', () => {
  it('KO (isStaff) MŮŽE založit přiřazení se správným deterministickým ID', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(
      setDoc(doc(asKo.firestore(), 'collaboratorAssignments', 'collab1_child_child-unassigned'), {
        organizationId: ORG,
        collaboratorUid: 'collab1',
        entityType: 'child',
        entityId: 'child-unassigned',
        entityName: 'Petr Svoboda',
        familyDocId: 'fam1',
        familyUid: 'FAM1',
        createdAt: 'test',
        createdBy: 'ko1',
      }),
    )
  })

  it('spolupracovník NEMŮŽE si sám založit přiřazení (jen KO/vedení smí)', async () => {
    const asCollab = testEnv.authenticatedContext('collab1')
    await assertFails(
      setDoc(doc(asCollab.firestore(), 'collaboratorAssignments', 'collab1_child_child-unassigned'), {
        organizationId: ORG,
        collaboratorUid: 'collab1',
        entityType: 'child',
        entityId: 'child-unassigned',
        entityName: 'Petr Svoboda',
        familyDocId: 'fam1',
        familyUid: 'FAM1',
        createdAt: 'test',
        createdBy: 'collab1',
      }),
    )
  })

  it('KO z JINÉ organizace NEMŮŽE založit přiřazení pro cizí organizaci', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'ko-other'), {
        uid: 'ko-other',
        role: 'klicova_osoba',
        organizationId: OTHER_ORG,
        displayName: 'KO Cizí',
        email: 'ko-other@test.cz',
        createdAt: 'seed',
      })
    })
    const asOtherKo = testEnv.authenticatedContext('ko-other')
    await assertFails(
      setDoc(doc(asOtherKo.firestore(), 'collaboratorAssignments', 'collab1_child_child-unassigned'), {
        organizationId: ORG,
        collaboratorUid: 'collab1',
        entityType: 'child',
        entityId: 'child-unassigned',
        entityName: 'Petr Svoboda',
        familyDocId: 'fam1',
        familyUid: 'FAM1',
        createdAt: 'test',
        createdBy: 'ko-other',
      }),
    )
  })

  it('spolupracovník MŮŽE číst VLASTNÍ přiřazení', async () => {
    const asCollab = testEnv.authenticatedContext('collab1')
    await assertSucceeds(getDoc(doc(asCollab.firestore(), 'collaboratorAssignments', 'collab1_child_child-assigned')))
  })
})

describe('collaboratorAssignments/{id}/entries/{entryId} — vlastní pracovní zápis', () => {
  it('spolupracovník S modulem writeTimeline MŮŽE zapsat vlastní zápis', async () => {
    const asCollab = testEnv.authenticatedContext('collab1')
    await assertSucceeds(
      setDoc(doc(asCollab.firestore(), 'collaboratorAssignments', 'collab1_child_child-assigned', 'entries', 'e1'), {
        body: 'Dnes proběhlo doučování matematiky.',
        occurredAt: 'test',
        createdByUid: 'collab1',
      }),
    )
  })

  it('spolupracovník BEZ modulu writeTimeline NEMŮŽE zapsat, i kdyby měl přiřazení', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'collaboratorAssignments', 'collab-no-write_child_child-assigned'), {
        organizationId: ORG,
        collaboratorUid: 'collab-no-write',
        entityType: 'child',
        entityId: 'child-assigned',
        entityName: 'Jan Novák',
        familyDocId: 'fam1',
        familyUid: 'FAM1',
        createdAt: 'seed',
        createdBy: 'ko1',
      })
    })
    const asOther = testEnv.authenticatedContext('collab-no-write')
    await assertFails(
      setDoc(
        doc(asOther.firestore(), 'collaboratorAssignments', 'collab-no-write_child_child-assigned', 'entries', 'e2'),
        { body: 'pokus', occurredAt: 'test', createdByUid: 'collab-no-write' },
      ),
    )
  })

  it('JINÝ spolupracovník NEMŮŽE zapsat do cizího přiřazení', async () => {
    const asOther = testEnv.authenticatedContext('collab-no-write')
    await assertFails(
      setDoc(doc(asOther.firestore(), 'collaboratorAssignments', 'collab1_child_child-assigned', 'entries', 'e3'), {
        body: 'pokus o cizí zápis',
        occurredAt: 'test',
        createdByUid: 'collab-no-write',
      }),
    )
  })

  it('KO organizace MŮŽE číst zápisy pro kontrolu (oversight)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'collaboratorAssignments', 'collab1_child_child-assigned', 'entries', 'e1'),
        { body: 'seed entry', occurredAt: 'seed', createdByUid: 'collab1' },
      )
    })
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(
      getDoc(doc(asKo.firestore(), 'collaboratorAssignments', 'collab1_child_child-assigned', 'entries', 'e1')),
    )
  })
})
