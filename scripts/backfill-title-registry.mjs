/**
 * Naplnění rejstříku obsazených UID (`titleRegistry`) ze stávajících Dohod.
 *
 * PROČ TO MUSÍ PROBĚHNOUT: kontrola výlučnosti právního titulu (metodika
 * MPSV — jedna osoba pečující, nejvýš jeden titul) čte VÝHRADNĚ rejstřík.
 * Dohody, které v databázi už jsou, v něm zatím nejsou vůbec, takže bez
 * tohohle skriptu by blokace nic neviděla a tvářila by se, že je všechno
 * volné. Blokace, která nic neblokuje, je horší než žádná — vypadá jako
 * záruka.
 *
 * Co dělá:
 *   1. Načte všechny Dohody (collection group, `allDescendants`).
 *   2. Ke každé dohledá rodinu a přes `fosterPersonRefs` UID pěstounů.
 *   3. Za každé UID zapíše JEDEN záznam. Když má osoba víc Dohod, vyhraje
 *      ta BĚŽÍCÍ; když neběží žádná, ta s nejpozdějším koncem.
 *
 * Bezpečnostní vlastnosti:
 * - Bez `--zapsat` jen počítá a vypíše, co by udělal.
 * - Nic nemaže a do žádné existující kolekce nesahá — píše jen do
 *   `titleRegistry`, která je nová.
 * - Vypíše KOLIZE: UID, které vychází obsazené u víc organizací zároveň.
 *   To jsou přesně případy, které metodika nepřipouští a které někdo musí
 *   projít ručně. Skript je NEŘEŠÍ — jen je ukáže, protože hádat, která
 *   z Dohod je ta správná, mu nepřísluší.
 *
 * Použití:
 *   node scripts/backfill-title-registry.mjs             # suchý běh
 *   node scripts/backfill-title-registry.mjs --zapsat
 */
import { getAccessToken, runQuery, firestoreCommit, PROJECT_ID } from './lib/firestore-rest.mjs'

const WRITE = process.argv.includes('--zapsat')
const NOW = new Date().toISOString()

/** Z plné Firestore cesty na relativní. Viz komentář v mark-test-data.mjs
 * — `/documents/` je v cestě dvakrát a naivní split míří na rodiče. */
function relPath(name) {
  return name.split('/documents/').slice(1).join('/documents/')
}

function str(fields, key) {
  return fields?.[key]?.stringValue ?? null
}

const token = await getAccessToken()

console.log('Načítám Dohody…')
const agreementRows = await runQuery(token, {
  from: [{ collectionId: 'agreements', allDescendants: true }],
})
console.log(`  ${agreementRows.length} Dohod`)

console.log('Načítám rodiny a pěstouny…')
const familyRows = await runQuery(token, { from: [{ collectionId: 'families' }] })
const fosterRows = await runQuery(token, { from: [{ collectionId: 'fosterPersons' }] })

/** familyDocId → [fosterPersonDocId] */
const fostersByFamily = new Map()
for (const r of familyRows) {
  const id = r.document.name.split('/').pop()
  const refs = (r.document.fields?.fosterPersonRefs?.arrayValue?.values ?? []).map((v) => v.stringValue)
  fostersByFamily.set(id, refs)
}

/** fosterPersonDocId → uid */
const uidByFoster = new Map()
for (const r of fosterRows) {
  const id = r.document.name.split('/').pop()
  const uid = str(r.document.fields, 'uid')
  if (uid) uidByFoster.set(id, uid)
}
console.log(`  ${familyRows.length} rodin, ${uidByFoster.size} pěstounů s UID`)

/** uid → kandidátní záznamy */
const candidates = new Map()

for (const r of agreementRows) {
  const f = r.document.fields ?? {}
  const path = relPath(r.document.name) // families/{familyId}/agreements/{orgId}
  const familyDocId = path.split('/')[1]
  const organizationId = str(f, 'organizationId')
  const validFrom = str(f, 'validFrom')
  const validTo = str(f, 'validTo')
  if (!organizationId || !validFrom) continue

  for (const fosterId of fostersByFamily.get(familyDocId) ?? []) {
    const uid = uidByFoster.get(fosterId)
    if (!uid) continue
    if (!candidates.has(uid)) candidates.set(uid, [])
    candidates.get(uid).push({ organizationId, validFrom, validTo, familyDocId })
  }
}

const running = (c) => !c.validTo || c.validTo > NOW

const writes = []
const collisions = []

for (const [uid, list] of candidates) {
  const live = list.filter(running)
  if (live.length > 1) {
    const orgs = [...new Set(live.map((c) => c.organizationId))]
    if (orgs.length > 1) collisions.push({ uid, orgs })
  }

  // Běžící má přednost; jinak ta, co skončila nejpozději.
  const chosen =
    live[0] ?? [...list].sort((a, b) => String(b.validTo ?? '').localeCompare(String(a.validTo ?? '')))[0]
  if (!chosen) continue

  writes.push({
    update: {
      name: `projects/${PROJECT_ID}/databases/(default)/documents/titleRegistry/${uid}`,
      fields: {
        uid: { stringValue: uid },
        holderOrgId: { stringValue: chosen.organizationId },
        externalSubjectName: { nullValue: null },
        validFrom: { stringValue: chosen.validFrom },
        validTo: chosen.validTo ? { stringValue: chosen.validTo } : { nullValue: null },
        updatedAt: { stringValue: NOW },
        updatedByOrgId: { stringValue: chosen.organizationId },
      },
    },
  })
}

console.log(`\nUID k zapsání do rejstříku: ${writes.length}`)

if (collisions.length) {
  console.log(`\n⚠️  KOLIZE — ${collisions.length} UID vychází obsazených u víc organizací zároveň.`)
  console.log('    Metodika MPSV tohle nepřipouští; skript vybere jednu a zbytek NECHÁ BÝT.')
  console.log('    Projít ručně:')
  for (const c of collisions.slice(0, 25)) console.log(`      ${c.uid}  →  ${c.orgs.join(', ')}`)
  if (collisions.length > 25) console.log(`      … a dalších ${collisions.length - 25}`)
} else {
  console.log('Žádné kolize — každé UID vychází nejvýš u jedné organizace.')
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
console.log('\nHotovo.')
