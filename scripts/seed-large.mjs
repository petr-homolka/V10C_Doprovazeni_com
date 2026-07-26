#!/usr/bin/env node
/**
 * Rozsáhlý seed pro ruční testování M6+M7 (NOVE-ZADANI-M6-AZ-KONEC.md) —
 * 3 organizace, každá 1 ředitel/ředitelka (org_admin) + 5 klíčových osob,
 * každá KO 15+ Dohod (aspoň 2 KO/org přes 19 — platformní výchozí práh
 * kapacity, viz DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD), každá rodina 0-3
 * dětí ve výhradní/společné péči (1-2 pěstouni). Navíc JEDNA "vzorová"
 * rodina/organizace dostane po jednom příkladu z každého nového M6/M7
 * modulu (IPPD, kurz, plán vzdělávání, respit, naplánovaná aktivita,
 * podpůrný výdaj, asistovaný kontakt, předání dítěte, inspekce, zájemce),
 * aby manuální testování mělo na co kliknout ve VŠECH nových kolekcích —
 * ne vyčerpávající pokrytí (to by řádově znásobilo objem zápisů), jen
 * jeden živý příklad každé věci.
 *
 * NENÍ idempotentní (na rozdíl od seed-demo-org.mjs) — `orgCode` se
 * alokuje ze SKUTEČNÉHO čítače (`systemCounters/orgCode`), takže každý běh
 * vytvoří 3 NOVÉ organizace s novými kódy. Spouštěj JEDNOU.
 *
 * Stejná REST/gcloud-token technika jako seed-demo-org.mjs (žádná nová
 * závislost, žádné firebase-admin, viz ten soubor pro odůvodnění) —
 * obchází firestore.rules stejně jako `firebase firestore:delete`.
 *
 * Spustit: `npm run seed:large` (potřebuje `gcloud`/`firebase` CLI
 * přihlášené s právy na v10c-doprovazeni-com).
 */
import { execSync } from 'node:child_process'

const PROJECT_ID = 'v10c-doprovazeni-com'
const API_KEY = 'AIzaSyDz6xGFDn77R0knZSJvD5iqQHwsFJh_aJc'
const STAFF_PASSWORD = 'heslo123'
const WRITE_CHUNK_SIZE = 400

let cachedToken = null
function accessToken() {
  if (!cachedToken) cachedToken = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
  return cachedToken
}

async function firestoreCommit(writes) {
  const token = accessToken()
  for (let i = 0; i < writes.length; i += WRITE_CHUNK_SIZE) {
    const chunk = writes.slice(i, i + WRITE_CHUNK_SIZE)
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-goog-user-project': PROJECT_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ writes: chunk }),
      },
    )
    const body = await res.json()
    if (!res.ok) throw new Error(`Firestore commit selhal: ${JSON.stringify(body)}`)
    console.log(`  zapsáno ${Math.min(i + WRITE_CHUNK_SIZE, writes.length)}/${writes.length}`)
  }
}

async function firestoreGetValue(path) {
  const token = accessToken()
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT_ID } },
  )
  if (res.status === 404) return null
  const body = await res.json()
  if (!res.ok) throw new Error(`Firestore GET selhal: ${JSON.stringify(body)}`)
  return body
}

async function ensureAuthAccount(email, password, displayName) {
  const signUp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const signUpBody = await signUp.json()
  if (signUp.ok) return signUpBody.localId

  if (signUpBody.error?.message !== 'EMAIL_EXISTS') {
    throw new Error(`Založení účtu ${email} (${displayName}) selhalo: ${JSON.stringify(signUpBody)}`)
  }
  const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const signInBody = await signIn.json()
  if (!signIn.ok) throw new Error(`Přihlášení k existujícímu účtu ${email} selhalo: ${JSON.stringify(signInBody)}`)
  return signInBody.localId
}

// ---- EAN-13 UID — stejný algoritmus jako src/lib/uid.ts + counters.ts ----

