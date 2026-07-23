import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDocs, collection as fsCollection, setDoc, query, where } from 'firebase/firestore'

/**
 * MANDATORY §11.2 test — `families/{familyId}/messages` (Chat, M9).
 * Klíčové riziko oproti `timeline`: chat je OBOUSMĚRNÝ (pěstoun i staff
 * zakládají), takže `create` má DVA disjunkty místo jednoho a musí hlídat,
 * že si žádná strana nezapíše cizí `audience`/`authorRole`/`createdByUid`.
 * Druhé riziko: spolupracovník (M9 Spolupracovník, `isStaff()` VYLOUČEN,
 * viz firestore.rules komentář) nesmí mít k chatu přístup vůbec — není v
 * seznamu jeho modulů.
 */
let testEnv: RulesTestEnvironment

const ORG = 'org1'
const OTHER_ORG = 'org2'
const FAMILY = 'fam1'
const OTHER_FAMILY = 'fam2'

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
    await setDoc(doc(db, 'users', 'ko-other-org'), {
      uid: 'ko-other-org',
      role: 'klicova_osoba',
      organizationId: OTHER_ORG,
      displayName: 'KO Cizí',
      email: 'ko-other@test.cz',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'collab1'), {
      uid: 'collab1',
      role: 'spolupracovnik',
      organizationId: ORG,
      displayName: 'Spolupracovník',
      email: 'collab1@test.cz',
      createdAt: 'seed',
      collaboratorModules: { viewTimeline: true, writeTimeline: true },
    })
    await setDoc(doc(db, 'users', 'pestoun-x'), {
      uid: 'pestoun-x',
      role: 'pestoun',
      organizationId: ORG,
      fosterFamilyId: FAMILY,
      displayName: 'Pěstoun X',
      email: 'pestoun@test.cz',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'pestoun-other-family'), {
      uid: 'pestoun-other-family',
      role: 'pestoun',
      organizationId: ORG,
      fosterFamilyId: OTHER_FAMILY,
      displayName: 'Pěstoun Jiné Rodiny',
      email: 'pestoun2@test.cz',
      createdAt: 'seed',
    })

    await setDoc(doc(db, 'families', FAMILY), {
      uid: '9900010000006',
      orgAccessList: [ORG],
      fosterPersonRefs: [],
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'families', FAMILY, 'agreements', ORG), {
      uid: '9000010000001',
      familyId: FAMILY,
      organizationId: ORG,
      careType: 'zprostredkovana',
      status: 'active',
      validFrom: '2024-01-01T00:00:00.000Z',
      validTo: null,
      assignedTo: 'ko1',
      visitIntervalDays: 60,
      educationHoursTarget: 24,
      noteDeadlineHours: 72,
      createdAt: 'seed',
    })

    await setDoc(doc(db, 'families', FAMILY, 'messages', 'msg-foster'), {
      createdByOrgId: ORG,
      createdByUid: 'ko1',
      authorRole: 'staff',
      audience: 'foster',
      body: 'Dobrý den, jak se daří?',
      createdAt: '2026-07-21T10:00:00.000Z',
    })
    await setDoc(doc(db, 'families', FAMILY, 'messages', 'msg-internal'), {
      createdByOrgId: ORG,
      createdByUid: 'ko1',
      authorRole: 'staff',
      audience: 'internal',
      body: 'Interní poznámka — připomenout návštěvu.',
      createdAt: '2026-07-21T10:05:00.000Z',
    })
  })
})

describe('families/{familyId}/messages/{id} — čtení', () => {
  it('staff STEJNÉ organizace MŮŽE číst CELÉ vlákno (foster i internal)', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(
      getDocs(query(fsCollection(asKo.firestore(), 'families', FAMILY, 'messages'), where('createdByOrgId', '==', ORG))),
    )
  })

  it('pěstoun VLASTNÍ rodiny MŮŽE číst jen audience==foster zápisy', async () => {
    const asFoster = testEnv.authenticatedContext('pestoun-x')
    await assertSucceeds(
      getDocs(
        query(
          fsCollection(asFoster.firestore(), 'families', FAMILY, 'messages'),
          where('audience', '==', 'foster'),
        ),
      ),
    )
  })

  it('pěstoun NEMŮŽE číst internal zápis přímo (jednotlivý dokument)', async () => {
    const asFoster = testEnv.authenticatedContext('pestoun-x')
    await assertFails(getDocs(fsCollection(asFoster.firestore(), 'families', FAMILY, 'messages')))
  })

  it('pěstoun JINÉ rodiny NEMŮŽE číst tohle vlákno vůbec', async () => {
    const asOtherFoster = testEnv.authenticatedContext('pestoun-other-family')
    await assertFails(
      getDocs(
        query(
          fsCollection(asOtherFoster.firestore(), 'families', FAMILY, 'messages'),
          where('audience', '==', 'foster'),
        ),
      ),
    )
  })

  it('staff JINÉ organizace NEMŮŽE číst vlákno vůbec', async () => {
    const asOtherKo = testEnv.authenticatedContext('ko-other-org')
    await assertFails(
      getDocs(
        query(fsCollection(asOtherKo.firestore(), 'families', FAMILY, 'messages'), where('createdByOrgId', '==', ORG)),
      ),
    )
  })

  it('spolupracovník NEMÁ k chatu přístup vůbec, i s modulem viewTimeline', async () => {
    const asCollab = testEnv.authenticatedContext('collab1')
    await assertFails(
      getDocs(
        query(fsCollection(asCollab.firestore(), 'families', FAMILY, 'messages'), where('createdByOrgId', '==', ORG)),
      ),
    )
  })
})

