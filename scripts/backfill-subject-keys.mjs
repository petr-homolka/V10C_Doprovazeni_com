/**
 * Dopočítá `subjectKeys` u existujících kalendářních událostí A ÚKOLŮ.
 *
 * `subjectKeys` je denormalizace `subjectRefs` + `familyDocId` do plochého
 * pole `"kind:id"`, bez které nejde kalendář entity načíst zúženým dotazem
 * (Firestore neumí filtrovat podle pole uvnitř polí objektů). Události
 * založené před 2026-07-24 ji nemají — bez tohohle skriptu by se v profilu
 * rodiny/pěstouna/dítěte neobjevily vůbec.
 *
 * NEDESTRUKTIVNÍ: přepisuje jedno jediné pole, a jen tam, kde vypočítaná
 * hodnota nesouhlasí s uloženou. Zdroj pravdy zůstává `subjectRefs`.
 *
 * Spuštění (viz `scripts/lib/firestore-rest.mjs` pro obě varianty přihlášení):
 *   npm run backfill:subject-keys
 *   SEED_ORG=jina-org npm run backfill:subject-keys
 */
import { getAccessToken, firestoreCommit, runQuery } from './lib/firestore-rest.mjs'

const ORG = process.env.SEED_ORG ?? 'demo-org'

/** Stejná logika jako `buildSubjectKeys` v `src/lib/eventSubjects.ts`. */
function buildSubjectKeys(subjectRefs, familyDocId) {
  const keys = new Set()
  for (const ref of subjectRefs) {
    if (ref?.kind && ref?.id) keys.add(`${ref.kind}:${ref.id}`)
  }
  if (familyDocId) keys.add(`family:${familyDocId}`)
  return [...keys]
}

function readSubjectRefs(fields) {
  const values = fields.subjectRefs?.arrayValue?.values ?? []
  return values.map((v) => ({
    kind: v.mapValue?.fields?.kind?.stringValue,
    id: v.mapValue?.fields?.id?.stringValue,
  }))
}

const token = await getAccessToken()

/** Vrátí zápisy potřebné k dorovnání `subjectKeys` v jedné kolekci. */
async function collectWrites(collectionId) {
  // `allDescendants` je nutné — jde o PODkolekce organizace, dotaz
  // z kořene bez něj nenajde nic.
  const rows = await runQuery(token, { from: [{ collectionId, allDescendants: true }] })
  const writes = []
  let alreadyOk = 0
  for (const row of rows) {
    const doc = row.document
    if (!doc) continue
    // `runQuery` z kořene vrací i cizí organizace — filtrujeme podle cesty,
    // ať skript nikdy nezasáhne data jiné organizace.
    if (!doc.name.includes(`/organizations/${ORG}/${collectionId}/`)) continue
    const fields = doc.fields ?? {}
    // `familyDocId` má jen událost; úkol vazbu na rodinu nese výhradně
    // v `subjectRefs`, takže se prostě nenajde a nic nepřidá.
    const familyDocId = fields.familyDocId?.stringValue ?? null
    const wanted = buildSubjectKeys(readSubjectRefs(fields), familyDocId)
    const current = (fields.subjectKeys?.arrayValue?.values ?? []).map((v) => v.stringValue)
    const same = wanted.length === current.length && wanted.every((k) => current.includes(k))
    if (same) {
      alreadyOk++
      continue
    }
    writes.push({
      update: {
        name: doc.name,
        fields: { subjectKeys: { arrayValue: { values: wanted.map((k) => ({ stringValue: k })) } } },
      },
      updateMask: { fieldPaths: ['subjectKeys'] },
    })
  }
  console.log(`  ${collectionId}: v pořádku ${alreadyOk}, k doplnění ${writes.length}`)
  return writes
}

console.log(`Organizace ${ORG}:`)
const writes = [...(await collectWrites('calendarEvents')), ...(await collectWrites('tasks'))]
if (writes.length === 0) {
  console.log('Není co dělat.')
  process.exit(0)
}

// Firestore commit má limit 500 zápisů na dávku.
for (let i = 0; i < writes.length; i += 400) {
  const batch = writes.slice(i, i + 400)
  await firestoreCommit(token, batch)
  console.log(`  zapsáno ${Math.min(i + batch.length, writes.length)}/${writes.length}`)
}
console.log('HOTOVO')
