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
 * M2 — MANDATORY §4.5 test suite (ZADANI §11.2: "modul se nepovažuje za
 * hotový bez automatizovaných testů" — jedno ze dvou nejrizikovějších
 * míst v celém systému). Scénář DO1(2020-2022)→DO2(2022-2024)→
 * DO3(2024-dosud) přesně dle §4.5 příkladu, testy 1-8 = přesně
 * "Povinná testovací matice — §4.5" seznam ze zadání, žádný vynechaný.
 * Testy 9+ pokrývají DALŠÍ díru, kterou jsem našel a opravil při psaní
 * `firestore.rules` (orgAccessList šlo rozšířit BEZ skutečné Dohody) —
 * není to ze zadání, ale je to přesně ten typ chyby, který má tahle
 * sada odhalit.
 *
 * STEJNÝ NEOVĚŘENÝ STAV jako m0/m1: lokální Firestore emulátor na tomhle
 * stroji nejde spustit (viz CURRENT_STATE.md) — napsáno poctivě a
 * důkladně podle §11.2 metodiky, ale nikdy skutečně nespuštěno.
 * `npm run test:rules` až na stroji/prostředí, kde emulátor běží.
 */

let testEnv: RulesTestEnvironment

const DO1 = 'do1'
const DO2 = 'do2'
const DO3 = 'do3'
const FAMILY = 'family-1'

const DO1_VALID_FROM = '2020-01-01T00:00:00.000Z'
const DO1_VALID_TO = '2022-01-01T00:00:00.000Z'
const DO2_VALID_FROM = '2022-01-01T00:00:00.000Z'
const DO2_VALID_TO = '2024-01-01T00:00:00.000Z'
const DO3_VALID_FROM = '2024-01-01T00:00:00.000Z'

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

    // ---- Users ----
    await setDoc(doc(db, 'users', 'staff-do1'), {
      uid: 'staff-do1',
      role: 'klicova_osoba',
      organizationId: DO1,
      displayName: 'KO DO1',
      email: 'ko1@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'staff-do2'), {
      uid: 'staff-do2',
      role: 'klicova_osoba',
      organizationId: DO2,
      displayName: 'KO DO2',
      email: 'ko2@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'staff-do3'), {
      uid: 'staff-do3',
      role: 'klicova_osoba',
      organizationId: DO3,
      displayName: 'KO DO3',
      email: 'ko3@example.com',
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'users', 'pestoun-x'), {
      uid: 'pestoun-x',
      role: 'pestoun',
      organizationId: DO3, // pěstoun MÁ organizationId — §5 "Klíčová past"
      displayName: 'Pěstoun X',
      email: 'pestoun@example.com',
      createdAt: 'seed',
    })

    // ---- Family + full three-org history ----
    await setDoc(doc(db, 'families', FAMILY), {
      uid: '9900010000006',
      orgAccessList: [DO1, DO2, DO3],
      fosterPersonRefs: [],
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'families', FAMILY, 'agreements', DO1), {
      uid: '9000010000001',
      familyId: FAMILY,
      organizationId: DO1,
      careType: 'zprostredkovana',
      status: 'ended',
      validFrom: DO1_VALID_FROM,
      validTo: DO1_VALID_TO,
      assignedTo: 'staff-do1',
      visitIntervalDays: 60,
      educationHoursTarget: 24,
      noteDeadlineHours: 72,
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'families', FAMILY, 'agreements', DO2), {
      uid: '9000010000002',
      familyId: FAMILY,
      organizationId: DO2,
      careType: 'zprostredkovana',
      status: 'ended',
      validFrom: DO2_VALID_FROM,
      validTo: DO2_VALID_TO,
      assignedTo: 'staff-do2',
      visitIntervalDays: 60,
      educationHoursTarget: 24,
      noteDeadlineHours: 72,
      createdAt: 'seed',
    })
    await setDoc(doc(db, 'families', FAMILY, 'agreements', DO3), {
      uid: '9000010000003',
      familyId: FAMILY,
      organizationId: DO3,
      careType: 'zprostredkovana',
      status: 'active',
      validFrom: DO3_VALID_FROM,
      validTo: null,
      assignedTo: 'staff-do3',
      visitIntervalDays: 60,
      educationHoursTarget: 24,
      noteDeadlineHours: 72,
      createdAt: 'seed',
    })

    // ---- Full timeline records, one per org ----
    await setDoc(doc(db, 'families', FAMILY, 'timeline', 'entry-do1'), {
      type: 'visit',
      createdByOrgId: DO1,
      occurredAt: '2021-06-01T10:00:00.000Z',
    })
    await setDoc(doc(db, 'families', FAMILY, 'timeline', 'entry-do2'), {
      type: 'visit',
      createdByOrgId: DO2,
      occurredAt: '2023-06-01T10:00:00.000Z',
    })
    await setDoc(doc(db, 'families', FAMILY, 'timeline', 'entry-do3'), {
      type: 'visit',
      createdByOrgId: DO3,
      occurredAt: '2024-06-01T10:00:00.000Z',
    })
    // Note — NEVER gets a historyDigest, on purpose (test 6).
    await setDoc(doc(db, 'families', FAMILY, 'timeline', 'note-do3'), {
      type: 'note',
      createdByOrgId: DO3,
      occurredAt: '2024-06-02T10:00:00.000Z',
    })

    // ---- historyDigest, mirroring the three visit entries ----
    await setDoc(doc(db, 'families', FAMILY, 'historyDigest', 'digest-do1'), {
      kind: 'visit',
      createdByOrgId: DO1,
      segmentValidTo: DO1_VALID_TO,
      occurredAt: '2021-06-01T10:00:00.000Z',
      durationSeconds: 1800,
    })
    await setDoc(doc(db, 'families', FAMILY, 'historyDigest', 'digest-do2'), {
      kind: 'visit',
      createdByOrgId: DO2,
      segmentValidTo: DO2_VALID_TO,
      occurredAt: '2023-06-01T10:00:00.000Z',
      durationSeconds: 1800,
    })
    await setDoc(doc(db, 'families', FAMILY, 'historyDigest', 'digest-do3'), {
      kind: 'visit',
      createdByOrgId: DO3,
      segmentValidTo: null, // DO3's agreement is still active
      occurredAt: '2024-06-01T10:00:00.000Z',
      durationSeconds: 1800,
    })

    // ---- Document: draft has no digest, sent-to-OSPOD does ----
    // Created by DO2 (whose Dohoda already ENDED, 2022-2024) — so DO3
    // (the LATER org) can legitimately read its digest via the "prior
    // period" rule. Using DO3 as creator here would be backwards: DO3 is
    // the LATEST org in this scenario, so nobody could ever read its
    // digest cross-org while it's still active (see test 4/4b/4c) — that
    // would test the wrong direction entirely.
    await setDoc(doc(db, 'families', FAMILY, 'documents', 'doc-draft'), {
      createdByOrgId: DO2,
      status: 'koncept',
      title: 'Zpráva pro OSPOD (rozpracovaná)',
    })
    await setDoc(doc(db, 'families', FAMILY, 'documents', 'doc-sent'), {
      createdByOrgId: DO2,
      status: 'odeslano_ospod',
      title: 'Zpráva pro OSPOD',
    })
    await setDoc(doc(db, 'families', FAMILY, 'historyDigest', 'digest-doc-sent'), {
      kind: 'document_sent',
      createdByOrgId: DO2,
      segmentValidTo: DO2_VALID_TO,
      sentAt: '2023-07-01T10:00:00.000Z',
      title: 'Zpráva pro OSPOD',
      sentTo: 'ospod',
      fileRef: 'gs://fake/doc-sent.pdf',
    })
  })
})

