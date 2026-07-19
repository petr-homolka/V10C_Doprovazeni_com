import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'

/**
 * M1.5 rules — import (§5.5 "staging → report → commit → undo") + záloha
 * (§5.5 "vrstva 2") + rollback výjimka `canRollbackImportEntity` na
 * `families`/`children` (jinak natvrdo `delete: if false`, §5). Ne jedna
 * z mandatorních §11.2 sad (§4.5/§5.1), ale `canRollbackImportEntity` je
 * přesně ten typ jemné, snadno špatně napsané podmínky (viz M2 test
 * suite, kde jsme podobně našli díru) — proto vlastní testy, ne jen
 * spoléhání na review.
 *
 * STEJNÝ NEOVĚŘENÝ STAV jako m0/m1/m2: lokální Firestore emulátor na
 * tomhle stroji nejde spustit (viz CURRENT_STATE.md) — napsáno poctivě
 * podle stejné metodiky, ale nikdy skutečně nespuštěno. `npm run
 * test:rules` až na stroji/prostředí, kde emulátor běží.
 */

let testEnv: RulesTestEnvironment

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const IMPORT_JOB_COMMITTED = 'job-committed'
const IMPORT_JOB_ROLLED_BACK = 'job-rolled-back'

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
      uid: 'admin-a',
      role: 'org_admin',
      organizationId: ORG_A,
      displayName: 'Admin A',
      email: 'admin-a@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'ko-a'), {
      uid: 'ko-a',
      role: 'klicova_osoba',
      organizationId: ORG_A,
      displayName: 'KO A',
      email: 'ko-a@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'superadmin-x'), {
      uid: 'superadmin-x',
      role: 'superadmin',
      organizationId: ORG_A,
      displayName: 'Superadmin',
      email: 'super@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'admin-b'), {
      uid: 'admin-b',
      role: 'org_admin',
      organizationId: ORG_B,
      displayName: 'Admin B',
      email: 'admin-b@example.com',
      createdAt: 'seed',
    })

    // Dvě importJobs pod ORG_A — jedna právě dokončená (rollback okno
    // otevřené), druhá už vrácená (rollback okno zavřené, nejde podruhé).
    await setDoc(doc(db, 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED), {
      organizationId: ORG_A,
      method: 'template',
      status: 'committed',
      createdBy: 'admin-a',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'organizations', ORG_A, 'importJobs', IMPORT_JOB_ROLLED_BACK), {
      organizationId: ORG_A,
      method: 'template',
      status: 'rolled_back',
      createdBy: 'admin-a',
      createdAt: 'seed',
    })
  })
})

