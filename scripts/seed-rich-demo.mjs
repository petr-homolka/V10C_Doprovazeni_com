#!/usr/bin/env node
/**
 * Naplní ukázkovou organizaci `demo-org` bohatými, propojenými testovacími
 * daty PRO RUČNÍ TESTOVÁNÍ — pěstouni + děti s fotkami v avatarech, aktivní
 * Dohody (různí klíčoví pracovníci, různý stav návštěv → i "hoří" štítky),
 * zápisy v časové ose, události v kalendáři (s vazbami na osoby → překrývající
 * se avatary), úkoly a pár chatových zpráv.
 *
 * Přidává NOVOU vrstvu na existující demo-org data (neruší je) a dozadu
 * doplní fotky i k původním 5 pěstounům / 6 dětem. Idempotentní — pevná doc
 * ID, opětovné spuštění přepíše, nezduplikuje.
 *
 * Píše přes Firestore REST API (žádná nová závislost). Token si bere buď ze
 * `GOOGLE_APPLICATION_CREDENTIALS`, nebo z přihlášeného `gcloud` — viz
 * `lib/firestore-rest.mjs`. Díky tomu je jedna jediná verze skriptu, co
 * poběží lokálně i v prostředí bez gcloud (dřív existovaly dvě rozešlé
 * kopie a produkci naplnila ta neverzovaná).
 *
 * POZOR: zakládá NOVÁ data s pevnými ID `rich-fam-*`. Pokud chceš jen
 * doplnit chybějící fotky u dat, co už v databázi jsou, použij
 * `npm run backfill:avatars` — tenhle skript na to není.
 *
 * Spustit: `npm run seed:rich`
 * (Petr se pak přihlásí jako petr@doprovazeni.com / heslo123).
 */
import { getAccessToken, firestoreCommit, PROJECT_ID } from './lib/firestore-rest.mjs'

const ORG_ID = 'demo-org'
const ORG_CODE = '0001'

// KO/staff uids už v demo-org existují (viz seed-demo-org.mjs)
const KO_POOL = ['demo-ko', 'demo-asistent', 'demo-teamleader', 'demo-vedouci']
const STAFF_POOL = ['demo-ko', 'demo-asistent', 'demo-teamleader', 'demo-vedouci', 'demo-zamestnanec']

// ---- value encoding (mirror seed-demo-org.mjs) ---------------------------
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } }
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } }
  throw new Error(`Nepodporovaná hodnota: ${JSON.stringify(v)}`)
}
function toFields(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) { if (v !== undefined) fields[k] = toValue(v) }
  return fields
}
function writeDoc(path, data) {
  return { update: { name: `projects/${PROJECT_ID}/databases/(default)/documents/${path}`, fields: toFields(data) } }
}
// merge (only listed fields) — safe backfill onto pre-existing docs
function mergeDoc(path, data) {
  return {
    update: { name: `projects/${PROJECT_ID}/databases/(default)/documents/${path}`, fields: toFields(data) },
    updateMask: { fieldPaths: Object.keys(data) },
  }
}

// ---- uid (mirror src/lib/uid.ts) -----------------------------------------
const TYPE = { fosterPerson: '10', child: '20', agreement: '90', familyFile: '99' }
function ean13(twelve) {
  let s = 0
  for (let i = 0; i < 12; i++) s += i % 2 === 0 ? Number(twelve[i]) : Number(twelve[i]) * 3
  return (10 - (s % 10)) % 10
}
function buildUid(type, seq) {
  const b = `${TYPE[type]}${ORG_CODE}${String(seq).padStart(6, '0')}`
  return `${b}${ean13(b)}`
}

// ---- rodné číslo dělitelné 11 --------------------------------------------
function birthNumber(year, month, day, female, serial) {
  const yy = String(year % 100).padStart(2, '0')
  const mm = String(month + (female ? 50 : 0)).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  const base9 = `${yy}${mm}${dd}${String(serial).padStart(3, '0')}`
  for (let c = 0; c < 10; c++) if (Number(`${base9}${c}`) % 11 === 0) return `${base9.slice(0, 6)}/${base9.slice(6)}${c}`
  return birthNumber(year, month, day, female, serial + 1)
}