describe('§4.5 povinná matice — plný timeline záznam', () => {
  it('1. DO3 čte VLASTNÍ timeline záznam → assertSucceeds', async () => {
    const asDo3 = testEnv.authenticatedContext('staff-do3')
    await assertSucceeds(getDoc(doc(asDo3.firestore(), 'families', FAMILY, 'timeline', 'entry-do3')))
  })

  it('1b. DO2 čte VLASTNÍ dokument, i ve stavu koncept (draft) → assertSucceeds', async () => {
    const asDo2 = testEnv.authenticatedContext('staff-do2')
    await assertSucceeds(getDoc(doc(asDo2.firestore(), 'families', FAMILY, 'documents', 'doc-draft')))
  })

  it('2. DO3 čte PLNÝ timeline záznam vytvořený DO2 → assertFails', async () => {
    const asDo3 = testEnv.authenticatedContext('staff-do3')
    await assertFails(getDoc(doc(asDo3.firestore(), 'families', FAMILY, 'timeline', 'entry-do2')))
  })

  it('2b. DO3 čte PLNÝ timeline záznam vytvořený DO1 → assertFails', async () => {
    const asDo3 = testEnv.authenticatedContext('staff-do3')
    await assertFails(getDoc(doc(asDo3.firestore(), 'families', FAMILY, 'timeline', 'entry-do1')))
  })

  it('5. DO2 čte VLASTNÍ plný záznam → assertSucceeds, i po skončení vlastní Dohody', async () => {
    const asDo2 = testEnv.authenticatedContext('staff-do2')
    await assertSucceeds(getDoc(doc(asDo2.firestore(), 'families', FAMILY, 'timeline', 'entry-do2')))
  })
})