const ENTITY_TYPE_CODES = { fosterPerson: '10', child: '20', agreement: '90', familyFile: '99' }

function ean13CheckDigit(twelve) {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += i % 2 === 0 ? Number(twelve[i]) : Number(twelve[i]) * 3
  return (10 - (sum % 10)) % 10
}

function buildUid(entityType, orgCode, sequence) {
  const base12 = `${ENTITY_TYPE_CODES[entityType]}${orgCode}${String(sequence).padStart(6, '0')}`
  return `${base12}${ean13CheckDigit(base12)}`
}

// ---- Firestore REST value encoding ----

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return { doubleValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } }
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } }
  throw new Error(`Nepodporovaná hodnota pro seed: ${JSON.stringify(v)}`)
}

function toFields(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    fields[k] = toValue(v)
  }
  return fields
}

/**
 * Každý dokument ze seedu nese `dataClass: 'test'`. Bez toho by po pár
 * letech nešlo poznat, co je zkušební a co ostrý spis — a retenční
 * i archivační pravidla (30 let, viz src/lib/retentionPolicy.ts) platí
 * VÝHRADNĚ pro ostrá data. Chybějící pole se čte jako 'live', takže
 * neoznačený záznam je vždycky ten chráněný.
 */
const DATA_CLASS_TEST = 'test'

function writeDoc(path, data) {
  return {
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
      fields: toFields({ ...data, dataClass: DATA_CLASS_TEST }),
    },
  }
}

// ---- Náhodné, ale realistické generování jmen ----------------------------

function deaccent(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedPick(weights) {
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let roll = Math.random() * total
  for (const [value, w] of weights) {
    roll -= w
    if (roll <= 0) return value
  }
  return weights[weights.length - 1][0]
}

const MALE_FIRST_NAMES = [
  'Jan', 'Petr', 'Pavel', 'Tomáš', 'Martin', 'Jiří', 'Josef', 'Miroslav', 'Zdeněk', 'Václav',
  'Milan', 'František', 'Karel', 'Michal', 'Jaroslav', 'Ladislav', 'Vladimír', 'Stanislav', 'Roman', 'David',
  'Lukáš', 'Ondřej', 'Marek', 'Filip', 'Radek', 'Aleš', 'Dušan', 'Vojtěch', 'Antonín', 'Bohumil',
]
const FEMALE_FIRST_NAMES = [
  'Jana', 'Marie', 'Eva', 'Hana', 'Anna', 'Lenka', 'Kateřina', 'Věra', 'Alena', 'Lucie',
  'Petra', 'Michaela', 'Zdeňka', 'Jitka', 'Ivana', 'Dagmar', 'Blanka', 'Milena', 'Vlasta', 'Renata',
  'Kristýna', 'Barbora', 'Veronika', 'Monika', 'Simona', 'Dana', 'Iveta', 'Radka', 'Šárka', 'Gabriela',
]
const SURNAME_PAIRS = [
  ['Novák', 'Nováková'], ['Svoboda', 'Svobodová'], ['Novotný', 'Novotná'], ['Dvořák', 'Dvořáková'], ['Černý', 'Černá'],
  ['Procházka', 'Procházková'], ['Kučera', 'Kučerová'], ['Veselý', 'Veselá'], ['Horák', 'Horáková'], ['Němec', 'Němcová'],
  ['Marek', 'Marková'], ['Pokorný', 'Pokorná'], ['Pospíšil', 'Pospíšilová'], ['Hájek', 'Hájková'], ['Král', 'Králová'],
  ['Jelínek', 'Jelínková'], ['Růžička', 'Růžičková'], ['Beneš', 'Benešová'], ['Fiala', 'Fialová'], ['Sedláček', 'Sedláčková'],
  ['Doležal', 'Doležalová'], ['Zeman', 'Zemanová'], ['Kolář', 'Kolářová'], ['Navrátil', 'Navrátilová'], ['Čermák', 'Čermáková'],
  ['Urban', 'Urbanová'], ['Bartoš', 'Bartošová'], ['Vaněk', 'Vaňková'], ['Kadlec', 'Kadlecová'], ['Mareš', 'Marešová'],
  ['Šimek', 'Šimková'], ['Blažek', 'Blažková'], ['Musil', 'Musilová'], ['Malý', 'Malá'], ['Sýkora', 'Sýkorová'],
  ['Šťastný', 'Šťastná'], ['Konečný', 'Konečná'], ['Kopecký', 'Kopecká'], ['Vlček', 'Vlčková'],
]
const CHILD_FIRST_NAMES = {
  m: ['Jakub', 'Tomáš', 'Jan', 'Matěj', 'Vojtěch', 'Filip', 'Ondřej', 'Adam', 'Daniel', 'Lukáš', 'Marek', 'Vít', 'David', 'Šimon', 'Štěpán'],
  f: ['Eliška', 'Anna', 'Kateřina', 'Barbora', 'Adéla', 'Natálie', 'Karolína', 'Veronika', 'Nikola', 'Tereza', 'Sofie', 'Viktorie', 'Ema', 'Julie', 'Laura'],
}

function randomPerson(gender) {
  const firstName = gender === 'm' ? pick(MALE_FIRST_NAMES) : pick(FEMALE_FIRST_NAMES)
  const pair = pick(SURNAME_PAIRS)
  const lastName = gender === 'm' ? pair[0] : pair[1]
  return { firstName, lastName, gender }
}

function randomChild() {
  const gender = Math.random() < 0.5 ? 'm' : 'f'
  const firstName = pick(CHILD_FIRST_NAMES[gender])
  const pair = pick(SURNAME_PAIRS)
  const lastName = gender === 'm' ? pair[0] : pair[1]
  return { firstName, lastName, gender }
}

function emailFor(person, domain) {
  return `${deaccent(person.firstName).toLowerCase()}.${deaccent(person.lastName).toLowerCase()}@${domain}`
}

// ---- Časové pomůcky -------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000
const nowIso = new Date().toISOString()

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}
function isoMonthsAgo(months) {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString()
}
function isoMonthsFromNow(months) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