// ---- deterministic pseudo-random -----------------------------------------
let R = 987654321
const rnd = () => { R = (R * 1103515245 + 12345) & 0x7fffffff; return R / 0x7fffffff }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const iso = (d) => d.toISOString()
const daysAgo = (n) => new Date(Date.now() - n * 86400000)
const daysFromNow = (n) => new Date(Date.now() + n * 86400000)

// ---- name pools ----------------------------------------------------------
const SURNAMES = ['Svoboda', 'Černý', 'Kučera', 'Veselý', 'Horák', 'Němec', 'Pokorný', 'Marek', 'Král', 'Beneš', 'Fiala', 'Sedláček', 'Urban', 'Blažek', 'Kolář']
const MALE = ['Jan', 'Petr', 'Josef', 'Pavel', 'Martin', 'Tomáš', 'Jaroslav', 'Zdeněk', 'František', 'Karel', 'Lukáš', 'Michal', 'Jiří', 'David', 'Radek']
const FEMALE = ['Marie', 'Jana', 'Eva', 'Hana', 'Anna', 'Lenka', 'Kateřina', 'Lucie', 'Věra', 'Alena', 'Petra', 'Veronika', 'Zuzana', 'Tereza', 'Simona']
const KID_M = ['Adam', 'Jakub', 'Matěj', 'Vojtěch', 'Ondřej', 'Filip', 'Šimon', 'Dominik', 'Marek', 'Daniel', 'Tobiáš', 'Vít']
const KID_F = ['Eliška', 'Tereza', 'Natálie', 'Karolína', 'Kristýna', 'Aneta', 'Nela', 'Ema', 'Sofie', 'Viktorie', 'Adéla', 'Rozárie']
const femSurname = (s) => (s.endsWith('ý') ? s.slice(0, -1) + 'á' : s.endsWith('ek') ? s.slice(0, -2) + 'ková' : s.endsWith('a') ? s : s + 'ová')
const noDia = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const adultPhoto = (female, i) => `https://randomuser.me/api/portraits/${female ? 'women' : 'men'}/${i % 99}.jpg`
const kidPhoto = (i) => `https://i.pravatar.cc/300?img=${(i % 70) + 1}`

const NOTE_BODIES = [
  'Telefonicky domluvena návštěva na příští týden. Rodina bez potíží.',
  'Pěstounka informovala o zlepšení prospěchu ve škole.',
  'Řešili jsme přípravu na letní tábor pro děti.',
  'Kontrola bytových podmínek proběhla v pořádku.',
  'Dítě mělo obtížnější období, doporučena konzultace s psychologem.',
  'Proběhla konzultace ohledně kontaktu s biologickou rodinou.',
]
const EVENT_TITLES = ['Návštěva rodiny', 'Supervize', 'Případová konference', 'Konzultace s OSPOD', 'Doprovod k lékaři', 'Setkání s biologickou rodinou', 'Vzdělávací seminář', 'Příprava IPOD']
const KINDS = ['schuzka', 'supervize', 'jine']
const TASK_TITLES = ['Doplnit dokumentaci k Dohodě', 'Objednat vzdělávací kurz', 'Zavolat na OSPOD', 'Připravit podklady pro supervizi', 'Ověřit stav respitu', 'Zpracovat zprávu o průběhu pěstounské péče']
const STREETS = ['Nádražní', 'Hlavní', 'Zahradní', 'Polní', 'Lipová', 'Krátká', 'Školní', 'Nová']
const CITIES = ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Olomouc', 'Liberec', 'Hradec Králové']

// ---- build writes --------------------------------------------------------
const FAMILY_COUNT = 10
const writes = []
// continue sequences after existing demo-org maxima (family 4, foster 5, child 6, agreement 3)
let famSeq = 4, fpSeq = 5, chSeq = 6, agrSeq = 3, photo = 3
const families = []

