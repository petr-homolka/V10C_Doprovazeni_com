import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'

type TestFirestore = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>

/**
 * M8 rules — external_participants/{epId}/access/{childId}/grants/{grantId}
 * + organizations/{orgId}/externalRoleTemplates (§5.1 povinná sada, viz
 * CURRENT_STATE.md "Jak pokračovat"). Necitlivé oprávnění = grantDirect
 * (1 krok, rovnou 'active'), citlivé = requested→approved→active (3 role:
 * KO žádá, vedení schvaluje, jen org_admin aktivuje) — přesně to, co
 * firestore.rules `access/{childId}/grants/{grantId}` blok vynucuje.
 */

let testEnv: RulesTestEnvironment

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const EP_A = 'ep-a'
const CHILD_1 = 'child-1'

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
    await setDoc(doc(db, 'users', 'admin-a'), {
      uid: 'admin-a', role: 'org_admin', organizationId: ORG_A, displayName: 'Admin A', email: 'a@example.com', createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'ko-a'), {
      uid: 'ko-a', role: 'klicova_osoba', organizationId: ORG_A, displayName: 'KO A', email: 'ko-a@example.com', createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'teamleader-a'), {
      uid: 'teamleader-a', role: 'teamleader', organizationId: ORG_A, displayName: 'TL A', email: 'tl-a@example.com', createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'admin-b'), {
      uid: 'admin-b', role: 'org_admin', organizationId: ORG_B, displayName: 'Admin B', email: 'b@example.com', createdAt: 'seed',
    })
    await setDoc(doc(db, 'external_participants', EP_A), {
      organizationId: ORG_A,
      name: 'Babička Novotná',
      email: 'babicka@example.com',
      relationLabel: 'prarodič',
      createdAt: 'seed',
    })
  })
})

function grantRef(db: TestFirestore, grantId: string) {
  return doc(db, 'external_participants', EP_A, 'access', CHILD_1, 'grants', grantId)
}
function grantsRef(db: TestFirestore) {
  return collection(db, 'external_participants', EP_A, 'access', CHILD_1, 'grants')
}
function templatesRef(db: TestFirestore, orgId: string) {
  return collection(db, 'organizations', orgId, 'externalRoleTemplates')
}