/** §A3/dashboard varování — rozmanité stáří poslední návštěvy napříč
 * seedovanými Dohodami, ať "Čeká na vás"/§B.8 hlídání mají na testování
 * co ukázat (ne aby všechno bylo v klidu, ani aby všechno bylo v krizi). */
function randomLastVisitAt() {
  return weightedPick([
    [null, 30],
    ['recent', 35],
    ['warning', 15],
    ['crisis', 20],
  ])
}
function resolveLastVisitAt(tier) {
  if (tier === null) return null
  if (tier === 'recent') return isoDaysAgo(5 + Math.floor(Math.random() * 35))
  if (tier === 'warning') return isoDaysAgo(45 + Math.floor(Math.random() * 14))
  return isoDaysAgo(65 + Math.floor(Math.random() * 60))
}

// ---- Organizace ------------------------------------------------------------

const ORG_DEFS = [
  {
    slug: 'cechy',
    docId: 'org-cechy',
    name: 'Pěstounská péče Čechy, z. ú.',
    domain: 'cechy-doprovazeni.cz',
    director: { firstName: 'Hana', lastName: 'Bartošová', gender: 'f' },
    koCounts: [15, 16, 17, 20, 24],
  },
  {
    slug: 'morava',
    docId: 'org-morava',
    name: 'Rodinné doprovázení Morava, o.p.s.',
    domain: 'morava-doprovazeni.cz',
    director: { firstName: 'Josef', lastName: 'Kolář', gender: 'm' },
    koCounts: [16, 15, 20, 15, 22],
  },
  {
    slug: 'slezsko',
    docId: 'org-slezsko',
    name: 'Náruč pro rodinu Slezsko, z. ú.',
    domain: 'slezsko-doprovazeni.cz',
    director: { firstName: 'Jana', lastName: 'Dvořáková', gender: 'f' },
    koCounts: [15, 18, 15, 21, 20],
  },
]