for (let i = 1; i <= FAMILY_COUNT; i++) {
  const surname = SURNAMES[(i - 1) % SURNAMES.length]
  const famId = `rich-fam-${i}`
  const twoParents = rnd() > 0.45
  const created = iso(daysAgo(400 - i * 5))
  const fosterRefs = []
  const fosters = []

  // mother (primary) — její fotka slouží i jako fotka celé rodiny (appka
  // rodinu takhle už pojmenovává, viz `resolveFamilyDisplayName`)
  let primaryFosterPhoto
  {
    const id = `rich-fp-${i}-a`
    fpSeq++
    const by = 1955 + Math.floor(rnd() * 30)
    const first = pick(FEMALE), last = femSurname(surname)
    primaryFosterPhoto = adultPhoto(true, ++photo)
    writes.push(writeDoc(`fosterPersons/${id}`, {
      uid: buildUid('fosterPerson', fpSeq), orgAccessList: [ORG_ID], familyId: famId,
      firstName: first, lastName: last,
      phone: `+4207${Math.floor(10000000 + rnd() * 89999999)}`,
      email: noDia(`${first}.${last}@example.cz`.toLowerCase()),
      birthDate: `${by}-0${1 + Math.floor(rnd() * 8)}-1${Math.floor(rnd() * 8)}`,
      avatarUrl: primaryFosterPhoto, createdAt: created,
    }))
    fosterRefs.push(id); fosters.push(id)
  }
  if (twoParents) {
    const id = `rich-fp-${i}-b`
    fpSeq++
    const by = 1955 + Math.floor(rnd() * 30)
    const first = pick(MALE), last = surname
    writes.push(writeDoc(`fosterPersons/${id}`, {
      uid: buildUid('fosterPerson', fpSeq), orgAccessList: [ORG_ID], familyId: famId,
      firstName: first, lastName: last,
      phone: `+4207${Math.floor(10000000 + rnd() * 89999999)}`,
      email: noDia(`${first}.${last}@example.cz`.toLowerCase()),
      birthDate: `${by}-0${1 + Math.floor(rnd() * 8)}-1${Math.floor(rnd() * 8)}`,
      avatarUrl: adultPhoto(false, ++photo), createdAt: created,
    }))
    fosterRefs.push(id); fosters.push(id)
  }

  famSeq++
  writes.push(writeDoc(`families/${famId}`, {
    uid: buildUid('familyFile', famSeq), orgAccessList: [ORG_ID], fosterPersonRefs: fosterRefs,
    address: `${pick(STREETS)} ${1 + Math.floor(rnd() * 90)}, ${pick(CITIES)}`,
    avatarUrl: primaryFosterPhoto,
    partnerSharingDefault: true, createdAt: created, lastTouchAt: iso(daysAgo(Math.floor(rnd() * 30))),
  }))

  // agreement (doc id == orgId)
  const assignedTo = KO_POOL[(i - 1) % KO_POOL.length]
  const interval = pick([30, 60, 90])
  const visitMode = i % 3 // 0 recent, 1 overdue, 2 never
  const lastVisitAt = visitMode === 0 ? iso(daysAgo(Math.floor(interval / 3)))
    : visitMode === 1 ? iso(daysAgo(interval + 20 + Math.floor(rnd() * 40))) : null
  const careType = rnd() > 0.5 ? 'zprostredkovana' : 'nezprostredkovana'
  agrSeq++
  writes.push(writeDoc(`families/${famId}/agreements/${ORG_ID}`, {
    uid: buildUid('agreement', agrSeq), familyId: famId, organizationId: ORG_ID,
    careType, status: 'active', validFrom: iso(daysAgo(300 - i * 4)),
    validTo: i % 4 === 0 ? iso(daysFromNow(25)) : null, assignedTo,
    visitIntervalDays: interval, educationHoursTarget: careType === 'zprostredkovana' ? 24 : 18,
    noteDeadlineHours: 72, lastVisitAt, createdAt: iso(daysAgo(300 - i * 4)),
  }))

  // children
  const numKids = 1 + Math.floor(rnd() * 3)
  const kids = []
  for (let k = 1; k <= numKids; k++) {
    const female = rnd() > 0.5
    const first = female ? pick(KID_F) : pick(KID_M)
    const last = female ? femSurname(surname) : surname
    const year = 2011 + Math.floor(rnd() * 12), month = 1 + Math.floor(rnd() * 12), day = 1 + Math.floor(rnd() * 27)
    const id = `rich-ch-${i}-${k}`
    chSeq++
    writes.push(writeDoc(`children/${id}`, {
      uid: buildUid('child', chSeq), familyId: famId, organizationId: ORG_ID,
      firstName: first, lastName: last,
      birthNumber: birthNumber(year, month, day, female, 100 + Math.floor(rnd() * 800)),
      birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      avatarUrl: kidPhoto(++photo), createdAt: iso(daysAgo(300 - i * 4)),
    }))
    kids.push(id)
  }

  // timeline entries
  const noteCount = 2 + Math.floor(rnd() * 3)
  for (let n = 0; n < noteCount; n++) {
    const isVisit = n === 0 && visitMode !== 2
    const occurredAt = isVisit && lastVisitAt ? lastVisitAt : iso(daysAgo(Math.floor(rnd() * 120)))
    const subjectRefs = [{ kind: 'family', id: famId }]
    if (kids.length && rnd() > 0.4) subjectRefs.push({ kind: 'child', id: pick(kids) })
    else if (fosterRefs.length && rnd() > 0.5) subjectRefs.push({ kind: 'fosterPerson', id: pick(fosterRefs) })
    const entry = {
      type: isVisit ? 'visit' : 'note', createdByOrgId: ORG_ID, createdByUid: assignedTo,
      occurredAt, subjectRefs, sharingLevel: 'internal', body: pick(NOTE_BODIES),
    }
    if (isVisit) {
      const start = new Date(occurredAt), end = new Date(new Date(occurredAt).getTime() + 75 * 60000)
      entry.startedAt = iso(start); entry.endedAt = iso(end); entry.durationSeconds = 75 * 60
    }
    writes.push(writeDoc(`families/${famId}/timeline/rich-tl-${i}-${n}`, entry))
  }

  if (i <= 4) {
    writes.push(writeDoc(`families/${famId}/messages/rich-msg-${i}`, {
      createdByOrgId: ORG_ID, createdByUid: assignedTo, authorRole: 'staff', audience: 'foster',
      body: 'Dobrý den, posílám termín další návštěvy. Vyhovuje vám čtvrtek dopoledne?', createdAt: iso(daysAgo(5)),
    }))
  }

  families.push({ famId, famUid: buildUid('familyFile', famSeq), assignedTo, fosterRefs, kids })
}