describe('organizations/{orgId}/importJobs — §5.7 "Import dat"', () => {
  it('org_admin can create an import job in their own org', async () => {
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertSucceeds(
      setDoc(doc(asAdminA.firestore(), 'organizations', ORG_A, 'importJobs', 'new-job'), {
        organizationId: ORG_A,
        method: 'template',
        status: 'reviewing',
        createdBy: 'admin-a',
        createdAt: 'test',
      }),
    )
  })

  it('non-org_admin staff CANNOT create an import job (read-only per §5.7)', async () => {
    const asKoA = testEnv.authenticatedContext('ko-a')
    await assertFails(
      setDoc(doc(asKoA.firestore(), 'organizations', ORG_A, 'importJobs', 'new-job'), {
        organizationId: ORG_A,
        method: 'template',
        status: 'reviewing',
        createdBy: 'ko-a',
        createdAt: 'test',
      }),
    )
  })

  it('non-org_admin staff CAN read the import job history (§5.7: vedení jen historie)', async () => {
    const asKoA = testEnv.authenticatedContext('ko-a')
    await assertSucceeds(
      getDoc(doc(asKoA.firestore(), 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED)),
    )
  })

  it('org_admin CANNOT read or write another org\'s import jobs', async () => {
    const asAdminB = testEnv.authenticatedContext('admin-b')
    await assertFails(
      updateDoc(doc(asAdminB.firestore(), 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED), {
        status: 'rolled_back',
      }),
    )
  })

  it('org_admin can update (confirm/commit) their own org\'s job', async () => {
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertSucceeds(
      updateDoc(doc(asAdminA.firestore(), 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED), {
        status: 'confirmed',
      }),
    )
  })

  it('an import job can never be deleted, even by its own org_admin', async () => {
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertFails(
      deleteDoc(doc(asAdminA.firestore(), 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED)),
    )
  })

  describe('stagingRecords subcollection', () => {
    it('org_admin can write a staging record under their own job', async () => {
      const asAdminA = testEnv.authenticatedContext('admin-a')
      await assertSucceeds(
        setDoc(
          doc(asAdminA.firestore(), 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED, 'stagingRecords', 'r1'),
          {
            rawRow: { a: '1' },
            mappedEntity: { type: 'fosterPerson', fields: { externalFamilyRef: 'R1', firstName: 'A', lastName: 'B' } },
            confidence: 1,
            issues: [],
          },
        ),
      )
    })

    it('non-org_admin staff CANNOT write a staging record, only read it', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED, 'stagingRecords', 'r1'),
          {
            rawRow: { a: '1' },
            mappedEntity: { type: 'fosterPerson', fields: { externalFamilyRef: 'R1', firstName: 'A', lastName: 'B' } },
            confidence: 1,
            issues: [],
          },
        )
      })
      const asKoA = testEnv.authenticatedContext('ko-a')
      await assertSucceeds(
        getDoc(doc(asKoA.firestore(), 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED, 'stagingRecords', 'r1')),
      )
      await assertFails(
        updateDoc(
          doc(asKoA.firestore(), 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED, 'stagingRecords', 'r1'),
          { confidence: 0.1 },
        ),
      )
    })

    it('a DIFFERENT org cannot read staging records', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(
          doc(ctx.firestore(), 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED, 'stagingRecords', 'r1'),
          {
            rawRow: { a: '1' },
            mappedEntity: { type: 'fosterPerson', fields: { externalFamilyRef: 'R1', firstName: 'A', lastName: 'B' } },
            confidence: 1,
            issues: [],
          },
        )
      })
      const asAdminB = testEnv.authenticatedContext('admin-b')
      await assertFails(
        getDoc(doc(asAdminB.firestore(), 'organizations', ORG_A, 'importJobs', IMPORT_JOB_COMMITTED, 'stagingRecords', 'r1')),
      )
    })
  })
})

describe('organizations/{orgId}/backupConfig + backupJobs — §5.7 "Zálohy"', () => {
  it('org_admin can write their own org\'s backup config', async () => {
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertSucceeds(
      setDoc(doc(asAdminA.firestore(), 'organizations', ORG_A, 'backupConfig', 'config'), {
        schedule: { enabled: false },
        destination: { type: 'download' },
        encryption: { method: 'AES-256', keyOwnership: 'organizace' },
      }),
    )
  })

  it('non-org_admin staff CANNOT write backup config, only read it (§5.7: vedení jen stav)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'backupConfig', 'config'), {
        schedule: { enabled: false },
        destination: { type: 'download' },
        encryption: { method: 'AES-256', keyOwnership: 'organizace' },
      })
    })
    const asKoA = testEnv.authenticatedContext('ko-a')
    await assertSucceeds(getDoc(doc(asKoA.firestore(), 'organizations', ORG_A, 'backupConfig', 'config')))
    await assertFails(
      updateDoc(doc(asKoA.firestore(), 'organizations', ORG_A, 'backupConfig', 'config'), {
        schedule: { enabled: true },
      }),
    )
  })

  it('a DIFFERENT org cannot read or write backup config', async () => {
    const asAdminB = testEnv.authenticatedContext('admin-b')
    await assertFails(
      setDoc(doc(asAdminB.firestore(), 'organizations', ORG_A, 'backupConfig', 'config'), {
        schedule: { enabled: false },
        destination: { type: 'download' },
        encryption: { method: 'AES-256', keyOwnership: 'organizace' },
      }),
    )
  })

  it('org_admin can create and update their own org\'s backup job', async () => {
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertSucceeds(
      setDoc(doc(asAdminA.firestore(), 'organizations', ORG_A, 'backupJobs', 'job-1'), {
        triggeredBy: 'manual',
        requestedAt: 'test',
        status: 'running',
        scope: 'full',
        destinationType: 'download',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(asAdminA.firestore(), 'organizations', ORG_A, 'backupJobs', 'job-1'), {
        status: 'completed',
      }),
    )
  })
})

