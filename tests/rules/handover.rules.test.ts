import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'

/**
 * orgDirectory a personIndex — dvě kolekce, na kterých stojí předání
 * pěstouna mezi organizacemi.
 *
 * Obě jsou čitelné napříč organizacemi, což je v týhle appce výjimka —
 * proto se u obou testuje hlavně to, CO SE Z NICH NEDÁ VYTĚŽIT:
 * vylistovat celý seznam organizací ani celý index osob.
 */

let testEnv: RulesTestEnvironment

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const HASH = 'a'.repeat(64)

function card(over: Record<string, unknown> = {}) {
  return {
    organizationId: ORG_A,
    name: 'Doprovázení Jih, z. ú.',
    contactPersonName: 'Jana Nováková',
    phone: '+420 777 111 222',
    email: 'vedeni@jih.example',
    updatedAt: '2026-07-26T10:00:00.000Z',
    updatedByUid: 'admin-a',
    ...over,
  }
}

function indexEntry(over: Record<string, unknown> = {}) {
  return {
    uid: '1000000001',
    kind: 'rodne_cislo',
    createdAt: '2026-07-26T10:00:00.000Z',
    createdByOrgId: ORG_A,
    ...over,
  }
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-doprovazeni',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
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
    await setDoc(doc(db, 'users', 'admin-a'), {
      ...base, uid: 'admin-a', role: 'org_admin', organizationId: ORG_A, displayName: 'Admin A', email: 'a@example.com',
    })
    await setDoc(doc(db, 'users', 'ko-a'), {
      ...base, uid: 'ko-a', role: 'klicova_osoba', organizationId: ORG_A, displayName: 'KO A', email: 'k@example.com',
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

describe('orgDirectory — vizitka organizace', () => {
  /** Tohle je celý smysl kolekce: cizí organizace musí mít kam zavolat. */
  it('cizí organizace vizitku PŘEČTE', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orgDirectory', ORG_A), card())
    })
    const db = testEnv.authenticatedContext('admin-b').firestore()
    await assertSucceeds(getDoc(doc(db, 'orgDirectory', ORG_A)))
  })

  it('seznam organizací se stáhnout NEDÁ', async () => {
    const db = testEnv.authenticatedContext('admin-b').firestore()
    await assertFails(getDocs(collection(db, 'orgDirectory')))
  })

  it('pěstoun do adresáře nevidí', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orgDirectory', ORG_A), card())
    })
    const db = testEnv.authenticatedContext('foster-a').firestore()
    await assertFails(getDoc(doc(db, 'orgDirectory', ORG_A)))
  })

  it('org_admin svou vizitku napíše', async () => {
    const db = testEnv.authenticatedContext('admin-a').firestore()
    await assertSucceeds(setDoc(doc(db, 'orgDirectory', ORG_A), card()))
  })

  /** Vizitka je vyjádření organizace o sobě, ne provozní údaj. */
  it('klíčová osoba vizitku nemění', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(db, 'orgDirectory', ORG_A), card()))
  })

  it('nikdo nenapíše vizitku cizí organizaci', async () => {
    const db = testEnv.authenticatedContext('admin-b').firestore()
    await assertFails(setDoc(doc(db, 'orgDirectory', ORG_A), card()))
  })
})

describe('personIndex — vyhledávací otisky', () => {
  it('cizí organizace se smí zeptat na konkrétní otisk', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'personIndex', HASH), indexEntry())
    })
    const db = testEnv.authenticatedContext('admin-b').firestore()
    await assertSucceeds(getDoc(doc(db, 'personIndex', HASH)))
  })

  /**
   * NEJDŮLEŽITĚJŠÍ TEST. Vylistovaný index = seznam všech osob, které
   * systém vede, spárovatelný s čímkoli dalším.
   */
  it('celý index stáhnout NEJDE', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(getDocs(collection(db, 'personIndex')))
  })

  it('pěstoun do indexu nevidí', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'personIndex', HASH), indexEntry())
    })
    const db = testEnv.authenticatedContext('foster-a').firestore()
    await assertFails(getDoc(doc(db, 'personIndex', HASH)))
  })

  it('zaměstnanec otisk založí', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(setDoc(doc(db, 'personIndex', HASH), indexEntry()))
  })

  it('nejde založit jménem cizí organizace', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(db, 'personIndex', HASH), indexEntry({ createdByOrgId: ORG_B })))
  })

  /** Smazaný otisk = osoba se přestane nacházet a jde založit podruhé. */
  it('mazat smí jen superadmin', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'personIndex', HASH), indexEntry())
    })
    const staff = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(deleteDoc(doc(staff, 'personIndex', HASH)))
    const su = testEnv.authenticatedContext('super').firestore()
    await assertSucceeds(deleteDoc(doc(su, 'personIndex', HASH)))
  })
})
