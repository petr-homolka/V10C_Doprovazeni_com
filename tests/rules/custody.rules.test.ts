import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'

/**
 * PRÁVNÍ ROVINA — rozsudek, svěření, předmět dohody.
 *
 * Tyhle tři kolekce měly od 26. 7. typy i čisté funkce, ale ŽÁDNÁ PRAVIDLA.
 * Bez pravidel je ve Firestore výchozí stav „nikdo nikam", takže se do nich
 * fakticky nedalo zapsat — a jakmile se pravidla dopíšou, je potřeba ohlídat
 * přesně to, kvůli čemu právní rovina vznikla:
 *
 *   1. JEDEN PĚSTOUN, DVĚ ORGANIZACE. Přesně tenhle případ starý model
 *      neuměl. Organizace B nesmí vidět svěření, které vede A — jinak by
 *      se s oddělováním nebylo potřeba vůbec obtěžovat.
 *   2. PŘÍSTUP SE JEN ROZŠIŘUJE. Kdyby šel `orgAccessList` přepsat, mohla
 *      by si druhá organizace z dokumentu tu první vyškrtnout.
 *   3. NIC SE NEMAŽE. Rozsudek je právní titul; smazat ho nesmí ani
 *      superadmin, protože pak by se nedalo dohledat, o co se péče opírala.
 */

let testEnv: RulesTestEnvironment

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const DECISION = 'decision-1'
const ASSIGNMENT = 'assignment-1'
const SUBJECT = 'subject-1'

function decision(over: Record<string, unknown> = {}) {
  return {
    orgAccessList: [ORG_A],
    fileNumber: '12 P 45/2023',
    courtName: 'Okresní soud v Kolíně',
    effectiveFrom: '2023-05-01T00:00:00.000Z',
    kind: 'sverenido_pp',
    createdAt: '2026-07-27T10:00:00.000Z',
    createdByOrgId: ORG_A,
    createdByUid: 'ko-a',
    ...over,
  }
}

function assignment(over: Record<string, unknown> = {}) {
  return {
    id: ASSIGNMENT,
    orgAccessList: [ORG_A],
    courtDecisionId: DECISION,
    childId: 'child-1',
    fosterPersonIds: ['foster-1'],
    form: 'vyhradni',
    validFrom: '2023-05-01T00:00:00.000Z',
    validTo: null,
    status: 'aktivni',
    createdAt: '2026-07-27T10:00:00.000Z',
    createdByOrgId: ORG_A,
    ...over,
  }
}

function subject(over: Record<string, unknown> = {}) {
  return {
    organizationId: ORG_A,
    agreementId: 'agreement-1',
    custodyAssignmentId: ASSIGNMENT,
    fosterPersonId: 'foster-1',
    validFrom: '2026-01-01T00:00:00.000Z',
    validTo: null,
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

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'courtDecisions', DECISION), decision())
    await setDoc(doc(db, 'custodyAssignments', ASSIGNMENT), assignment())
    await setDoc(doc(db, 'agreementSubjects', SUBJECT), subject())
  })
}

describe('courtDecisions — rozhodnutí soudu', () => {
  it('organizace v seznamu rozsudek přečte', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(getDoc(doc(db, 'courtDecisions', DECISION)))
  })

  it('cizí organizace rozsudek nepřečte', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-b').firestore()
    await assertFails(getDoc(doc(db, 'courtDecisions', DECISION)))
  })

  it('pěstoun rozsudek nepřečte — právní rovina je pracovní nástroj organizace', async () => {
    await seed()
    const db = testEnv.authenticatedContext('foster-a').firestore()
    await assertFails(getDoc(doc(db, 'courtDecisions', DECISION)))
  })

  it('zaměstnanec rozsudek založí — ale jen se svou organizací v seznamu', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(setDoc(doc(db, 'courtDecisions', 'nove'), decision()))
  })

  /** Zakládat rovnou s cizí organizací v seznamu = přihrát si přístup k cizím datům. */
  it('rozsudek NEJDE založit s cizí organizací v seznamu', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(db, 'courtDecisions', 'nove'), decision({ orgAccessList: [ORG_A, ORG_B] })))
  })

  it('seznam přístupů se smí jen rozšířit', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(updateDoc(doc(db, 'courtDecisions', DECISION), { orgAccessList: [ORG_A, ORG_B] }))
  })

  /** Bez tohohle by si organizace B vyškrtla A a převzala rozsudek pro sebe. */
  it('ze seznamu přístupů NEJDE nikoho odebrat', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'courtDecisions', DECISION), decision({ orgAccessList: [ORG_A, ORG_B] }))
    })
    const db = testEnv.authenticatedContext('ko-b').firestore()
    await assertFails(updateDoc(doc(db, 'courtDecisions', DECISION), { orgAccessList: [ORG_B] }))
  })

  it('rozsudek nesmaže ani superadmin', async () => {
    await seed()
    const su = testEnv.authenticatedContext('super').firestore()
    await assertFails(deleteDoc(doc(su, 'courtDecisions', DECISION)))
  })
})

