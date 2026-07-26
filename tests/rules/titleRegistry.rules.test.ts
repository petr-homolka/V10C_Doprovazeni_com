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
 * titleRegistry/{uid} — rejstřík obsazených UID.
 *
 * Rejstřík existuje kvůli jedinému pravidlu z metodiky MPSV: osoba pečující
 * smí mít v daném čase jen jeden právní titul. Tenhle soubor testuje dvě
 * věci, které to pravidlo drží pohromadě —
 *
 *   1. ORGANIZACE SI NEPŘETÁHNE CIZÍ OTEVŘENÝ TITUL. Kdyby ano, byla by
 *      blokace k ničemu: stačilo by přepsat záznam a jít dál.
 *   2. REJSTŘÍK SE NEDÁ VYLISTOVAT. Čte ho i organizace bez jakéhokoli
 *      vztahu k té osobě (o to jde), takže musí být zaručené, že se z něj
 *      nedá stáhnout přehled cizích případů.
 */

let testEnv: RulesTestEnvironment

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const UID = '1000000001'

function entry(over: Record<string, unknown> = {}) {
  return {
    uid: UID,
    holderOrgId: ORG_A,
    externalSubjectName: null,
    validFrom: '2026-01-01T00:00:00.000Z',
    validTo: null,
    updatedAt: '2026-07-26T10:00:00.000Z',
    updatedByOrgId: ORG_A,
    ...over,
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
    await setDoc(doc(db, 'users', 'ko-b'), {
      ...base, uid: 'ko-b', role: 'klicova_osoba', organizationId: ORG_B, displayName: 'KO B', email: 'ko-b@example.com',
    })
    await setDoc(doc(db, 'users', 'super'), {
      ...base, uid: 'super', role: 'superadmin', organizationId: ORG_A, displayName: 'Super', email: 's@example.com',
    })
    await setDoc(doc(db, 'users', 'foster-a'), {
      ...base, uid: 'foster-a', role: 'pestoun', organizationId: ORG_A, displayName: 'Pěstoun', email: 'p@example.com',
    })
  })
})

async function seedEntry(over: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'titleRegistry', UID), entry(over))
  })
}

describe('čtení', () => {
  /** Tohle JE ta funkce: ptá se organizace, která k té osobě zatím nic nemá. */
  it('cizí organizace se smí zeptat, jestli je UID obsazené', async () => {
    await seedEntry()
    const db = testEnv.authenticatedContext('ko-b').firestore()
    await assertSucceeds(getDoc(doc(db, 'titleRegistry', UID)))
  })

  it('pěstoun do rejstříku nevidí', async () => {
    await seedEntry()
    const db = testEnv.authenticatedContext('foster-a').firestore()
    await assertFails(getDoc(doc(db, 'titleRegistry', UID)))
  })

  it('nepřihlášený do rejstříku nevidí', async () => {
    await seedEntry()
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'titleRegistry', UID)))
  })

  /**
   * Bez tohohle by šel rejstřík stáhnout celý a z něj odvodit, kolik
   * případů která organizace vede.
   */
  it('CELÝ rejstřík vylistovat NEJDE — ani zaměstnanci', async () => {
    await seedEntry()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(getDocs(collection(db, 'titleRegistry')))
  })
})

describe('zápis', () => {
  it('první organizace UID zabere', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(setDoc(doc(db, 'titleRegistry', UID), entry()))
  })

  it('nejde zabrat jménem cizí organizace', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(db, 'titleRegistry', UID), entry({ updatedByOrgId: ORG_B })))
  })

  it('document ID musí sedět s uid v dokumentu', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(db, 'titleRegistry', UID), entry({ uid: '9999999999' })))
  })

  it('držitel si svůj záznam upravit smí — třeba doplnit konec', async () => {
    await seedEntry()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(
      setDoc(doc(db, 'titleRegistry', UID), entry({ validTo: '2026-12-31T00:00:00.000Z' })),
    )
  })

  /** NEJDŮLEŽITĚJŠÍ TEST SOUBORU. Bez něj je celá blokace jen kosmetika. */
  it('cizí organizace NESMÍ přepsat běžící titul', async () => {
    await seedEntry()
    const db = testEnv.authenticatedContext('ko-b').firestore()
    await assertFails(
      setDoc(doc(db, 'titleRegistry', UID), entry({ holderOrgId: ORG_B, updatedByOrgId: ORG_B })),
    )
  })

  it('po ukončení titulu si UID vezme kdokoli — to je legální přechod', async () => {
    await seedEntry({ validTo: '2026-06-30T00:00:00.000Z' })
    const db = testEnv.authenticatedContext('ko-b').firestore()
    await assertSucceeds(
      setDoc(
        doc(db, 'titleRegistry', UID),
        entry({ holderOrgId: ORG_B, updatedByOrgId: ORG_B, validFrom: '2026-07-01T00:00:00.000Z', validTo: null }),
      ),
    )
  })

  it('doprovázení mimo systém (OSPOD) blokuje přepis stejně', async () => {
    await seedEntry({ holderOrgId: null, externalSubjectName: 'OSPOD Praha 4' })
    const db = testEnv.authenticatedContext('ko-b').firestore()
    await assertFails(
      setDoc(doc(db, 'titleRegistry', UID), entry({ holderOrgId: ORG_B, updatedByOrgId: ORG_B })),
    )
  })

  it('smazat záznam smí jen superadmin', async () => {
    await seedEntry()
    const staff = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(deleteDoc(doc(staff, 'titleRegistry', UID)))
    const su = testEnv.authenticatedContext('super').firestore()
    await assertSucceeds(deleteDoc(doc(su, 'titleRegistry', UID)))
  })

  it('pěstoun do rejstříku nezapíše', async () => {
    const db = testEnv.authenticatedContext('foster-a').firestore()
    await assertFails(setDoc(doc(db, 'titleRegistry', UID), entry({ updatedByOrgId: ORG_A })))
  })
})