// calendar events (with subjectRefs → overlapping avatars)
for (let e = 0; e < 18; e++) {
  const fam = families[e % families.length]
  const start = daysFromNow(-7 + Math.floor(rnd() * 28))
  start.setHours(8 + Math.floor(rnd() * 8), 0, 0, 0)
  const end = new Date(start.getTime() + (60 + Math.floor(rnd() * 3) * 30) * 60000)
  const subjectRefs = [{ kind: 'family', id: fam.famId }]
  if (fam.kids.length && rnd() > 0.5) subjectRefs.push({ kind: 'child', id: pick(fam.kids) })
  if (fam.fosterRefs.length && rnd() > 0.5) subjectRefs.push({ kind: 'fosterPerson', id: pick(fam.fosterRefs) })
  writes.push(writeDoc(`organizations/${ORG_ID}/calendarEvents/rich-ev-${e}`, {
    organizationId: ORG_ID, createdByUid: fam.assignedTo, assignedToUid: pick(STAFF_POOL),
    title: pick(EVENT_TITLES), kind: pick(KINDS), status: 'planovano',
    start: iso(start), end: iso(end), familyDocId: fam.famId, familyUid: fam.famUid,
    subjectRefs, notes: null, createdAt: iso(daysAgo(10)), updatedAt: iso(daysAgo(10)),
  }))
}

