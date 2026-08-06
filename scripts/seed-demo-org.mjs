#!/usr/bin/env node
/**
 * Založí (nebo přepíše, běh je idempotentní) ukázkovou organizaci s
 * reálnými daty pro vizuální náhled appky — M3 příprava, 2026-07-19.
 *
 * Zakládá i JEDEN reálný Firebase Auth účet (`petr@doprovazeni.com` /
 * `heslo123`) s `devRolePreview: true` na jeho `users/{uid}` dokumentu —
 * to je jediný účet v systému, co smí v UI (AccountMenu) přepínat
 * KLIENT-SIDE zobrazovanou roli mezi všemi STAFF_ROLES, aby šlo rychle
 * posoudit vzhled appky z pohledu superadmina/org_admina/vedení/klíčové
 * osoby/… beze zakládání dalších účtů. Skutečná role v dokumentu (a tedy
 * i skutečná firestore.rules oprávnění) zůstává `org_admin` — viz
 * AuthContext.tsx pro to, jak přepínání funguje.
 *
 * Nepoužívá firebase-admin SDK (žádná nová závislost) — píše přímo přes
 * Firestore/Identity Toolkit REST API, autentizováno access tokenem z
 * `gcloud auth print-access-token` (obchází firestore.rules stejně jako
 * `firebase firestore:delete`, vhodné jen pro tenhle druh administrativního
 * seedování, nikdy pro běžné zápisy appky samotné).
 *
 * Spustit: `npm run seed:demo` (potřebuje `gcloud`/`firebase` CLI
 * přihlášené s právy na v10c-doprovazeni-com).
 */
import { execSync } from 'node:child_process'

const PROJECT_ID = 'v10c-doprovazeni-com'
const API_KEY = 'AIzaSyDz6xGFDn77R0knZSJvD5iqQHwsFJh_aJc'
const PETR_EMAIL = 'petr@doprovazeni.com'
const PETR_PASSWORD = 'heslo123'

const ORG_ID = 'demo-org'
const ORG_CODE = '0001'

function accessToken() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
}

async function firestoreCommit(writes) {
  const token = accessToken()
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-goog-user-project': PROJECT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ writes }),
    },
  )
  const body = await res.json()
  if (!res.ok) throw new Error(`Firestore commit selhal: ${JSON.stringify(body)}`)
  return body
}

async function ensurePetrAuthAccount() {
  const signUp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: PETR_EMAIL, password: PETR_PASSWORD, returnSecureToken: true }),
    },
  )
  const signUpBody = await signUp.json()
  if (signUp.ok) return signUpBody.localId

  if (signUpBody.error?.message !== 'EMAIL_EXISTS') {
    throw new Error(`Založení Petrova účtu selhalo: ${JSON.stringify(signUpBody)}`)
  }
  const signIn = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: PETR_EMAIL, password: PETR_PASSWORD, returnSecureToken: true }),
    },
  )
  const signInBody = await signIn.json()
  if (!signIn.ok) throw new Error(`Přihlášení k existujícímu Petrovu účtu selhalo: ${JSON.stringify(signInBody)}`)
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
  if (typeof v === 'number') return { integerValue: String(v) }
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

