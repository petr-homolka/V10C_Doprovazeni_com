import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'

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
    await setDoc(doc(db, 'users', 'ko-blocked'), {
      ...base, uid: 'ko-blocked', role: 'klicova_osoba', organizationId: ORG_A,
      displayName: 'Zablokovaná KO', email: 'z@example.com', disabledAt: '2026-07-26T10:00:00.000Z',
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

/**
 * uidHolderCard — jediná kolekce, kde osobní údaj překračuje hranici
 * organizace. Testuje se hlavně to, že se nedá vytěžit hromadně: bez
 * `list` musí útočník znát konkrétní UID.
 */
describe('uidHolderCard — ověřovací karta k UID', () => {
  const UID = '1000000001'
  const holderCard = {
    uid: UID,
    firstName: 'Jana',
    lastName: 'Nováková',
    municipality: 'Kolín',
    holderOrgId: ORG_A,
    updatedAt: '2026-07-26T10:00:00.000Z',
  }

  async function seedHolder() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'uidHolderCard', UID), holderCard)
    })
  }

  it('cizí organizace kartu přečte — na tom stojí ověření opsaného UID', async () => {
    await seedHolder()
    const db = testEnv.authenticatedContext('admin-b').firestore()
    await assertSucceeds(getDoc(doc(db, 'uidHolderCard', UID)))
  })

  /** Bez tohohle by šel stáhnout jmenný seznam všech vedených osob. */
  it('hromadně se karty stáhnout NEDAJÍ', async () => {
    await seedHolder()
    const db = testEnv.authenticatedContext('admin-b').firestore()
    await assertFails(getDocs(collection(db, 'uidHolderCard')))
  })

  it('pěstoun ani nepřihlášený na kartu nedosáhne', async () => {
    await seedHolder()
    await assertFails(getDoc(doc(testEnv.authenticatedContext('foster-a').firestore(), 'uidHolderCard', UID)))
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'uidHolderCard', UID)))
  })

  it('kartu zapíše jen organizace, která osobu vede', async () => {
    const own = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(setDoc(doc(own, 'uidHolderCard', UID), holderCard))

    const foreign = testEnv.authenticatedContext('ko-b').firestore()
    await assertFails(setDoc(doc(foreign, 'uidHolderCard', UID), holderCard))
  })

  it('mazat smí jen superadmin', async () => {
    await seedHolder()
    await assertFails(deleteDoc(doc(testEnv.authenticatedContext('ko-a').firestore(), 'uidHolderCard', UID)))
    await assertSucceeds(deleteDoc(doc(testEnv.authenticatedContext('super').firestore(), 'uidHolderCard', UID)))
  })
})

/**
 * ZABLOKOVANÝ ÚČET. Do 26. 7. se `disabledAt` sice zapisovalo a zobrazovalo,
 * ale pravidla ho nečetla — zablokovaný člověk jen zmizel ze seznamu a jeho
 * přihlášení mělo dál plný přístup. Tyhle testy hlídají, aby se to nevrátilo.
 */
describe('zablokovaný účet', () => {
  const UID = '1000000001'

  it('nedostane se k vizitce ani k rejstříku', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'orgDirectory', ORG_A), card())
      await setDoc(doc(ctx.firestore(), 'personIndex', HASH), indexEntry())
    })
    const db = testEnv.authenticatedContext('ko-blocked').firestore()
    await assertFails(getDoc(doc(db, 'orgDirectory', ORG_A)))
    await assertFails(getDoc(doc(db, 'personIndex', HASH)))
  })

  it('nedostane se ani k ověřovací kartě', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'uidHolderCard', HASH), {
        uid: UID, firstName: 'Jana', lastName: 'Nováková', municipality: 'Kolín',
        holderOrgId: ORG_A, updatedAt: '2026-07-26T10:00:00.000Z',
      })
    })
    const db = testEnv.authenticatedContext('ko-blocked').firestore()
    await assertFails(getDoc(doc(db, 'uidHolderCard', HASH)))
  })

  it('nic nezapíše', async () => {
    const db = testEnv.authenticatedContext('ko-blocked').firestore()
    await assertFails(setDoc(doc(db, 'personIndex', HASH), indexEntry()))
  })

  /** Kdyby šlo, každý automaticky zablokovaný účet se hned odemkne. */
  it('SÁM SE NEODEMKNE', async () => {
    const db = testEnv.authenticatedContext('ko-blocked').firestore()
    await assertFails(updateDoc(doc(db, 'users', 'ko-blocked'), { disabledAt: null }))
  })
})

describe('sebezablokování při překročení limitu', () => {
  it('účet si smí sám zapsat disabledAt', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(updateDoc(doc(db, 'users', 'ko-a'), { disabledAt: '2026-07-26T12:00:00.000Z' }))
  })

  it('ale nesmí u toho měnit nic jiného — třeba si zvýšit roli', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(
      updateDoc(doc(db, 'users', 'ko-a'), { disabledAt: '2026-07-26T12:00:00.000Z', role: 'org_admin' }),
    )
  })

  it('a nesmí zablokovat kolegu', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(updateDoc(doc(db, 'users', 'admin-a'), { disabledAt: '2026-07-26T12:00:00.000Z' }))
  })

  it('počítadlo si vede každý své a do cizího nevidí', async () => {
    const own = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(
      setDoc(doc(own, 'lookupQuota', 'ko-a'), { userUid: 'ko-a', day: '2026-07-26', count: 1 }),
    )
    await assertFails(
      setDoc(doc(own, 'lookupQuota', 'ko-b'), { userUid: 'ko-b', day: '2026-07-26', count: 1 }),
    )
    const other = testEnv.authenticatedContext('admin-b').firestore()
    await assertFails(getDoc(doc(other, 'lookupQuota', 'ko-a')))
  })
})