// tasks
for (let t = 0; t < 9; t++) {
  const fam = families[t % families.length]
  writes.push(writeDoc(`organizations/${ORG_ID}/tasks/rich-task-${t}`, {
    organizationId: ORG_ID, createdByUid: 'demo-ko', assignedToUid: pick(STAFF_POOL),
    title: pick(TASK_TITLES), notes: null,
    dueDate: t % 4 === 0 ? null : iso(daysFromNow(1 + Math.floor(rnd() * 20))).slice(0, 10),
    status: 'otevreny', subjectRefs: [{ kind: 'family', id: fam.famId }],
    createdAt: iso(daysAgo(3)), updatedAt: iso(daysAgo(3)),
  }))
}

// staff photos (MERGE onto users/{uid})
const staffPhotos = {
  'demo-ko': adultPhoto(true, 30), 'demo-asistent': adultPhoto(true, 31),
  'demo-teamleader': adultPhoto(false, 32), 'demo-vedouci': adultPhoto(true, 33),
  'demo-zamestnanec': adultPhoto(false, 34),
}
for (const [uid, url] of Object.entries(staffPhotos)) writes.push(mergeDoc(`users/${uid}`, { avatarUrl: url }))

// backfill avatars on pre-existing demo-org fosters/children (MERGE)
const fpAvatars = { 'demo-foster-1a': adultPhoto(true, 21), 'demo-foster-1b': adultPhoto(false, 22), 'demo-foster-2a': adultPhoto(true, 23), 'demo-foster-3a': adultPhoto(true, 24), 'demo-foster-3b': adultPhoto(false, 25) }
for (const [id, url] of Object.entries(fpAvatars)) writes.push(mergeDoc(`fosterPersons/${id}`, { avatarUrl: url }))
const existingKids = ['demo-child-1a', 'demo-child-1b', 'demo-child-2a', 'demo-child-3a', 'demo-child-3b', 'demo-child-3c']
existingKids.forEach((id, i) => writes.push(mergeDoc(`children/${id}`, { avatarUrl: kidPhoto(40 + i) })))

// counters (bump so live app writes don't collide)
const now = new Date().toISOString()
writes.push(mergeDoc(`counters/${ORG_ID}_99`, { organizationId: ORG_ID, entityType: 'familyFile', value: famSeq, updatedAt: now }))
writes.push(mergeDoc(`counters/${ORG_ID}_10`, { organizationId: ORG_ID, entityType: 'fosterPerson', value: fpSeq, updatedAt: now }))
writes.push(mergeDoc(`counters/${ORG_ID}_20`, { organizationId: ORG_ID, entityType: 'child', value: chSeq, updatedAt: now }))
writes.push(mergeDoc(`counters/${ORG_ID}_90`, { organizationId: ORG_ID, entityType: 'agreement', value: agrSeq, updatedAt: now }))

// ---- commit in chunks ----------------------------------------------------
async function main() {
  console.log(`Seeduji ${writes.length} dokumentů do ${ORG_ID}…`)
  const CHUNK = 300
  for (let i = 0; i < writes.length; i += CHUNK) {
    await firestoreCommit(writes.slice(i, i + CHUNK))
    console.log(`  commit ${Math.min(i + CHUNK, writes.length)}/${writes.length}`)
  }
  console.log(`HOTOVO. ${FAMILY_COUNT} nových rodin (rich-fam-1..${FAMILY_COUNT}) + události/úkoly/zápisy + fotky.`)
  console.log(`Countery: family=${famSeq} foster=${fpSeq} child=${chSeq} agreement=${agrSeq}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