async function main() {
  console.log('Zakládám/aktualizuji Petrův Auth účet…')
  const petrUid = await ensurePetrAuthAccount()
  console.log(`  petrUid = ${petrUid}`)

  const now = new Date().toISOString()
  const isoMonthsAgo = (months) => {
    const d = new Date()
    d.setMonth(d.getMonth() - months)
    return d.toISOString()
  }

  const F1 = 'demo-family-1'
  const F2 = 'demo-family-2'
  const F3 = 'demo-family-3'

  const writes = [
    // ---- Organizace ----
    writeDoc(`organizations/${ORG_ID}`, {
      orgCode: ORG_CODE,
      name: 'Ukázková organizace',
      createdByUid: petrUid,
      createdAt: isoMonthsAgo(24),
      capacityWarningThreshold: 25,
    }),
    writeDoc('systemCounters/orgCode', { value: 1, updatedAt: now }),

    // ---- Uživatelé (Petr = reálný Auth účet, ostatní jen pro zobrazení) ----
    writeDoc(`users/${petrUid}`, {
      uid: petrUid,
      role: 'org_admin',
      displayName: 'Petr Homolka',
      email: PETR_EMAIL,
      organizationId: ORG_ID,
      devRolePreview: true,
      createdAt: isoMonthsAgo(24),
    }),
    writeDoc('users/demo-vedouci', {
      uid: 'demo-vedouci',
      role: 'vedouci_pobocky',
      displayName: 'Věra Vedoucí',
      email: 'vera.vedouci@ukazkova-org.cz',
      organizationId: ORG_ID,
      createdAt: isoMonthsAgo(20),
    }),
    writeDoc('users/demo-teamleader', {
      uid: 'demo-teamleader',
      role: 'teamleader',
      displayName: 'Tomáš Teamleader',
      email: 'tomas.teamleader@ukazkova-org.cz',
      organizationId: ORG_ID,
      createdAt: isoMonthsAgo(18),
    }),
    writeDoc('users/demo-ko', {
      uid: 'demo-ko',
      role: 'klicova_osoba',
      displayName: 'Jana Klíčová',
      email: 'jana.klicova@ukazkova-org.cz',
      organizationId: ORG_ID,
      createdAt: isoMonthsAgo(18),
    }),
    writeDoc('users/demo-asistent', {
      uid: 'demo-asistent',
      role: 'asistent_ko',
      displayName: 'Alena Asistentka',
      email: 'alena.asistentka@ukazkova-org.cz',
      organizationId: ORG_ID,
      createdAt: isoMonthsAgo(12),
    }),
    writeDoc('users/demo-zamestnanec', {
      uid: 'demo-zamestnanec',
      role: 'zamestnanec',
      displayName: 'Zdeněk Zaměstnanec',
      email: 'zdenek.zamestnanec@ukazkova-org.cz',
      organizationId: ORG_ID,
      createdAt: isoMonthsAgo(6),
    }),

    // ---- Rodina 1: Dvořákovi (zprostředkovaná péče, 2 pěstouni, 2 děti) ----
    writeDoc(`families/${F1}`, {
      uid: buildUid('familyFile', ORG_CODE, 1),
      orgAccessList: [ORG_ID],
      fosterPersonRefs: ['demo-foster-1a', 'demo-foster-1b'],
      address: 'Hlavní 12, Praha 5',
      createdAt: isoMonthsAgo(14),
    }),
    writeDoc('fosterPersons/demo-foster-1a', {
      uid: buildUid('fosterPerson', ORG_CODE, 1),
      orgAccessList: [ORG_ID],
      familyId: F1,
      firstName: 'Marie',
      lastName: 'Dvořáková',
      phone: '+420 601 123 456',
      email: 'marie.dvorakova@email.cz',
      createdAt: isoMonthsAgo(14),
    }),
    writeDoc('fosterPersons/demo-foster-1b', {
      uid: buildUid('fosterPerson', ORG_CODE, 2),
      orgAccessList: [ORG_ID],
      familyId: F1,
      firstName: 'Petr',
      lastName: 'Dvořák',
      phone: '+420 601 123 457',
      createdAt: isoMonthsAgo(14),
    }),
    writeDoc('children/demo-child-1a', {
      uid: buildUid('child', ORG_CODE, 1),
      familyId: F1,
      organizationId: ORG_ID,
      firstName: 'Eliška',
      lastName: 'Dvořáková',
      birthNumber: '145623/1234',
      createdAt: isoMonthsAgo(14),
    }),
    writeDoc('children/demo-child-1b', {
      uid: buildUid('child', ORG_CODE, 2),
      familyId: F1,
      organizationId: ORG_ID,
      firstName: 'Jakub',
      lastName: 'Dvořák',
      birthNumber: '162045/5678',
      createdAt: isoMonthsAgo(14),
    }),
    writeDoc(`families/${F1}/agreements/${ORG_ID}`, {
      uid: buildUid('agreement', ORG_CODE, 1),
      familyId: F1,
      organizationId: ORG_ID,
      careType: 'zprostredkovana',
      status: 'active',
      validFrom: isoMonthsAgo(14),
      validTo: null,
      assignedTo: 'demo-ko',
      visitIntervalDays: 60,
      educationHoursTarget: 24,
      noteDeadlineHours: 72,
      createdAt: isoMonthsAgo(14),
    }),

    // ---- Rodina 2: Novotná (nezprostředkovaná/příbuzenská péče, 1 pěstounka, 1 dítě) ----
    writeDoc(`families/${F2}`, {
      uid: buildUid('familyFile', ORG_CODE, 2),
      orgAccessList: [ORG_ID],
      fosterPersonRefs: ['demo-foster-2a'],
      address: 'Nádražní 45, Brno',
      createdAt: isoMonthsAgo(4),
    }),
    writeDoc('fosterPersons/demo-foster-2a', {
      uid: buildUid('fosterPerson', ORG_CODE, 3),
      orgAccessList: [ORG_ID],
      familyId: F2,
      firstName: 'Lenka',
      lastName: 'Novotná',
      phone: '+420 602 234 567',
      email: 'lenka.novotna@email.cz',
      createdAt: isoMonthsAgo(4),
    }),
    writeDoc('children/demo-child-2a', {
      uid: buildUid('child', ORG_CODE, 3),
      familyId: F2,
      organizationId: ORG_ID,
      firstName: 'Tomáš',
      lastName: 'Novotný',
      birthNumber: '183012/9012',
      createdAt: isoMonthsAgo(4),
    }),
    writeDoc(`families/${F2}/agreements/${ORG_ID}`, {
      uid: buildUid('agreement', ORG_CODE, 2),
      familyId: F2,
      organizationId: ORG_ID,
      careType: 'nezprostredkovana',
      status: 'active',
      validFrom: isoMonthsAgo(4),
      validTo: null,
      assignedTo: 'demo-ko',
      visitIntervalDays: 60,
      educationHoursTarget: 18,
      noteDeadlineHours: 72,
      createdAt: isoMonthsAgo(4),
    }),

    // ---- Rodina 3: Procházkovi (zprostředkovaná péče, 2 pěstouni, 3 děti) ----
    writeDoc(`families/${F3}`, {
      uid: buildUid('familyFile', ORG_CODE, 3),
      orgAccessList: [ORG_ID],
      fosterPersonRefs: ['demo-foster-3a', 'demo-foster-3b'],
      address: 'Zahradní 8, Ostrava',
      createdAt: isoMonthsAgo(22),
    }),
    writeDoc('fosterPersons/demo-foster-3a', {
      uid: buildUid('fosterPerson', ORG_CODE, 4),
      orgAccessList: [ORG_ID],
      familyId: F3,
      firstName: 'Kateřina',
      lastName: 'Procházková',
      phone: '+420 603 345 678',
      email: 'katerina.prochazkova@email.cz',
      createdAt: isoMonthsAgo(22),
    }),
    writeDoc('fosterPersons/demo-foster-3b', {
      uid: buildUid('fosterPerson', ORG_CODE, 5),
      orgAccessList: [ORG_ID],
      familyId: F3,
      firstName: 'Milan',
      lastName: 'Procházka',
      phone: '+420 603 345 679',
      createdAt: isoMonthsAgo(22),
    }),
    writeDoc('children/demo-child-3a', {
      uid: buildUid('child', ORG_CODE, 4),
      familyId: F3,
      organizationId: ORG_ID,
      firstName: 'Anna',
      lastName: 'Procházková',
      birthNumber: '095518/3344',
      createdAt: isoMonthsAgo(22),
    }),
    writeDoc('children/demo-child-3b', {
      uid: buildUid('child', ORG_CODE, 5),
      familyId: F3,
      organizationId: ORG_ID,
      firstName: 'Filip',
      lastName: 'Procházka',
      birthNumber: '112233/5566',
      createdAt: isoMonthsAgo(22),
    }),
    writeDoc('children/demo-child-3c', {
      uid: buildUid('child', ORG_CODE, 6),
      familyId: F3,
      organizationId: ORG_ID,
      firstName: 'Barbora',
      lastName: 'Procházková',
      birthNumber: '134455/7788',
      createdAt: isoMonthsAgo(22),
    }),
    writeDoc(`families/${F3}/agreements/${ORG_ID}`, {
      uid: buildUid('agreement', ORG_CODE, 3),
      familyId: F3,
      organizationId: ORG_ID,
      careType: 'zprostredkovana',
      status: 'active',
      validFrom: isoMonthsAgo(22),
      validTo: null,
      assignedTo: 'demo-asistent',
      visitIntervalDays: 60,
      educationHoursTarget: 24,
      noteDeadlineHours: 72,
      createdAt: isoMonthsAgo(22),
    }),

    // ---- Čítače — musí odrážet co jsme právě přidělili, ať budoucí
    // skutečné zápisy (přes appku) nekolidují se seedovanými UID.
    writeDoc(`counters/${ORG_ID}_99`, { organizationId: ORG_ID, entityType: 'familyFile', value: 3, updatedAt: now }),
    writeDoc(`counters/${ORG_ID}_10`, { organizationId: ORG_ID, entityType: 'fosterPerson', value: 5, updatedAt: now }),
    writeDoc(`counters/${ORG_ID}_20`, { organizationId: ORG_ID, entityType: 'child', value: 6, updatedAt: now }),
    writeDoc(`counters/${ORG_ID}_90`, { organizationId: ORG_ID, entityType: 'agreement', value: 3, updatedAt: now }),
  ]

  console.log(`Zapisuji ${writes.length} dokumentů…`)
  await firestoreCommit(writes)
  console.log('Hotovo. Přihlášení pro náhled: petr@doprovazeni.com / heslo123')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
