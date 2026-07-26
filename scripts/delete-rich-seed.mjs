/**
 * Úklid duplicit po seedu `seed-rich-demo.mjs` (2026-07-25).
 *
 * Ten seed si vzal startovní čísla natvrdo místo z čítačů a vyrobil deset
 * rodin s uid, které už v demo-org existovalo. Tenhle skript ty rodiny
 * a všechno na nich navázané odstraní.
 *
 * Co maže: VÝHRADNĚ dokumenty, jejichž ID začíná `rich-`, plus obsah
 * podkolekcí pod `families/rich-fam-*`. Prefix je jediné kritérium —
 * žádné hádání podle jmen, adres ani dat.
 *
 * Firestore nemaže podkolekce spolu s rodičem, takže se každý dokument
 * vyjmenovává zvlášť; pořadí je odspoda nahoru (nejdřív obsah, pak rodič),
 * aby po případném přerušení nezůstal osiřelý obsah bez rodiče.
 *
 *   node scripts/delete-rich-seed.mjs             # suchý běh
 *   node scripts/delete-rich-seed.mjs --smazat    # skutečné mazání
 */
import { getAccessToken, runQuery, firestoreCommit, PROJECT_ID } from './lib/firestore-rest.mjs'

const DELETE = process.argv.includes('--smazat')
const PREFIX = 'rich-'
const FAMILY_PREFIX = 'families/rich-fam-'

const token = await getAccessToken()

/** Relativní cesta dokumentu (`families/rich-fam-1/timeline/abc`). */
function relPath(name) {
  return name.split('/documents/').slice(1).join('/documents/')
}

const targets = []

// 1) Obsah podkolekcí pod rodinami rich-fam-*
for (const coll of [
  'agreements', 'timeline', 'historyDigest', 'messages', 'documents',
  'respitEvents', 'assistedContactSeries', 'childHandovers', 'ippd',
]) {
  const rows = await runQuery(token, { from: [{ collectionId: coll, allDescendants: true }] })
  for (const r of rows.filter((x) => x.document)) {
    const path = relPath(r.document.name)
    if (path.startsWith(FAMILY_PREFIX)) targets.push({ group: `${coll} (pod rodinou)`, path })
  }
}

// 2) Kořenové dokumenty s prefixem rich-
for (const coll of ['children', 'fosterPersons', 'families']) {
  const rows = await runQuery(token, { from: [{ collectionId: coll, allDescendants: false }] })
  for (const r of rows.filter((x) => x.document)) {
    const path = relPath(r.document.name)
    if (path.split('/').pop().startsWith(PREFIX)) targets.push({ group: coll, path })
  }
}

// 3) Události a úkoly (žijí pod organizací, ne pod rodinou)
for (const coll of ['calendarEvents', 'tasks']) {
  const rows = await runQuery(token, { from: [{ collectionId: coll, allDescendants: true }] })
  for (const r of rows.filter((x) => x.document)) {
    const path = relPath(r.document.name)
    if (path.split('/').pop().startsWith(PREFIX)) targets.push({ group: coll, path })
  }
}

const byGroup = {}
for (const t of targets) byGroup[t.group] = (byGroup[t.group] ?? 0) + 1
for (const [group, count] of Object.entries(byGroup)) {
  console.log(`${group.padEnd(28)} ${count}`)
}
console.log(`\nCelkem ke smazání: ${targets.length}`)

if (!DELETE) {
  console.log('\nSUCHÝ BĚH — nic se nesmazalo. Skutečné mazání: --smazat')
  process.exit(0)
}

const BATCH = 400
for (let i = 0; i < targets.length; i += BATCH) {
  const chunk = targets.slice(i, i + BATCH).map(({ path }) => ({
    delete: `projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
  }))
  await firestoreCommit(token, chunk)
  console.log(`smazáno ${Math.min(i + BATCH, targets.length)}/${targets.length}`)
}
console.log('Hotovo.')