async function allocateOrgCodes(count) {
  const existing = await firestoreGetValue('systemCounters/orgCode')
  const current = existing ? Number(existing.fields?.value?.integerValue ?? existing.fields?.value?.doubleValue ?? 0) : 0
  const codes = []
  for (let i = 1; i <= count; i++) codes.push(String(current + i).padStart(4, '0'))
  return { codes, finalValue: current + count }
}

async function main() {
  console.log('Alokuji orgCode pro 3 nové organizace…')
  const { codes: orgCodes, finalValue } = await allocateOrgCodes(ORG_DEFS.length)
  console.log(`  orgCodes = ${orgCodes.join(', ')}`)

  const writes = []
  writes.push(writeDoc('systemCounters/orgCode', { value: finalValue, updatedAt: nowIso }))

  const summary = []

  for (let orgIdx = 0; orgIdx < ORG_DEFS.length; orgIdx++) {
    const def = ORG_DEFS[orgIdx]
    const orgCode = orgCodes[orgIdx]
    const orgId = def.docId

    console.log(`\nOrganizace ${orgIdx + 1}/3: ${def.name} (${orgId}, orgCode ${orgCode})`)

    console.log('  Zakládám ředitele/ředitelku…')
    const directorEmail = emailFor(def.director, def.domain)
    const directorUid = await ensureAuthAccount(directorEmail, STAFF_PASSWORD, def.director.lastName)

    writes.push(
      writeDoc(`organizations/${orgId}`, {
        orgCode,
        name: def.name,
        createdByUid: directorUid,
        createdAt: isoMonthsAgo(30),
      }),
      writeDoc(`users/${directorUid}`, {
        uid: directorUid,
        role: 'org_admin',
        displayName: `${def.director.firstName} ${def.director.lastName}`,
        email: directorEmail,
        organizationId: orgId,
        fte: 1,
        createdAt: isoMonthsAgo(30),
      }),
    )
    summary.push({ org: def.name, role: 'org_admin (ředitel/ředitelka)', email: directorEmail, password: STAFF_PASSWORD })

    console.log('  Zakládám 5 klíčových osob…')
    const koUids = []
    for (let koIdx = 0; koIdx < def.koCounts.length; koIdx++) {
      const gender = Math.random() < 0.5 ? 'm' : 'f'
      const koPerson = randomPerson(gender)
      const koEmail = emailFor(koPerson, def.domain)
      const koUid = await ensureAuthAccount(koEmail, STAFF_PASSWORD, koPerson.lastName)
      koUids.push(koUid)
      writes.push(
        writeDoc(`users/${koUid}`, {
          uid: koUid,
          role: 'klicova_osoba',
          displayName: `${koPerson.firstName} ${koPerson.lastName}`,
          email: koEmail,
          organizationId: orgId,
          fte: 1,
          createdAt: isoMonthsAgo(20 + koIdx),
        }),
      )
      summary.push({
        org: def.name,
        role: `klicova_osoba (${def.koCounts[koIdx]} Dohod)`,
        email: koEmail,
        password: STAFF_PASSWORD,
      })
    }

    let fosterSeq = 0
    let childSeq = 0
    let agreementSeq = 0
    let familySeq = 0
    let sampleFamilyDocId = null
    let sampleChildDocId = null
    let sampleFosterPersonDocId = null

    for (let koIdx = 0; koIdx < def.koCounts.length; koIdx++) {
      const koUid = koUids[koIdx]
      const agreementCount = def.koCounts[koIdx]

      for (let i = 0; i < agreementCount; i++) {
        familySeq++
        const familyDocId = `${def.slug}-family-${familySeq}`
        const isCouple = Math.random() < 0.65
        const primaryGender = Math.random() < 0.5 ? 'm' : 'f'
        const primary = randomPerson(primaryGender)
        const partner = isCouple ? randomPerson(primaryGender === 'm' ? 'f' : 'm') : null
        const surnamePair = SURNAME_PAIRS.find((p) => p.includes(primary.lastName)) ?? [primary.lastName, primary.lastName]

        const fosterIds = []
        fosterSeq++
        const primaryFosterId = `${def.slug}-foster-${fosterSeq}a`
        fosterIds.push(primaryFosterId)
        const primaryFosterUid = buildUid('fosterPerson', orgCode, fosterSeq)
        writes.push(
          writeDoc(`fosterPersons/${primaryFosterId}`, {
            uid: primaryFosterUid,
            orgAccessList: [orgId],
            familyId: familyDocId,
            firstName: primary.firstName,
            lastName: primary.gender === 'm' ? surnamePair[0] : surnamePair[1],
            phone: `+420 ${600 + (fosterSeq % 400)} ${String(100 + (fosterSeq % 900)).padStart(3, '0')} ${String(100 + ((fosterSeq * 7) % 900)).padStart(3, '0')}`,
            email: emailFor(primary, 'seed-pestoun.example'),
            createdAt: isoMonthsAgo(3 + (i % 60)),
          }),
        )
        let partnerFosterId = null
        if (partner) {
          fosterSeq++
          partnerFosterId = `${def.slug}-foster-${fosterSeq}b`
          fosterIds.push(partnerFosterId)
          const partnerFosterUid = buildUid('fosterPerson', orgCode, fosterSeq)
          writes.push(
            writeDoc(`fosterPersons/${partnerFosterId}`, {
              uid: partnerFosterUid,
              orgAccessList: [orgId],
              familyId: familyDocId,
              firstName: partner.firstName,
              lastName: partner.gender === 'm' ? surnamePair[0] : surnamePair[1],
              phone: `+420 ${600 + ((fosterSeq + 3) % 400)} ${String(100 + (fosterSeq % 900)).padStart(3, '0')} ${String(100 + ((fosterSeq * 11) % 900)).padStart(3, '0')}`,
              createdAt: isoMonthsAgo(3 + (i % 60)),
            }),
          )
        }

        const childCount = weightedPick([[0, 15], [1, 35], [2, 35], [3, 15]])
        const childIds = []
        const childLetters = ['a', 'b', 'c']
        for (let c = 0; c < childCount; c++) {
          childSeq++
          const childDocId = `${def.slug}-child-${childSeq}${childLetters[c]}`
          childIds.push(childDocId)
          const childPerson = randomChild()
          const childUid = buildUid('child', orgCode, childSeq)
          const birthYear = 2008 + Math.floor(Math.random() * 18)
          const birthNumber = `${String(birthYear).slice(2)}${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}/${String(1000 + Math.floor(Math.random() * 9000))}`
          writes.push(
            writeDoc(`children/${childDocId}`, {
              uid: childUid,
              familyId: familyDocId,
              organizationId: orgId,
              firstName: childPerson.firstName,
              lastName: childPerson.gender === 'm' ? surnamePair[0] : surnamePair[1],
              birthNumber,
              createdAt: isoMonthsAgo(3 + (i % 60)),
            }),
          )
        }

        writes.push(
          writeDoc(`families/${familyDocId}`, {
            uid: buildUid('familyFile', orgCode, familySeq),
            orgAccessList: [orgId],
            fosterPersonRefs: fosterIds,
            address: `${pick(['Hlavní', 'Nádražní', 'Zahradní', 'Polní', 'Krátká', 'Lipová', 'Sadová', 'Školní'])} ${1 + Math.floor(Math.random() * 60)}, ${pick(['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Olomouc', 'Hradec Králové', 'Liberec', 'České Budějovice'])}`,
            createdAt: isoMonthsAgo(3 + (i % 60)),
          }),
        )

        agreementSeq++
        const careType = Math.random() < 0.6 ? 'zprostredkovana' : 'nezprostredkovana'
        const validFromMonthsAgo = 1 + Math.floor(Math.random() * 60)
        const visitTier = randomLastVisitAt()
        writes.push(
          writeDoc(`families/${familyDocId}/agreements/${orgId}`, {
            uid: buildUid('agreement', orgCode, agreementSeq),
            familyId: familyDocId,
            organizationId: orgId,
            careType,
            status: 'active',
            validFrom: isoMonthsAgo(validFromMonthsAgo),
            validTo: null,
            assignedTo: koUid,
            visitIntervalDays: 60,
            educationHoursTarget: careType === 'zprostredkovana' ? 24 : 18,
            noteDeadlineHours: 72,
            lastVisitAt: resolveLastVisitAt(visitTier),
            createdAt: isoMonthsAgo(validFromMonthsAgo),
          }),
          writeDoc(`counters/${orgId}_99`, { organizationId: orgId, entityType: 'familyFile', value: familySeq, updatedAt: nowIso }),
          writeDoc(`counters/${orgId}_90`, { organizationId: orgId, entityType: 'agreement', value: agreementSeq, updatedAt: nowIso }),
        )

        // První rodina KAŽDÉ organizace je "vzorová" — dostane po jednom
        // příkladu z každého M6/M7 modulu (viz komentář nahoře souboru).
        if (sampleFamilyDocId === null) {
          sampleFamilyDocId = familyDocId
          sampleFosterPersonDocId = primaryFosterId
          sampleChildDocId = childIds[0] ?? null
        }
      }
    }

    writes.push(
      writeDoc(`counters/${orgId}_10`, { organizationId: orgId, entityType: 'fosterPerson', value: fosterSeq, updatedAt: nowIso }),
      writeDoc(`counters/${orgId}_20`, { organizationId: orgId, entityType: 'child', value: childSeq, updatedAt: nowIso }),
    )

    // ---- Vzorová M6/M7 data (jedna instance od každého, viz nahoře) ------

    if (sampleFosterPersonDocId) {
      const windowStart = isoMonthsAgo(6)
      const windowEnd = isoMonthsFromNow(6)
      writes.push(
        writeDoc(`fosterPersons/${sampleFosterPersonDocId}/courses/seed-course-1`, {
          organizationId: orgId,
          title: 'Úvod do teorie attachmentu',
          providerRef: null,
          type: 'prezencne',
          hours: 8,
          occurredAt: isoMonthsAgo(2),
          cost: 1200,
          certificateFileRef: null,
          countsTowardOfficial: true,
          supervisionKind: null,
          createdAt: isoMonthsAgo(2),
        }),
      )
      writes.push({
        update: {
          name: `projects/${PROJECT_ID}/databases/(default)/documents/fosterPersons/${sampleFosterPersonDocId}`,
          fields: toFields({
            educationOfficial: {
              agreementRef: `families/${sampleFamilyDocId}/agreements/${orgId}`,
              windowStart,
              windowEnd,
              hoursRequired: 24,
              hoursCompletedInWindow: 8,
              hoursBankedFromPrevious: 0,
            },
            educationLifetimeHours: 8,
          }),
        },
        updateMask: { fieldPaths: ['educationOfficial', 'educationLifetimeHours'] },
      })

      writes.push(
        writeDoc(`fosterPersons/${sampleFosterPersonDocId}/educationPlans/seed-plan-1`, {
          organizationId: orgId,
          agreementRef: orgId,
          windowStart,
          windowEnd,
          items: [
            {
              id: 'seed-item-1',
              categoryCode: 'a',
              topicName: 'Teorie a psychologie výchovy — pokračovací kurz',
              needReason: 'Doporučeno klíčovou osobou po ročním vyhodnocení',
              childRef: null,
              plannedHours: 8,
              estimatedCost: 1500,
              status: 'planovano',
              courseEnrollmentRef: null,
            },
          ],
          totalEstimatedCost: 1500,
          status: 'aktivni',
          proposedBy: koUids[0],
          proposedAt: isoMonthsAgo(1),
          approvedBy: koUids[0],
          approvedAt: isoMonthsAgo(1),
          fosterConfirmedAt: isoMonthsAgo(1),
        }),
      )
    }

    writes.push(
      writeDoc(`families/${sampleFamilyDocId}/agreements/${orgId}/ippd/seed-ippd-1`, {
        organizationId: orgId,
        periodFrom: isoMonthsAgo(3),
        periodTo: isoMonthsFromNow(3),
        previousIppdRef: null,
        goals: [
          {
            id: 'seed-goal-1',
            description: 'Podpora školní docházky a přípravy do školy',
            responsibleRef: { kind: 'fosterPerson', id: sampleFosterPersonDocId },
            steps: [],
            status: 'aktivni',
            carriedFromGoalId: null,
          },
        ],
        evaluation: { dueDate: isoMonthsFromNow(3), completedAt: null, completedBy: null, summary: null, resultingDocumentRef: null },
        status: 'aktivni',
        createdBy: koUids[0],
        createdAt: isoMonthsAgo(3),
      }),
    )

    if (sampleChildDocId) {
      writes.push(
        writeDoc(`families/${sampleFamilyDocId}/respitEvents/seed-respit-1`, {
          organizationId: orgId,
          kind: 'celodenni_pece',
          subjectRefs: [{ kind: 'child', id: sampleChildDocId }],
          dateFrom: isoDaysAgo(20),
          dateTo: isoDaysAgo(18),
          daysCount: 3,
          calendarYear: new Date().getFullYear(),
          providerRef: null,
          reason: 'Krátkodobé odlehčení pěstounské rodiny',
          cost: 900,
          organizedWith: null,
          costCoveredByOrg: null,
          stravaUbytovani: null,
          invoiceDocumentRef: null,
          paymentProofDocumentRef: null,
          daysCounted: 3,
          createdBy: koUids[0],
          createdAt: isoDaysAgo(18),
        }),
        // `createRespitEvent` (skutečná služba) inkrementuje tohle pole
        // transakčně spolu se zápisem — tady se zapisuje ručně, aby
        // `getChildRespitDaysForYear` ukázalo konzistentní číslo i pro
        // ručně seedovaný respitEvent výš.
        {
          update: {
            name: `projects/${PROJECT_ID}/databases/(default)/documents/children/${sampleChildDocId}`,
            fields: toFields({ respitDaysUsed: { [String(new Date().getFullYear())]: 3 } }),
          },
          updateMask: { fieldPaths: ['respitDaysUsed'] },
        },
        writeDoc(`children/${sampleChildDocId}/scheduledActivities/seed-activity-1`, {
          organizationId: orgId,
          activityType: 'doucovani',
          providerKind: 'externi',
          internalStaffUid: null,
          externalInstitutionRef: null,
          isRespit: false,
          confirmationMode: 'potvrzuje_se',
          schedule: {
            startDate: isoMonthsAgo(2),
            endDate: null,
            recurrence: { frequency: 'weekly', daysOfWeek: [2], durationMinutes: 60 },
          },
          rate: { amountPerHour: 200 },
          rateWasOverridden: false,
          osobniPeceDuvod: null,
          createdBy: koUids[0],
          createdAt: isoMonthsAgo(2),
        }),
        writeDoc(`children/${sampleChildDocId}/scheduledActivities/seed-activity-1/occurrences/seed-occurrence-1`, {
          date: isoDaysAgo(7),
          status: 'probehlo',
          confirmedBy: koUids[0],
          confirmedAt: isoDaysAgo(7),
        }),
        writeDoc(`children/${sampleChildDocId}/supportExpenses/seed-expense-1`, {
          organizationId: orgId,
          category: 'doucovani',
          source: 'smluvni',
          providerRef: null,
          amount: 800,
          periodFrom: isoMonthsAgo(1),
          periodTo: isoDaysAgo(1),
          documentRef: null,
          createdBy: koUids[0],
          note: 'Měsíční doučování matematiky',
          createdAt: isoMonthsAgo(1),
        }),
        writeDoc(`families/${sampleFamilyDocId}/assistedContactSeries/seed-series-1`, {
          organizationId: orgId,
          childRef: sampleChildDocId,
          participantRefs: [],
          purpose: 'Pravidelný kontakt s biologickou matkou',
          schedule: { startDate: isoMonthsAgo(2), endDate: null, recurrence: { frequency: 'monthly', interval: 1 } },
          defaultLocation: 'Kontaktní místnost OSPOD',
          defaultAssistingStaffUid: koUids[0],
          linkedIppdGoalId: null,
          status: 'aktivni',
          createdBy: koUids[0],
          createdAt: isoMonthsAgo(2),
        }),
        writeDoc(`families/${sampleFamilyDocId}/assistedContactSeries/seed-series-1/occurrences/seed-occ-1`, {
          plannedDate: isoDaysAgo(10),
          status: 'probehlo',
          preparation: { staffUid: koUids[0], completedAt: isoDaysAgo(11), note: null },
          assistance: { staffUid: koUids[0], actualDate: isoDaysAgo(10), location: 'Kontaktní místnost OSPOD', note: null },
          evaluation: null,
          costs: null,
          cancelReason: null,
        }),
        writeDoc(`families/${sampleFamilyDocId}/childHandovers/seed-handover-1`, {
          organizationId: orgId,
          childRef: sampleChildDocId,
          handoverDate: isoDaysAgo(200),
          toWhom: 'biologicka_rodina',
          transportCost: 350,
          reason: 'Přechodná pěstounská péče ukončena, vzdálenost bydliště biologické rodiny 40 km',
          createdBy: koUids[0],
          createdAt: isoDaysAgo(200),
        }),
      )
    }

    const inspectionFindings = [
      { criterionCode: '1a', score: 3, deficiencyNote: undefined, correctiveAction: undefined, correctiveDeadline: null },
      { criterionCode: '1b', score: 2, deficiencyNote: 'Chybí aktualizace vnitřních postupů', correctiveAction: 'Doplnit směrnici', correctiveDeadline: isoDaysAgo(-30) },
    ]
    writes.push(
      writeDoc(`organizations/${orgId}/inspections/seed-inspection-1`, {
        organizationId: orgId,
        inspectionDateFrom: isoMonthsAgo(4),
        inspectionDateTo: isoMonthsAgo(4),
        inspectingAuthorityName: 'Krajský úřad',
        subject: 'Kontrola dodržování standardů kvality',
        standardRef: 'priloha_2',
        findings: inspectionFindings,
        totalScore: inspectionFindings.reduce((s, f) => s + f.score, 0),
        maxPossibleScore: inspectionFindings.length * 3,
        scorePercentage: inspectionFindings.reduce((s, f) => s + f.score, 0) / (inspectionFindings.length * 3),
        resultDocumentRef: null,
        createdBy: koUids[0],
        createdAt: isoMonthsAgo(4),
      }),
      writeDoc(`fosterProspects/${orgId}-seed-prospect-1`, {
        organizationId: orgId,
        name: `${pick(FEMALE_FIRST_NAMES)} ${pick(SURNAME_PAIRS)[1]}`,
        contactEmail: 'zajemce.seed@example.cz',
        contactPhone: '+420 601 000 111',
        source: 'Doporučení od stávajícího pěstouna',
        existingFosterStatus: 'neznamo',
        assignedTo: koUids[0],
        status: 'v_jednani',
        lastContactAt: isoDaysAgo(70),
        createdAt: isoDaysAgo(90),
      }),
    )

    console.log(`  Založeno ${familySeq} rodin, ${fosterSeq} pěstounů, ${childSeq} dětí.`)
  }

  console.log(`\nZapisuji celkem ${writes.length} dokumentů…`)
  await firestoreCommit(writes)

  console.log('\nHotovo. Přihlašovací údaje pro ruční testování (heslo pro všechny: ' + STAFF_PASSWORD + '):\n')
  for (const s of summary) {
    console.log(`  [${s.org}] ${s.role}: ${s.email}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