describe('external_participants/{epId}/access/{childId}/grants — §5.1 grant engine', () => {
  it('KO can grantDirect a non-sensitive permission (1 krok, rovnou active)', async () => {
    const asKoA = testEnv.authenticatedContext('ko-a')
    await assertSucceeds(
      setDoc(grantRef(asKoA.firestore(), 'g1'), {
        permissionKey: 'viewDocuments',
        status: 'active',
        validFrom: '2026-01-01',
        requestedBy: 'ko-a',
        requestedAt: 'test',
      }),
    )
  })

  it('KO CANNOT create a sensitive permission directly as active', async () => {
    const asKoA = testEnv.authenticatedContext('ko-a')
    await assertFails(
      setDoc(grantRef(asKoA.firestore(), 'g2'), {
        permissionKey: 'viewMedical',
        status: 'active',
        validFrom: '2026-01-01',
        requestedBy: 'ko-a',
        requestedAt: 'test',
      }),
    )
  })

  it('KO CAN request a sensitive permission (status requested, krok 1/3)', async () => {
    const asKoA = testEnv.authenticatedContext('ko-a')
    await assertSucceeds(
      setDoc(grantRef(asKoA.firestore(), 'g3'), {
        permissionKey: 'viewMedical',
        status: 'requested',
        validFrom: '2026-01-01',
        requestedBy: 'ko-a',
        requestedAt: 'test',
      }),
    )
  })

  it('KO CANNOT approve (krok 2/3 je jen pro vedení)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(grantRef(ctx.firestore(), 'g4'), {
        permissionKey: 'viewMedical', status: 'requested', validFrom: '2026-01-01', requestedBy: 'ko-a', requestedAt: 'seed',
      })
    })
    const asKoA = testEnv.authenticatedContext('ko-a')
    await assertFails(
      updateDoc(grantRef(asKoA.firestore(), 'g4'), { status: 'approved', approvedBy: 'ko-a', approvedAt: 'test' }),
    )
  })

  it('teamleader CAN approve (krok 2/3)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(grantRef(ctx.firestore(), 'g5'), {
        permissionKey: 'viewMedical', status: 'requested', validFrom: '2026-01-01', requestedBy: 'ko-a', requestedAt: 'seed',
      })
    })
    const asTlA = testEnv.authenticatedContext('teamleader-a')
    await assertSucceeds(
      updateDoc(grantRef(asTlA.firestore(), 'g5'), { status: 'approved', approvedBy: 'teamleader-a', approvedAt: 'test' }),
    )
  })

  it('teamleader CANNOT activate (krok 3/3 je jen org_admin)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(grantRef(ctx.firestore(), 'g6'), {
        permissionKey: 'viewMedical', status: 'approved', validFrom: '2026-01-01', requestedBy: 'ko-a', requestedAt: 'seed',
        approvedBy: 'teamleader-a', approvedAt: 'seed',
      })
    })
    const asTlA = testEnv.authenticatedContext('teamleader-a')
    await assertFails(
      updateDoc(grantRef(asTlA.firestore(), 'g6'), { status: 'active', activatedBy: 'teamleader-a', activatedAt: 'test' }),
    )
  })

  it('org_admin CAN activate (krok 3/3)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(grantRef(ctx.firestore(), 'g7'), {
        permissionKey: 'viewMedical', status: 'approved', validFrom: '2026-01-01', requestedBy: 'ko-a', requestedAt: 'seed',
        approvedBy: 'teamleader-a', approvedAt: 'seed',
      })
    })
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertSucceeds(
      updateDoc(grantRef(asAdminA.firestore(), 'g7'), { status: 'active', activatedBy: 'admin-a', activatedAt: 'test' }),
    )
  })

  it('org_admin CAN revoke an active grant', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(grantRef(ctx.firestore(), 'g8'), {
        permissionKey: 'viewDocuments', status: 'active', validFrom: '2026-01-01', requestedBy: 'ko-a', requestedAt: 'seed',
      })
    })
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertSucceeds(
      updateDoc(grantRef(asAdminA.firestore(), 'g8'), { status: 'revoked', validTo: 'test', revokedBy: 'admin-a', revokedAt: 'test' }),
    )
  })

  it('a grant can never be deleted, even by org_admin', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(grantRef(ctx.firestore(), 'g9'), {
        permissionKey: 'viewDocuments', status: 'revoked', validFrom: '2026-01-01', requestedBy: 'ko-a', requestedAt: 'seed',
      })
    })
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertFails(deleteDoc(grantRef(asAdminA.firestore(), 'g9')))
  })

  it('a DIFFERENT org cannot read or create grants under org A\'s externista', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(grantRef(ctx.firestore(), 'g10'), {
        permissionKey: 'viewDocuments', status: 'active', validFrom: '2026-01-01', requestedBy: 'ko-a', requestedAt: 'seed',
      })
    })
    const asAdminB = testEnv.authenticatedContext('admin-b')
    await assertFails(getDocs(grantsRef(asAdminB.firestore())))
    await assertFails(
      setDoc(grantRef(asAdminB.firestore(), 'g11'), {
        permissionKey: 'viewDocuments', status: 'active', validFrom: '2026-01-01', requestedBy: 'admin-b', requestedAt: 'test',
      }),
    )
  })
})

describe('organizations/{orgId}/externalRoleTemplates — §5.1', () => {
  it('org_admin can write a role template', async () => {
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertSucceeds(
      setDoc(doc(templatesRef(asAdminA.firestore(), ORG_A), 't1'), {
        name: 'Prarodič',
        category: 'prarodič',
        defaultPermissions: { viewDocuments: true, viewPhotos: true },
        createdBy: 'admin-a',
        updatedAt: 'test',
      }),
    )
  })

  it('non-org_admin staff CANNOT write a role template', async () => {
    const asKoA = testEnv.authenticatedContext('ko-a')
    await assertFails(
      setDoc(doc(templatesRef(asKoA.firestore(), ORG_A), 't2'), {
        name: 'Prarodič',
        category: 'prarodič',
        defaultPermissions: {},
        createdBy: 'ko-a',
        updatedAt: 'test',
      }),
    )
  })

  it('a DIFFERENT org cannot read org A\'s role templates', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(templatesRef(ctx.firestore(), ORG_A), 't3'), {
        name: 'Prarodič', category: 'prarodič', defaultPermissions: {}, createdBy: 'admin-a', updatedAt: 'seed',
      })
    })
    const asAdminB = testEnv.authenticatedContext('admin-b')
    await assertFails(getDocs(templatesRef(asAdminB.firestore(), ORG_A)))
  })
})
