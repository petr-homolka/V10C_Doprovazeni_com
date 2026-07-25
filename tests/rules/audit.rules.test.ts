import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

type TestFirestore = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>

/**
 * organizations/{orgId}/auditLog — auditní stopa.
 *
 * Tenhle soubor testuje JEDNU věc, ale tu pořádně: že se log nedá obejít.
 * Zapsat záznam smí každý zaměstnanec (jinak by ho aplikace nemohla psát
 * při běžné práci), ale nikdo — ani superadmin — ho nesmí přepsat, smazat,
 * antedatovat ani podepsat cizím jménem. Kdyby kterýkoli z těch testů
 * začal procházet obráceně, log ztrácí smysl jako důkaz.
 */

let testEnv: RulesTestEnvironment

const ORG_A = 'org-a'
const ORG_B = 'org-b'

function auditRef(db: TestFirestore, orgId: string) {
  return collection(db, 'organizations', orgId, 'auditLog')
}

/** Platný záznam. Testy z něj dělají varianty přes `{ ...validEntry(), … }`. */
function validEntry(actorUid = 'ko-a', organizationId = ORG_A) {
  return {
    organizationId,
    action: 'document_sent_authority',
    category: 'disclosure',
    actorUid,
    actorName: 'KO A',
    actorRole: 'klicova_osoba',
    at: '2026-07-25T10:00:00.000Z',
    serverAt: serverTimestamp(),
    detail: 'Odesláno na OSPOD',
  }
}

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
    const base = { createdAt: 'seed' }
    await setDoc(doc(db, 'users', 'ko-a'), {
      ...base, uid: 'ko-a', role: 'klicova_osoba', organizationId: ORG_A, displayName: 'KO A', email: 'ko-a@example.com',
    })
    await setDoc(doc(db, 'users', 'admin-a'), {
      ...base, uid: 'admin-a', role: 'org_admin', organizationId: ORG_A, displayName: 'Admin A', email: 'a@example.com',
    })
    await setDoc(doc(db, 'users', 'tl-a'), {
      ...base, uid: 'tl-a', role: 'teamleader', organizationId: ORG_A, displayName: 'TL A', email: 'tl-a@example.com',
    })
    await setDoc(doc(db, 'users', 'admin-b'), {
      ...base, uid: 'admin-b', role: 'org_admin', organizationId: ORG_B, displayName: 'Admin B', email: 'b@example.com',
    })
    await setDoc(doc(db, 'users', 'super'), {
      ...base, uid: 'super', role: 'superadmin', organizationId: ORG_A, displayName: 'Super', email: 's@example.com',
    })
    await setDoc(doc(db, 'users', 'foster-a'), {
      ...base, uid: 'foster-a', role: 'pestoun', organizationId: ORG_A, displayName: 'Pěstoun', email: 'p@example.com',
    })
  })
})

describe('auditLog — zápis', () => {
  it('zaměstnanec smí zapsat záznam za sebe', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(setDoc(doc(auditRef(db, ORG_A), 'e1'), validEntry()))
  })

  it('zaměstnanec NESMÍ zapsat záznam pod cizím uid', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(auditRef(db, ORG_A), 'e2'), validEntry('admin-a')))
  })

  it('NESMÍ si antedatovat čas — serverAt musí být request.time', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(
      setDoc(doc(auditRef(db, ORG_A), 'e3'), {
        ...validEntry(),
        serverAt: new Date('2020-01-01T00:00:00.000Z'),
      }),
    )
  })

  it('NESMÍ zapsat do cizí organizace', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(auditRef(db, ORG_B), 'e4'), validEntry('ko-a', ORG_B)))
  })

  it('NESMÍ zapsat záznam, jehož organizationId neodpovídá cestě', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(auditRef(db, ORG_A), 'e5'), { ...validEntry(), organizationId: ORG_B }))
  })

  it('pěstoun NESMÍ zapisovat do auditu', async () => {
    const db = testEnv.authenticatedContext('foster-a').firestore()
    await assertFails(setDoc(doc(auditRef(db, ORG_A), 'e6'), validEntry('foster-a')))
  })

  it('nepřihlášený NESMÍ zapisovat', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(auditRef(db, ORG_A), 'e7'), validEntry()))
  })
})

describe('auditLog — nesmazatelnost', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(auditRef(ctx.firestore(), ORG_A), 'existing'), {
        ...validEntry(),
        serverAt: new Date('2026-07-25T10:00:00.000Z'),
      })
    })
  })

  it('autor NESMÍ svůj vlastní záznam upravit', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(updateDoc(doc(auditRef(db, ORG_A), 'existing'), { detail: 'jinak' }))
  })

  it('autor NESMÍ svůj vlastní záznam smazat', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(deleteDoc(doc(auditRef(db, ORG_A), 'existing')))
  })

  it('správce organizace NESMÍ záznam smazat', async () => {
    const db = testEnv.authenticatedContext('admin-a').firestore()
    await assertFails(deleteDoc(doc(auditRef(db, ORG_A), 'existing')))
  })

  it('ani SUPERADMIN nesmí záznam smazat ani přepsat', async () => {
    const db = testEnv.authenticatedContext('super').firestore()
    await assertFails(deleteDoc(doc(auditRef(db, ORG_A), 'existing')))
    await assertFails(updateDoc(doc(auditRef(db, ORG_A), 'existing'), { actorUid: 'nekdo-jiny' }))
  })

  it('přepis přes setDoc na stejné id NEPROJDE (bylo by to skryté mazání)', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(auditRef(db, ORG_A), 'existing'), validEntry()))
  })
})

describe('auditLog — čtení', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(auditRef(ctx.firestore(), ORG_A), 'existing'), {
        ...validEntry(),
        serverAt: new Date('2026-07-25T10:00:00.000Z'),
      })
    })
  })

  it('správce organizace čte', async () => {
    const db = testEnv.authenticatedContext('admin-a').firestore()
    await assertSucceeds(getDocs(auditRef(db, ORG_A)))
  })

  it('vedení (teamleader) čte', async () => {
    const db = testEnv.authenticatedContext('tl-a').firestore()
    await assertSucceeds(getDocs(auditRef(db, ORG_A)))
  })

  it('klíčová osoba NEČTE — log je nástroj kontroly nad ní', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(getDocs(auditRef(db, ORG_A)))
  })

  it('cizí organizace NEČTE', async () => {
    const db = testEnv.authenticatedContext('admin-b').firestore()
    await assertFails(getDocs(auditRef(db, ORG_A)))
  })
})