describe('custodyAssignments — svěření péče', () => {
  it('organizace v seznamu svěření přečte', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(getDoc(doc(db, 'custodyAssignments', ASSIGNMENT)))
  })

  /**
   * TOHLE JE TA VĚC, KVŮLI KTERÉ PRÁVNÍ ROVINA VZNIKLA. Jeden pěstoun může
   * mít děti ze dvou rozsudků a ke každému jinou doprovázející organizaci;
   * druhá organizace nesmí vidět dítě, ke kterému nemá žádný vztah.
   */
  it('cizí organizace svěření nepřečte', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-b').firestore()
    await assertFails(getDoc(doc(db, 'custodyAssignments', ASSIGNMENT)))
  })

  it('zaměstnanec svěření založí', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(setDoc(doc(db, 'custodyAssignments', 'nove'), assignment({ id: 'nove' })))
  })

  /** `id` uvnitř dokumentu se používá při práci s polem bez snapshotů — musí sedět. */
  it('id v dokumentu musí sedět s document ID', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(db, 'custodyAssignments', 'nove'), assignment({ id: 'neco-jineho' })))
  })

  it('svěření NEJDE založit s cizí organizací v seznamu', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(
      setDoc(doc(db, 'custodyAssignments', 'nove'), assignment({ id: 'nove', orgAccessList: [ORG_A, ORG_B] })),
    )
  })

  it('držící organizace svěření ukončí', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'custodyAssignments', ASSIGNMENT), {
        status: 'ukonceno',
        validTo: '2026-07-27T00:00:00.000Z',
      }),
    )
  })

  it('cizí organizace svěření neukončí', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-b').firestore()
    await assertFails(
      updateDoc(doc(db, 'custodyAssignments', ASSIGNMENT), { status: 'ukonceno', validTo: '2026-07-27T00:00:00.000Z' }),
    )
  })

  it('svěření se předá další organizaci rozšířením seznamu', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'custodyAssignments', ASSIGNMENT), { orgAccessList: [ORG_A, ORG_B] }),
    )
  })

  it('svěření se nemaže — historie péče musí zůstat čitelná', async () => {
    await seed()
    const su = testEnv.authenticatedContext('super').firestore()
    await assertFails(deleteDoc(doc(su, 'custodyAssignments', ASSIGNMENT)))
  })
})

/**
 * Dotazy PŘESNĚ TAK, JAK JE POSÍLÁ APLIKACE.
 *
 * Ve Firestore je `list` jiná operace než `get`: pravidlo se vyhodnocuje nad
 * DOTAZEM, ne nad výsledkem, a povolí ho jen tehdy, když dotaz sám zaručuje,
 * že nevrátí nic zakázaného. Testy výš čtou jednotlivé dokumenty a takovou
 * chybu by nezachytily — projevila by se až v produkci prázdnou obrazovkou.
 */
describe('dotazy, které aplikace opravdu posílá', () => {
  it('listAssignmentsForChild projde', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'custodyAssignments'),
          where('childId', '==', 'child-1'),
          where('orgAccessList', 'array-contains', ORG_A),
        ),
      ),
    )
  })

  /** Bez filtru na `orgAccessList` by dotaz sáhl i na cizí svěření. */
  it('týž dotaz BEZ filtru na organizaci neprojde', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(
      getDocs(query(collection(db, 'custodyAssignments'), where('childId', '==', 'child-1'))),
    )
  })

  /**
   * `listAssignmentsForFoster` se ptá na ORGANIZACI a pěstouna filtruje až
   * v paměti. Původně to bylo obráceně a tenhle test to odhalil: dotaz nad
   * `fosterPersonIds` pravidla NEPUSTÍ, protože nedokazuje oprávnění — a to
   * ani tehdy, když všechny nalezené dokumenty té organizaci patří.
   */
  it('listAssignmentsForFoster projde (pěstoun se filtruje až v paměti)', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(
      getDocs(
        query(collection(db, 'custodyAssignments'), where('orgAccessList', 'array-contains', ORG_A)),
      ),
    )
  })

  it('dotaz nad fosterPersonIds pravidla NEPUSTÍ — proto se filtruje v paměti', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(
      getDocs(
        query(collection(db, 'custodyAssignments'), where('fosterPersonIds', 'array-contains', 'foster-1')),
      ),
    )
  })

  it('listSubjectsForAgreement projde', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'agreementSubjects'),
          where('agreementId', '==', 'agreement-1'),
          where('organizationId', '==', ORG_A),
        ),
      ),
    )
  })

  it('předměty cizí organizace se vylistovat nedají', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-b').firestore()
    await assertFails(
      getDocs(
        query(
          collection(db, 'agreementSubjects'),
          where('agreementId', '==', 'agreement-1'),
          where('organizationId', '==', ORG_A),
        ),
      ),
    )
  })
})

describe('agreementSubjects — předmět dohody', () => {
  it('vlastní organizace předmět přečte', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(getDoc(doc(db, 'agreementSubjects', SUBJECT)))
  })

  it('cizí organizace předmět nepřečte', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-b').firestore()
    await assertFails(getDoc(doc(db, 'agreementSubjects', SUBJECT)))
  })

  it('zaměstnanec předmět založí pod svou organizací', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(setDoc(doc(db, 'agreementSubjects', 'novy'), subject()))
  })

  it('předmět NEJDE založit pod cizí organizací', async () => {
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertFails(setDoc(doc(db, 'agreementSubjects', 'novy'), subject({ organizationId: ORG_B })))
  })

  /**
   * Předmět končí spolu s Dohodou — ukončení je `validTo`, ne smazání.
   * Kdyby se mazal, zmizela by informace, co Dohoda vlastně pokrývala,
   * a vykázané aktivity by visely ve vzduchu.
   */
  it('předmět se nemaže, jen ukončuje', async () => {
    await seed()
    const db = testEnv.authenticatedContext('ko-a').firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'agreementSubjects', SUBJECT), { validTo: '2026-12-31T00:00:00.000Z' }),
    )
    await assertFails(deleteDoc(doc(db, 'agreementSubjects', SUBJECT)))
  })

  it('pěstoun do předmětů dohody nevidí ani nezapíše', async () => {
    await seed()
    const db = testEnv.authenticatedContext('foster-a').firestore()
    await assertFails(getDoc(doc(db, 'agreementSubjects', SUBJECT)))
    await assertFails(setDoc(doc(db, 'agreementSubjects', 'novy'), subject()))
  })
})
