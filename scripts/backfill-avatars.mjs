#!/usr/bin/env node
/**
 * OPRAVNÝ průchod: doplní chybějící avatar u VŠECH entit dané organizace —
 * zaměstnanci (`users.avatarUrl`), rodiny, pěstouni, děti. Nemaže a nic
 * nepřepisuje: dotkne se jen dokumentů, kde avatar CHYBÍ.
 *
 * Proč existuje vedle `seed-rich-demo.mjs`: seed zakládá NOVÁ data
 * s deterministickými ID. Tenhle skript naopak spravuje data, co už
 * v databázi jsou (bez ohledu na to, jak vznikla — ručně v UI, starším
 * seedem, importem). Použij ho, když chceš jen "ať mají všichni fotku".
 *
 * Rodina dostane fotku svého PRIMÁRNÍHO pěstouna — appka rodinu takhle už
 * pojmenovává (`resolveFamilyDisplayName` padá zpět na jméno prvního
 * pěstouna), takže je to zavedená konvence, ne nová vymyšlenost.
 *
 * Spustit: `npm run backfill:avatars`
 *   - buď s přihlášeným `gcloud` (běžný případ),
 *   - nebo s `GOOGLE_APPLICATION_CREDENTIALS=<service-account.json>`.
 * Volitelně `SEED_ORG=<orgId>` (výchozí `demo-org`).
 */
import { getAccessToken, firestoreCommit, runQuery, PROJECT_ID } from './lib/firestore-rest.mjs'

const ORG = process.env.SEED_ORG ?? 'demo-org'
const adultPhoto = (female, i) => `https://randomuser.me/api/portraits/${female ? 'women' : 'men'}/${i % 99}.jpg`
const kidPhoto = (i) => `https://i.pravatar.cc/300?img=${(i % 70) + 1}`

// Ženská příjmení v ČJ končí na -á/-ová → slouží k volbě fotky, ne k ničemu jinému.
const looksFemale = (lastName = '') => /(á|ová)$/.test(lastName)

function mergeDoc(path, data) {
  const fields = {}
  for (const [k, v] of Object.entries(data)) fields[k] = { stringValue: v }
  return {
    update: { name: `projects/${PROJECT_ID}/databases/(default)/documents/${path}`, fields },
    updateMask: { fieldPaths: Object.keys(data) },
  }
}

const token = await getAccessToken()
const writes = []
let photo = 100

// ---- zaměstnanci -----------------------------------------------------------
const users = await runQuery(token, {
  from: [{ collectionId: 'users' }],
  where: { fieldFilter: { field: { fieldPath: 'organizationId' }, op: 'EQUAL', value: { stringValue: ORG } } },
})
let staffFixed = 0
for (const row of users) {
  const f = row.document?.fields ?? {}
  if (f.avatarUrl?.stringValue) continue
  const uid = row.document.name.split('/').pop()
  const name = f.displayName?.stringValue ?? ''
  const female = looksFemale(name.split(' ').pop() ?? '')
  writes.push(mergeDoc(`users/${uid}`, { avatarUrl: adultPhoto(female, ++photo) }))
  staffFixed++
}

// ---- pěstouni (a zapamatuj si fotku primárního pěstouna pro rodinu) --------
const fosters = await runQuery(token, {
  from: [{ collectionId: 'fosterPersons' }],
  where: { fieldFilter: { field: { fieldPath: 'orgAccessList' }, op: 'ARRAY_CONTAINS', value: { stringValue: ORG } } },
})
const fosterPhotoById = new Map()
let fosterFixed = 0
for (const row of fosters) {
  const f = row.document?.fields ?? {}
  const id = row.document.name.split('/').pop()
  const existing = f.avatarUrl?.stringValue
  if (existing) { fosterPhotoById.set(id, existing); continue }
  const female = looksFemale(f.lastName?.stringValue ?? '')
  const url = adultPhoto(female, ++photo)
  fosterPhotoById.set(id, url)
  writes.push(mergeDoc(`fosterPersons/${id}`, { avatarUrl: url }))
  fosterFixed++
}

// ---- děti ------------------------------------------------------------------
const kids = await runQuery(token, {
  from: [{ collectionId: 'children' }],
  where: { fieldFilter: { field: { fieldPath: 'organizationId' }, op: 'EQUAL', value: { stringValue: ORG } } },
})
let kidFixed = 0
for (const row of kids) {
  const f = row.document?.fields ?? {}
  if (f.avatarUrl?.stringValue) continue
  const id = row.document.name.split('/').pop()
  writes.push(mergeDoc(`children/${id}`, { avatarUrl: kidPhoto(++photo) }))
  kidFixed++
}

// ---- rodiny (fotka primárního pěstouna) ------------------------------------
const families = await runQuery(token, {
  from: [{ collectionId: 'families' }],
  where: { fieldFilter: { field: { fieldPath: 'orgAccessList' }, op: 'ARRAY_CONTAINS', value: { stringValue: ORG } } },
})
let famFixed = 0, famSkipped = 0
for (const row of families) {
  const f = row.document?.fields ?? {}
  if (f.avatarUrl?.stringValue) continue
  const id = row.document.name.split('/').pop()
  const refs = f.fosterPersonRefs?.arrayValue?.values ?? []
  const primary = refs[0]?.stringValue
  const url = primary && fosterPhotoById.get(primary)
  if (!url) { famSkipped++; continue } // rodina bez pěstouna — ikona je správnější než cizí fotka
  writes.push(mergeDoc(`families/${id}`, { avatarUrl: url }))
  famFixed++
}

console.log(`Doplňuji ${writes.length} avatarů v ${ORG}:`)
console.log(`  zaměstnanci=${staffFixed}  pěstouni=${fosterFixed}  děti=${kidFixed}  rodiny=${famFixed} (přeskočeno bez pěstouna: ${famSkipped})`)
if (!writes.length) { console.log('Nic k doplnění — všichni už fotku mají.'); process.exit(0) }

const CHUNK = 300
for (let i = 0; i < writes.length; i += CHUNK) {
  await firestoreCommit(token, writes.slice(i, i + CHUNK))
  console.log(`  commit ${Math.min(i + CHUNK, writes.length)}/${writes.length}`)
}
console.log('HOTOVO.')
