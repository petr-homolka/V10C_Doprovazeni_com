/**
 * Doplnění vyhledávacích otisků (`personIndex`) pro stávající pěstouny.
 *
 * PROČ: od 27. 7. se otisky zapisují při každém založení pěstouna. Bez
 * tohohle doběhu by index znal jen lidi založené OD TÉ CHVÍLE a u 453
 * stávajících by mlčky odpovídal „nenalezeno". Poloprázdný index je horší
 * než prázdný — vypadá, že funguje.
 *
 * Klíč musí být počítaný PŘESNĚ jako v `src/lib/personMatch.ts` (stejná
 * sůl, stejné srovnání zápisu, stejné pořadí částí). Kontrolní běh na konci
 * ověří jeden klíč zpětným čtením, protože špatný klíč a chybějící záznam
 * vypadají úplně stejně.
 *
 * Pěstoun nemá rodné číslo ani doklady — jediný složitelný klíč je tedy
 * JMÉNO + PŘÍJMENÍ + ADRESA (adresa je na rodině). Kdo adresu nemá,
 * přeskakuje se; hádat ji nelze.
 *
 * Použití:
 *   node scripts/backfill-person-index.mjs            # suchý běh
 *   node scripts/backfill-person-index.mjs --zapsat
 */
import { createHash } from 'node:crypto'
import { getAccessToken, runQuery, firestoreCommit, PROJECT_ID } from './lib/firestore-rest.mjs'

const WRITE = process.argv.includes('--zapsat')
const NOW = new Date().toISOString()

/** MUSÍ se shodovat se SALT v src/lib/personMatch.ts. */
const SALT = 'doprovazeni.cz/personIndex/v1'

function normalizeToken(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function matchKeyHash(kind, parts) {
  const normalized = parts.map(normalizeToken)
  if (normalized.some((p) => !p)) return null
  const joined = normalized.join('|')
  if (joined.replace(/\|/g, '').length < 6) return null
  return createHash('sha256').update(`${SALT}|${kind}|${joined}`, 'utf8').digest('hex')
}

const token = await getAccessToken()

console.log('Načítám pěstouny a rodiny…')
const fosterRows = await runQuery(token, { from: [{ collectionId: 'fosterPersons' }] })
const familyRows = await runQuery(token, { from: [{ collectionId: 'families' }] })

const addressByFamily = new Map()
for (const r of familyRows) {
  addressByFamily.set(r.document.name.split('/').pop(), r.document.fields?.address?.stringValue ?? '')
}
console.log(`  ${fosterRows.length} pěstounů, ${familyRows.length} rodin`)

const writes = []
let skipped = 0
let sampleKey = null

for (const r of fosterRows) {
  const f = r.document.fields ?? {}
  const uid = f.uid?.stringValue
  const firstName = f.firstName?.stringValue ?? ''
  const lastName = f.lastName?.stringValue ?? ''
  const address = addressByFamily.get(f.familyId?.stringValue) ?? ''

  const hash = uid && firstName && lastName && address
    ? matchKeyHash('jmeno_adresa', [firstName, lastName, address])
    : null

  if (!hash) {
    skipped++
    continue
  }
  if (!sampleKey) sampleKey = { hash, uid }

  writes.push({
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/personIndex/${hash}`,
      fields: {
        uid: { stringValue: uid },
        kind: { stringValue: 'jmeno_adresa' },
        createdAt: { stringValue: NOW },
        createdByOrgId: { stringValue: f.orgAccessList?.arrayValue?.values?.[0]?.stringValue ?? 'backfill' },
      },
    },
  })
}

console.log(`\nOtisků k zapsání: ${writes.length}`)
if (skipped) console.log(`Přeskočeno (chybí jméno nebo adresa rodiny): ${skipped}`)

if (!WRITE) {
  console.log('\nSUCHÝ BĚH — nic se nezapsalo. Skutečný zápis: --zapsat')
  process.exit(0)
}

const BATCH = 400
for (let i = 0; i < writes.length; i += BATCH) {
  await firestoreCommit(token, writes.slice(i, i + BATCH))
  console.log(`  zapsáno ${Math.min(i + BATCH, writes.length)} / ${writes.length}`)
}

if (sampleKey) {
  const rows = await runQuery(token, {
    from: [{ collectionId: 'personIndex' }],
    where: {
      fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: sampleKey.uid } },
    },
    limit: 1,
  })
  const ok = rows[0]?.document?.name?.endsWith(sampleKey.hash)
  console.log(`\nKontrola klíče: ${ok ? 'SEDÍ' : 'NESEDÍ — POZOR'}`)
}

console.log('\nHotovo.')
