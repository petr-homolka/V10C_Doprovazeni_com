/**
 * Zpětné označení existujících dat jako TESTOVACÍCH (`dataClass: 'test'`).
 *
 * Proč: retenční a archivační pravidla (30 let u dokumentace o dítěti, viz
 * src/lib/retentionPolicy.ts) platí pro OSTRÁ data. Dokud v databázi není
 * značka, nejde po čase poznat, co je zkušební spis a co skutečný —
 * a ten, kdo to bude řešit, bude hádat.
 *
 * Bezpečnostní vlastnosti, které stojí za zmínku:
 * - `updateMask` s jediným polem: zapisuje se VÝHRADNĚ `dataClass`.
 *   Žádné jiné pole se nemůže omylem přepsat, i kdyby ve skriptu byla
 *   chyba.
 * - Bez `--zapsat` skript jen POČÍTÁ a vypíše, čeho by se to týkalo.
 * - Označení je vratné (pole se dá zase odebrat) a nic nemaže.
 *
 * Použití:
 *   node scripts/mark-test-data.mjs                 # suchý běh
 *   node scripts/mark-test-data.mjs --zapsat        # skutečný zápis
 *   node scripts/mark-test-data.mjs --zapsat --org demo-org
 */
import { getAccessToken, runQuery, firestoreCommit, PROJECT_ID } from './lib/firestore-rest.mjs'

const WRITE = process.argv.includes('--zapsat')
const orgArgIndex = process.argv.indexOf('--org')
const ONLY_ORG = orgArgIndex >= 0 ? process.argv[orgArgIndex + 1] : null

/**
 * Kolekce, které nesou data o rodinách a lidech. `allDescendants` u
 * podkolekcí — bez toho je collection-group dotaz vrátí prázdné (chyba,
 * kterou jsem tady v projektu už jednou udělal).
 */
const COLLECTIONS = [
  { id: 'families', descendants: false },
  { id: 'children', descendants: false },
  { id: 'fosterPersons', descendants: false },
  { id: 'fosterProspects', descendants: false },
  { id: 'external_participants', descendants: false },
  { id: 'agreements', descendants: true },
  { id: 'timeline', descendants: true },
  { id: 'historyDigest', descendants: true },
  { id: 'messages', descendants: true },
  { id: 'documents', descendants: true },
  { id: 'calendarEvents', descendants: true },
  { id: 'tasks', descendants: true },
  { id: 'respitEvents', descendants: true },
  { id: 'supportExpenses', descendants: true },
  { id: 'childHandovers', descendants: true },
  { id: 'ippd', descendants: true },
]

const token = await getAccessToken()

let totalSeen = 0
let totalToMark = 0
const writes = []

for (const { id, descendants } of COLLECTIONS) {
  let rows
  try {
    rows = await runQuery(token, { from: [{ collectionId: id, allDescendants: descendants }] })
  } catch (error) {
    console.log(`${id.padEnd(22)} — dotaz selhal (${error.message ?? error}), přeskakuji`)
    continue
  }
  const docs = rows.filter((r) => r.document)
  const relevant = ONLY_ORG
    ? docs.filter((r) => {
        const f = r.document.fields ?? {}
        const direct = f.organizationId?.stringValue
        const viaList = (f.orgAccessList?.arrayValue?.values ?? []).some((v) => v.stringValue === ONLY_ORG)
        return direct === ONLY_ORG || viaList
      })
    : docs
  const missing = relevant.filter((r) => r.document.fields?.dataClass?.stringValue !== 'test')

  totalSeen += relevant.length
  totalToMark += missing.length
  console.log(`${id.padEnd(22)} nalezeno ${String(relevant.length).padStart(5)}   k označení ${missing.length}`)

  for (const r of missing) {
    // POZOR na `/documents/`: v plné cestě je DVAKRÁT — jednou jako kořen
    // Firestore (`.../databases/(default)/documents/…`) a podruhé jako
    // název naší podkolekce (`families/{id}/documents/{docId}`). Naivní
    // `split('/documents/')[1]` proto u dokumentů rodiny vrátil
    // `families/{id}` a zápis mířil na RODIČE, ne na cílový dokument.
    // Odřízne se tedy jen PRVNÍ výskyt a zbytek se poskládá zpátky.
    const parts = r.document.name.split('/documents/')
    const path = parts.slice(1).join('/documents/')
    writes.push({
      update: {
        name: `projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
        fields: { dataClass: { stringValue: 'test' } },
      },
      updateMask: { fieldPaths: ['dataClass'] },
    })
  }
}

console.log(`\nCelkem prohlédnuto: ${totalSeen}, k označení: ${totalToMark}`)

if (!WRITE) {
  console.log('\nSUCHÝ BĚH — nic se nezapsalo. Skutečný zápis: --zapsat')
  process.exit(0)
}

// Firestore commit bere max 500 zápisů na dávku.
const BATCH = 400
for (let i = 0; i < writes.length; i += BATCH) {
  const chunk = writes.slice(i, i + BATCH)
  await firestoreCommit(token, chunk)
  console.log(`zapsáno ${Math.min(i + BATCH, writes.length)}/${writes.length}`)
}
console.log('Hotovo.')