describe('organizations/{orgId}/backupRestoreTests — §5.5 gate', () => {
  it('org_admin CANNOT write a restore-test record for their own org (only superadmin performs/attests it)', async () => {
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertFails(
      setDoc(doc(asAdminA.firestore(), 'organizations', ORG_A, 'backupRestoreTests', 'test-1'), {
        performedAt: 'test',
        performedBy: 'admin-a',
        backupJobRef: 'job-1',
        restoreEnvironment: 'isolated_staging',
        restoreSuccessful: true,
        integrityCheck: { recordCountsMatch: true, sampleRecordsVerified: true },
        measuredDurationMinutes: 5,
      }),
    )
  })

  it('the organization can read its own restore-test records (transparency)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'organizations', ORG_A, 'backupRestoreTests', 'test-1'), {
        performedAt: 'seed',
        performedBy: 'superadmin-x',
        backupJobRef: 'job-1',
        restoreEnvironment: 'isolated_staging',
        restoreSuccessful: true,
        integrityCheck: { recordCountsMatch: true, sampleRecordsVerified: true },
        measuredDurationMinutes: 5,
      })
    })
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertSucceeds(getDoc(doc(asAdminA.firestore(), 'organizations', ORG_A, 'backupRestoreTests', 'test-1')))
  })
})

describe('canRollbackImportEntity — narrow delete exception on families/children (§5.5)', () => {
  it('org_admin CAN delete a family created by a COMMITTED import job of their own org', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'families', 'fam-1'), {
        uid: '9900010000006',
        orgAccessList: [ORG_A],
        fosterPersonRefs: [],
        createdAt: 'seed',
        createdByImportJobRef: IMPORT_JOB_COMMITTED,
      })
    })
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertSucceeds(deleteDoc(doc(asAdminA.firestore(), 'families', 'fam-1')))
  })

  it('org_admin CANNOT delete a family whose import job was ALREADY rolled back once', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'families', 'fam-2'), {
        uid: '9900010000013',
        orgAccessList: [ORG_A],
        fosterPersonRefs: [],
        createdAt: 'seed',
        createdByImportJobRef: IMPORT_JOB_ROLLED_BACK,
      })
    })
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertFails(deleteDoc(doc(asAdminA.firestore(), 'families', 'fam-2')))
  })

  it('org_admin CANNOT delete a MANUALLY created family (no createdByImportJobRef at all)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'families', 'fam-3'), {
        uid: '9900010000020',
        orgAccessList: [ORG_A],
        fosterPersonRefs: [],
        createdAt: 'seed',
      })
    })
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertFails(deleteDoc(doc(asAdminA.firestore(), 'families', 'fam-3')))
  })

  it('a NON-org_admin staff member cannot roll back, even for a committed job in their own org', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'families', 'fam-4'), {
        uid: '9900010000037',
        orgAccessList: [ORG_A],
        fosterPersonRefs: [],
        createdAt: 'seed',
        createdByImportJobRef: IMPORT_JOB_COMMITTED,
      })
    })
    const asKoA = testEnv.authenticatedContext('ko-a')
    await assertFails(deleteDoc(doc(asKoA.firestore(), 'families', 'fam-4')))
  })

  it('org_admin of a DIFFERENT org cannot roll back (own org has no such committed import job)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'families', 'fam-5'), {
        uid: '9900010000044',
        orgAccessList: [ORG_A, ORG_B],
        fosterPersonRefs: [],
        createdAt: 'seed',
        createdByImportJobRef: IMPORT_JOB_COMMITTED,
      })
    })
    const asAdminB = testEnv.authenticatedContext('admin-b')
    await assertFails(deleteDoc(doc(asAdminB.firestore(), 'families', 'fam-5')))
  })

  it('same mechanism applies to children (sameOrg-gated, not orgAccessList)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'children', 'child-1'), {
        uid: '2000010000005',
        familyId: 'fam-1',
        organizationId: ORG_A,
        firstName: 'Malé',
        lastName: 'Dítě',
        birthNumber: '010101/1234',
        createdAt: 'seed',
        createdByImportJobRef: IMPORT_JOB_COMMITTED,
      })
    })
    const asAdminA = testEnv.authenticatedContext('admin-a')
    await assertSucceeds(deleteDoc(doc(asAdminA.firestore(), 'children', 'child-1')))
  })
})
