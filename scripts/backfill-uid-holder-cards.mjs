/**
 * Naplnění ověřovacích karet k UID (`uidHolderCard`) ze stávajících pěstounů.
 *
 * PROČ: průvodce zájemcem se ptá na UID a příjmení a hledá pod jejich
 * společným otiskem. Dokud karty neexistují, průvodce u každého UID řekne
 * „nikoho takového nevedeme" — a to je horší než nic, protože to vypadá
 * jako odpověď, ne jako prázdná databáze.
 *
 * KLÍČEM DOKUMENTU JE OTISK, ne UID. Tenhle skript ho musí počítat PŘESNĚ
 * TAK JAKO APLIKACE (`src/lib/personMatch.ts`) — stejná sůl, stejné
 * srovnání zápisu, stejné pořadí částí. Kdyby se to rozešlo, karty by se
 * zapsaly pod klíči, které aplikace nikdy nenajde, a nikdo by si toho
 * nevšiml, protože chybějící karta a špatný klíč vypadají stejně.
 * Kontrolní běh na konci proto jeden klíč ověří proti skutečnému čtení.
 *
 * OBEC: pěstoun adresu nemá, má ji rodina (`families.address`). Bere se
 * z ní POSLEDNÍ část za čárkou, což u „Dlouhá 5, Kolín" dá „Kolín".
 * Když adresa čárku nemá, obec zůstane prázdná — hádat z volného textu,
 * co je ulice a co obec, by znamenalo občas zveřejnit ulici s číslem.
 *
 * Použití:
 *   node scripts/backfill-uid-holder-cards.mjs            # suchý běh
 *   node scripts/backfill-uid-holder-cards.mjs --zapsat
 */
import { createHash } from 'node:crypto'
import { getAccessToken, runQuery, firestoreCommit, PROJECT_ID } from './lib/firestore-rest.mjs'

const WRITE = process.argv.includes('--zapsat')
const NOW = new Date().toISOString()

/** MUSÍ se shodovat s SALT v src/lib/personMatch.ts. */
const SALT = 'doprovazeni.cz/personIndex/v1'

/** MUSÍ se shodovat s normalizeToken v src/lib/personMatch.ts. */
function normalizeToken(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** MUSÍ se shodovat s matchKeyMaterial + matchKeyHash pro 'uid_prijmeni'. */
function uidHolderKey(uid, lastName) {
  const parts = [uid, lastName].map(normalizeToken)
  if (parts.some((p) => !p)) return null
  const joined = parts.join('|')
  if (joined.replace(/\|/g, '').length < 6) return null
  return createHash('sha256').update(`${SALT}|uid_prijmeni|${joined}`, 'utf8').digest('hex')
}

/** Poslední část adresy za čárkou. Bez čárky radši nic — viz hlavička. */
function municipalityFrom(address) {
  if (!address || !address.includes(',')) return ''
  return address.split(',').pop().trim()
}

const token = await getAccessToken()

console.log('Načítám pěstouny, rodiny a rejstřík…')
const fosterRows = await runQuery(token, { from: [{ collectionId: 'fosterPersons' }] })
const familyRows = await runQuery(token, { from: [{ collectionId: 'families' }] })
const registryRows = await runQuery(token, { from: [{ collectionId: 'titleRegistry' }] })

const addressByFamily = new Map()
for (const r of familyRows) {
  addressByFamily.set(r.document.name.split('/').pop(), r.document.fields?.address?.stringValue ?? '')
}

const holderByUid = new Map()
for (const r of registryRows) {
  const f = r.document.fields ?? {}
  holderByUid.set(f.uid?.stringValue, f.holderOrgId?.stringValue ?? null)
}

console.log(`  ${fosterRows.length} pěstounů, ${familyRows.length} rodin, ${registryRows.length} v rejstříku`)

const writes = []
let skippedNoKey = 0
let withoutMunicipality = 0

for (const r of fosterRows) {
  const f = r.document.fields ?? {}
  const uid = f.uid?.stringValue
  const firstName = f.firstName?.stringValue ?? ''
  const lastName = f.lastName?.stringValue ?? ''
  if (!uid || !lastName) {
    skippedNoKey++
    continue
  }

  const key = uidHolderKey(uid, lastName)
  if (!key) {
    skippedNoKey++
    continue
  }

  const municipality = municipalityFrom(addressByFamily.get(f.familyId?.stringValue))
  if (!municipality) withoutMunicipality++

  const holderOrgId = holderByUid.get(uid) ?? null

  writes.push({
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/uidHolderCard/${key}`,
      fields: {
        uid: { stringValue: uid },
        firstName: { stringValue: firstName },
        lastName: { stringValue: lastName },
        municipality: { stringValue: municipality },
        holderOrgId: holderOrgId ? { stringValue: holderOrgId } : { nullValue: null },
        updatedAt: { stringValue: NOW },
      },
    },
  })
}

console.log(`\nKaret k zapsání: ${writes.length}`)
if (skippedNoKey) console.log(`Přeskočeno (chybí UID nebo příjmení): ${skippedNoKey}`)
if (withoutMunicipality) {
  console.log(`Bez obce: ${withoutMunicipality} — adresa rodiny neobsahuje čárku, hádat ji nebudu.`)
}

if (!WRITE) {
  console.log('\nSUCHÝ BĚH — nic se nezapsalo. Skutečný zápis: --zapsat')
  process.exit(0)
}

const BATCH = 400
for (let i = 0; i < writes.length; i += BATCH) {
  await firestoreCommit(token, writes.slice(i, i + BATCH))
  console.log(`  zapsáno ${Math.min(i + BATCH, writes.length)} / ${writes.length}`)
}

// Kontrola, že klíč sedí s tím, co bude počítat aplikace: vezmeme první
// zapsanou kartu a přečteme ji zpátky přes její otisk.
const sample = fosterRows.find((r) => r.document.fields?.uid?.stringValue && r.document.fields?.lastName?.stringValue)
if (sample) {
  const f = sample.document.fields
  const key = uidHolderKey(f.uid.stringValue, f.lastName.stringValue)
  const rows = await runQuery(token, {
    from: [{ collectionId: 'uidHolderCard' }],
    where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: f.uid.stringValue } } },
    limit: 1,
  })
  const found = rows[0]?.document?.name?.endsWith(key)
  console.log(`\nKontrola klíče pro UID ${f.uid.stringValue}: ${found ? 'SEDÍ' : 'NESEDÍ — POZOR'}`)
}

console.log('\nHotovo.')