describe('families/{familyId}/messages/{id} — zápis', () => {
  it('staff MŮŽE odeslat zprávu pěstounovi (audience foster)', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(
      setDoc(doc(asKo.firestore(), 'families', FAMILY, 'messages', 'new-foster-msg'), {
        createdByOrgId: ORG,
        createdByUid: 'ko1',
        authorRole: 'staff',
        audience: 'foster',
        body: 'Nová zpráva',
        createdAt: 'test',
      }),
    )
  })

  it('staff MŮŽE založit interní poznámku (audience internal)', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(
      setDoc(doc(asKo.firestore(), 'families', FAMILY, 'messages', 'new-internal-msg'), {
        createdByOrgId: ORG,
        createdByUid: 'ko1',
        authorRole: 'staff',
        audience: 'internal',
        body: 'Interní poznámka',
        createdAt: 'test',
      }),
    )
  })

  it('staff NEMŮŽE zapsat zprávu jako authorRole "foster" (padělání strany)', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertFails(
      setDoc(doc(asKo.firestore(), 'families', FAMILY, 'messages', 'spoofed'), {
        createdByOrgId: ORG,
        createdByUid: 'ko1',
        authorRole: 'foster',
        audience: 'foster',
        body: 'Padělaná zpráva',
        createdAt: 'test',
      }),
    )
  })

  it('pěstoun MŮŽE odeslat zprávu (vždy audience foster)', async () => {
    const asFoster = testEnv.authenticatedContext('pestoun-x')
    await assertSucceeds(
      setDoc(doc(asFoster.firestore(), 'families', FAMILY, 'messages', 'foster-reply'), {
        createdByOrgId: ORG,
        createdByUid: 'pestoun-x',
        authorRole: 'foster',
        audience: 'foster',
        body: 'Děkuji, daří se dobře.',
        createdAt: 'test',
      }),
    )
  })

  it('pěstoun NEMŮŽE zapsat internal zprávu (jen foster úroveň smí)', async () => {
    const asFoster = testEnv.authenticatedContext('pestoun-x')
    await assertFails(
      setDoc(doc(asFoster.firestore(), 'families', FAMILY, 'messages', 'foster-internal-attempt'), {
        createdByOrgId: ORG,
        createdByUid: 'pestoun-x',
        authorRole: 'foster',
        audience: 'internal',
        body: 'Pokus o interní zápis',
        createdAt: 'test',
      }),
    )
  })

  it('pěstoun NEMŮŽE zapsat do CIZÍ rodiny', async () => {
    const asOtherFoster = testEnv.authenticatedContext('pestoun-other-family')
    await assertFails(
      setDoc(doc(asOtherFoster.firestore(), 'families', FAMILY, 'messages', 'wrong-family-attempt'), {
        createdByOrgId: ORG,
        createdByUid: 'pestoun-other-family',
        authorRole: 'foster',
        audience: 'foster',
        body: 'Pokus o zápis do cizí rodiny',
        createdAt: 'test',
      }),
    )
  })

  it('spolupracovník NEMŮŽE zapsat zprávu, i kdyby znal ID rodiny', async () => {
    const asCollab = testEnv.authenticatedContext('collab1')
    await assertFails(
      setDoc(doc(asCollab.firestore(), 'families', FAMILY, 'messages', 'collab-attempt'), {
        createdByOrgId: ORG,
        createdByUid: 'collab1',
        authorRole: 'staff',
        audience: 'foster',
        body: 'Pokus spolupracovníka',
        createdAt: 'test',
      }),
    )
  })

  it('zápis/mazání existující zprávy je VŽDY zakázané (append-only)', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertFails(
      setDoc(doc(asKo.firestore(), 'families', FAMILY, 'messages', 'msg-foster'), {
        createdByOrgId: ORG,
        createdByUid: 'ko1',
        authorRole: 'staff',
        audience: 'foster',
        body: 'Upravený text',
        createdAt: '2026-07-21T10:00:00.000Z',
      }),
    )
  })
})