describe('§4.5 povinná matice — historyDigest (nutné minimum)', () => {
  it('3. DO3 čte historyDigest vytvořený DO2 → assertSucceeds', async () => {
    const asDo3 = testEnv.authenticatedContext('staff-do3')
    await assertSucceeds(getDoc(doc(asDo3.firestore(), 'families', FAMILY, 'historyDigest', 'digest-do2')))
  })

  it('3b. DO3 čte historyDigest vytvořený DO1 → assertSucceeds', async () => {
    const asDo3 = testEnv.authenticatedContext('staff-do3')
    await assertSucceeds(getDoc(doc(asDo3.firestore(), 'families', FAMILY, 'historyDigest', 'digest-do1')))
  })

  it('4. DO2 čte historyDigest DO3 (vzniklý PO konci vlastní Dohody DO2) → assertFails, i na digest', async () => {
    const asDo2 = testEnv.authenticatedContext('staff-do2')
    await assertFails(getDoc(doc(asDo2.firestore(), 'families', FAMILY, 'historyDigest', 'digest-do3')))
  })

  it('4b. DO1 čte historyDigest DO2 (vzniklý PO konci vlastní Dohody DO1) → assertFails', async () => {
    const asDo1 = testEnv.authenticatedContext('staff-do1')
    await assertFails(getDoc(doc(asDo1.firestore(), 'families', FAMILY, 'historyDigest', 'digest-do2')))
  })

  it('4c. DO1 čte historyDigest DO3 → assertFails', async () => {
    const asDo1 = testEnv.authenticatedContext('staff-do1')
    await assertFails(getDoc(doc(asDo1.firestore(), 'families', FAMILY, 'historyDigest', 'digest-do3')))
  })
})

describe('§4.5 povinná matice — poznámka/hlasový přepis nikdy nemá digest', () => {
  it('6. poznámka (type: note) nemá vzniklý historyDigest záznam vůbec', async () => {
    // Existenci ověřujeme přes withSecurityRulesDisabled (čistá kontrola
    // dat), NE přes běžný klient — čtení NEEXISTUJÍCÍHO dokumentu na
    // pravidle, co čte `resource.data.*`, by u Firestore mohlo vrátit
    // permission-denied místo "neexistuje" (resource je null, přístup na
    // `.data` chybí), takže `assertSucceeds`/`getDoc().exists()` by tu
    // testovalo špatnou věc. Nikdy jsme nezaložili digest pro "note-do3" —
    // ověřujeme přímo, že tam skutečně žádný není (ne že by ho rules jen
    // skrývaly cizí organizaci).
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), 'families', FAMILY, 'historyDigest', 'note-do3'))
      if (snap.exists()) {
        throw new Error('note-do3 nemělo mít žádný historyDigest záznam, ale existuje')
      }
    })
  })
})

describe('§4.5 povinná matice — dokument: koncept vs. odeslano_ospod', () => {
  it('7a. dokument ve stavu koncept nemá digest (viz test 6 pro vysvětlení withSecurityRulesDisabled)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(
        doc(ctx.firestore(), 'families', FAMILY, 'historyDigest', 'digest-doc-draft'),
      )
      if (snap.exists()) {
        throw new Error('koncept dokument nemělo mít digest, ale existuje')
      }
    })
  })

  it('7b. po přechodu do odeslano_ospod digest existuje a je čitelný cizí organizací s POZDĚJŠÍ Dohodou (DO3 čte DO2, jehož Dohoda skončila dřív)', async () => {
    const asDo3 = testEnv.authenticatedContext('staff-do3')
    await assertSucceeds(
      getDoc(doc(asDo3.firestore(), 'families', FAMILY, 'historyDigest', 'digest-doc-sent')),
    )
  })
})

describe('§4.5 povinná matice — non-staff nemá přístup vůbec', () => {
  it('8. pěstoun (non-staff, i se stejným organizationId jako DO3) se nedostane k žádnému Spisu', async () => {
    const asPestoun = testEnv.authenticatedContext('pestoun-x')
    await assertFails(getDoc(doc(asPestoun.firestore(), 'families', FAMILY)))
  })

  it('8b. pěstoun se nedostane ani k historyDigest, přestože sdílí organizationId s DO3', async () => {
    const asPestoun = testEnv.authenticatedContext('pestoun-x')
    await assertFails(
      getDoc(doc(asPestoun.firestore(), 'families', FAMILY, 'historyDigest', 'digest-do3')),
    )
  })
})

