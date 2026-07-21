import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

/**
 * MANDATORY §11.2 test — `organizations/{orgId}/calendarEvents` (Kalendář).
 * Klíčové riziko: na rozdíl od skoro celé appky (append-only) tenhle typ
 * SKUTEČNĚ povoluje `update` (drag & drop reschedule) — testy musí dokázat,
 * že update nejde zneužít ke změně `organizationId`/`createdByUid`
 * (identita záznamu), a že `delete` zůstává `if false` jako všude jinde
 * (§5 audit stopa) — "zrušit" je jen status, ne mazání.
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
    await setDoc(doc(db, 'users', 'ko2'), {
      uid: 'ko2',
      role: 'klicova_osoba',
      organizationId: ORG,
      displayName: 'KO Dva',
      email: 'ko2@test.cz',
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
    await setDoc(doc(db, 'users', 'pestoun-x'), {
      uid: 'pestoun-x',
      role: 'pestoun',
      organizationId: ORG,
      fosterFamilyId: 'fam1',
      displayName: 'Pěstoun X',
      email: 'pestoun@test.cz',
      createdAt: 'seed',
    })

    await setDoc(doc(db, 'organizations', ORG, 'calendarEvents', 'event1'), {
      organizationId: ORG,
      createdByUid: 'ko1',
      assignedToUid: 'ko1',
      title: 'Schůzka s pěstounem',
      kind: 'schuzka',
      status: 'planovano',
      start: '2026-08-01T09:00:00.000Z',
      end: '2026-08-01T10:00:00.000Z',
      createdAt: 'seed',
      updatedAt: 'seed',
    })
  })
})

describe('organizations/{orgId}/calendarEvents/{id} — čtení', () => {
  it('staff STEJNÉ organizace MŮŽE číst', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(getDoc(doc(asKo.firestore(), 'organizations', ORG, 'calendarEvents', 'event1')))
  })

  it('JINÝ staff STEJNÉ organizace (ne autor/přiřazený) TAKÉ MŮŽE číst — sdílený kalendář', async () => {
    const asKo2 = testEnv.authenticatedContext('ko2')
    await assertSucceeds(getDoc(doc(asKo2.firestore(), 'organizations', ORG, 'calendarEvents', 'event1')))
  })

  it('staff JINÉ organizace NEMŮŽE číst', async () => {
    const asOther = testEnv.authenticatedContext('ko-other-org')
    await assertFails(getDoc(doc(asOther.firestore(), 'organizations', ORG, 'calendarEvents', 'event1')))
  })

  it('pěstoun NEMÁ ke kalendáři přístup vůbec', async () => {
    const asFoster = testEnv.authenticatedContext('pestoun-x')
    await assertFails(getDoc(doc(asFoster.firestore(), 'organizations', ORG, 'calendarEvents', 'event1')))
  })
})

describe('organizations/{orgId}/calendarEvents/{id} — zápis', () => {
  it('staff MŮŽE založit novou událost', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(
      setDoc(doc(asKo.firestore(), 'organizations', ORG, 'calendarEvents', 'new-event'), {
        organizationId: ORG,
        createdByUid: 'ko1',
        assignedToUid: 'ko2',
        title: 'Supervize',
        kind: 'supervize',
        status: 'planovano',
        start: '2026-08-05T09:00:00.000Z',
        end: '2026-08-05T10:00:00.000Z',
        createdAt: 'test',
        updatedAt: 'test',
      }),
    )
  })

  it('staff NEMŮŽE založit událost pro CIZÍ organizaci', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertFails(
      setDoc(doc(asKo.firestore(), 'organizations', OTHER_ORG, 'calendarEvents', 'sneaky'), {
        organizationId: OTHER_ORG,
        createdByUid: 'ko1',
        assignedToUid: 'ko1',
        title: 'Pokus',
        kind: 'jine',
        status: 'planovano',
        start: '2026-08-05T09:00:00.000Z',
        end: '2026-08-05T10:00:00.000Z',
        createdAt: 'test',
        updatedAt: 'test',
      }),
    )
  })

  it('JINÝ staff STEJNÉ organizace MŮŽE přesunout (přetáhnout) cizí událost — sdílený kalendář', async () => {
    const asKo2 = testEnv.authenticatedContext('ko2')
    await assertSucceeds(
      updateDoc(doc(asKo2.firestore(), 'organizations', ORG, 'calendarEvents', 'event1'), {
        start: '2026-08-02T09:00:00.000Z',
        end: '2026-08-02T10:00:00.000Z',
        updatedAt: 'test',
      }),
    )
  })

  it('update NEMŮŽE změnit organizationId (padělání identity záznamu)', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertFails(
      updateDoc(doc(asKo.firestore(), 'organizations', ORG, 'calendarEvents', 'event1'), {
        organizationId: OTHER_ORG,
        updatedAt: 'test',
      }),
    )
  })

  it('staff JINÉ organizace NEMŮŽE upravit', async () => {
    const asOther = testEnv.authenticatedContext('ko-other-org')
    await assertFails(
      updateDoc(doc(asOther.firestore(), 'organizations', ORG, 'calendarEvents', 'event1'), {
        start: '2026-08-02T09:00:00.000Z',
      }),
    )
  })

  it('"zrušení" = update status na zruseno, NIKDY skutečné mazání', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(
      updateDoc(doc(asKo.firestore(), 'organizations', ORG, 'calendarEvents', 'event1'), {
        status: 'zruseno',
        updatedAt: 'test',
      }),
    )
  })

  it('Google Kalendář sync MŮŽE zapsat googleEventId (žádné nové pravidlo, jen běžný update)', async () => {
    const asKo = testEnv.authenticatedContext('ko1')
    await assertSucceeds(
      updateDoc(doc(asKo.firestore(), 'organizations', ORG, 'calendarEvents', 'event1'), {
        googleEventId: 'google-event-abc123',
        updatedAt: 'test',
      }),
    )
  })

  it('staff JINÉ organizace NEMŮŽE zapsat googleEventId cizí události', async () => {
    const asOther = testEnv.authenticatedContext('ko-other-org')
    await assertFails(
      updateDoc(doc(asOther.firestore(), 'organizations', ORG, 'calendarEvents', 'event1'), {
        googleEventId: 'sneaky',
        updatedAt: 'test',
      }),
    )
  })

  it('mazání je VŽDY zakázané, i pro autora (§5 audit stopa)', async () => {
    const { deleteDoc } = await import('firebase/firestore')
    const asKo = testEnv.authenticatedContext('ko1')
    await assertFails(deleteDoc(doc(asKo.firestore(), 'organizations', ORG, 'calendarEvents', 'event1')))
  })

  it('pěstoun NEMŮŽE zapsat vůbec', async () => {
    const asFoster = testEnv.authenticatedContext('pestoun-x')
    await assertFails(
      setDoc(doc(asFoster.firestore(), 'organizations', ORG, 'calendarEvents', 'foster-attempt'), {
        organizationId: ORG,
        createdByUid: 'pestoun-x',
        assignedToUid: 'pestoun-x',
        title: 'Pokus pěstouna',
        kind: 'jine',
        status: 'planovano',
        start: '2026-08-05T09:00:00.000Z',
        end: '2026-08-05T10:00:00.000Z',
        createdAt: 'test',
        updatedAt: 'test',
      }),
    )
  })
})