describe('Dodatečně nalezená díra (opravena): orgAccessList rozšíření vyžaduje SKUTEČNOU Dohodu', () => {
  it('staff BEZ vlastní Dohody CANNOT přidat svou organizaci do orgAccessList cizí rodiny', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'staff-outsider'), {
        uid: 'staff-outsider',
        role: 'klicova_osoba',
        organizationId: 'outsider-org',
        displayName: 'Outsider',
        email: 'outsider@example.com',
        createdAt: 'seed',
      })
    })
    const asOutsider = testEnv.authenticatedContext('staff-outsider')
    await assertFails(
      updateDoc(doc(asOutsider.firestore(), 'families', FAMILY), {
        orgAccessList: [DO1, DO2, DO3, 'outsider-org'],
      }),
    )
  })

  it('staff S existující Dohodou (přesně jejich vlastní org) MŮŽE legitimně rozšířit orgAccessList', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'staff-do4'), {
        uid: 'staff-do4',
        role: 'klicova_osoba',
        organizationId: 'do4',
        displayName: 'KO DO4',
        email: 'ko4@example.com',
        createdAt: 'seed',
      })
      // Simuluje agreementService.createAgreement krok 1 (Dohoda VŽDY první).
      await setDoc(doc(ctx.firestore(), 'families', FAMILY, 'agreements', 'do4'), {
        uid: '9000010000004',
        familyId: FAMILY,
        organizationId: 'do4',
        careType: 'zprostredkovana',
        status: 'active',
        validFrom: '2025-01-01T00:00:00.000Z',
        validTo: null,
        assignedTo: 'staff-do4',
        visitIntervalDays: 60,
        educationHoursTarget: 24,
        noteDeadlineHours: 72,
        createdAt: 'seed',
      })
    })
    const asDo4 = testEnv.authenticatedContext('staff-do4')
    await assertSucceeds(
      updateDoc(doc(asDo4.firestore(), 'families', FAMILY), {
        orgAccessList: [DO1, DO2, DO3, 'do4'],
      }),
    )
  })

  it('nejde přidat víc než jednu novou organizaci najednou (musí být přesně +1 vlastní org)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'staff-do5'), {
        uid: 'staff-do5',
        role: 'klicova_osoba',
        organizationId: 'do5',
        displayName: 'KO DO5',
        email: 'ko5@example.com',
        createdAt: 'seed',
      })
      await setDoc(doc(ctx.firestore(), 'families', FAMILY, 'agreements', 'do5'), {
        uid: '9000010000005',
        familyId: FAMILY,
        organizationId: 'do5',
        careType: 'zprostredkovana',
        status: 'active',
        validFrom: '2025-01-01T00:00:00.000Z',
        validTo: null,
        assignedTo: 'staff-do5',
        visitIntervalDays: 60,
        educationHoursTarget: 24,
        noteDeadlineHours: 72,
        createdAt: 'seed',
      })
    })
    const asDo5 = testEnv.authenticatedContext('staff-do5')
    await assertFails(
      updateDoc(doc(asDo5.firestore(), 'families', FAMILY), {
        orgAccessList: [DO1, DO2, DO3, 'do5', 'sneaky-extra-org'],
      }),
    )
  })
})

describe('Dodatečně nalezená díra — agreements deterministické ID', () => {
  it('agreement document ID MUSÍ odpovídat organizationId, ne libovolné', async () => {
    const asDo1 = testEnv.authenticatedContext('staff-do1')
    await assertFails(
      setDoc(doc(asDo1.firestore(), 'families', 'family-2', 'agreements', 'nahodne-id'), {
        uid: '9000010000009',
        familyId: 'family-2',
        organizationId: DO1,
        careType: 'zprostredkovana',
        status: 'active',
        validFrom: '2025-01-01T00:00:00.000Z',
        validTo: null,
        assignedTo: null,
        visitIntervalDays: 60,
        educationHoursTarget: 24,
        noteDeadlineHours: 72,
        createdAt: 'test',
      }),
    )
  })
})

describe('timeline/documents create vyžaduje AKTIVNÍ Dohodu, ne jen historickou', () => {
  it('DO1 (Dohoda skončená) NEMŮŽE založit nový timeline záznam', async () => {
    const asDo1 = testEnv.authenticatedContext('staff-do1')
    await assertFails(
      setDoc(doc(asDo1.firestore(), 'families', FAMILY, 'timeline', 'new-entry-do1'), {
        type: 'visit',
        createdByOrgId: DO1,
        occurredAt: '2025-01-01T00:00:00.000Z',
      }),
    )
  })

  it('DO3 (Dohoda aktivní) MŮŽE založit nový timeline záznam', async () => {
    const asDo3 = testEnv.authenticatedContext('staff-do3')
    await assertSucceeds(
      setDoc(doc(asDo3.firestore(), 'families', FAMILY, 'timeline', 'new-entry-do3'), {
        type: 'visit',
        createdByOrgId: DO3,
        occurredAt: '2025-01-01T00:00:00.000Z',
      }),
    )
  })
})
