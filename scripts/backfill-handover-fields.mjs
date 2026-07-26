/**
 * Doplnění polí, na kterých stojí předávání pěstounů mezi organizacemi.
 *
 * 1. `titleRegistry` — `releasedAt` / `releasedByOrgId`.
 *    Bez nich pravidlo `resource.data.releasedAt != null` naráží na
 *    neexistující pole a vyhodnotí se jako NEPOVOLENO. To je sice bezpečný
 *    směr (nic se nepřevezme), ale znamenalo by to, že žádný pěstoun nejde
 *    uvolnit, dokud se pole nedoplní.
 *
 * 2. `orgDirectory` — kostra vizitky pro každou organizaci.
 *    Bez vizitky uvidí nová organizace „pěstoun patří jinam, ale nemáme
 *    na ně kontakt" a postup skončí. Skript založí kostru s NÁZVEM
 *    organizace; telefon a e-mail zůstávají PRÁZDNÉ, protože si je nemám
 *    kde vzít a vymyslet je nesmím. Doplní je org_admin v Nastavení.
 *
 * Použití:
 *   node scripts/backfill-handover-fields.mjs             # suchý běh
 *   node scripts/backfill-handover-fields.mjs --zapsat
 */
import { getAccessToken, runQuery, firestoreCommit, PROJECT_ID } from './lib/firestore-rest.mjs'

const WRITE = process.argv.includes('--zapsat')
const NOW = new Date().toISOString()
const docPath = (p) => `projects/${PROJECT_ID}/databases/(default)/documents/${p}`

const token = await getAccessToken()

// ── 1. titleRegistry ──────────────────────────────────────────────────
const registryRows = await runQuery(token, { from: [{ collectionId: 'titleRegistry' }] })
const needField = registryRows.filter((r) => !('releasedAt' in (r.document.fields ?? {})))
console.log(`titleRegistry: ${registryRows.length} záznamů, ${needField.length} bez pole o uvolnění`)

const writes = needField.map((r) => ({
  update: {
    name: r.document.name,
    fields: { releasedAt: { nullValue: null }, releasedByOrgId: { nullValue: null } },
  },
  // Jen tahle dvě pole. Nic jiného se nemůže přepsat, i kdyby ve skriptu
  // byla chyba — stejná pojistka jako u mark-test-data.mjs.
  updateMask: { fieldPaths: ['releasedAt', 'releasedByOrgId'] },
}))

// ── 2. orgDirectory ───────────────────────────────────────────────────
const orgRows = await runQuery(token, { from: [{ collectionId: 'organizations' }] })
const cardRows = await runQuery(token, { from: [{ collectionId: 'orgDirectory' }] })
const haveCard = new Set(cardRows.map((r) => r.document.name.split('/').pop()))

const missingCards = orgRows.filter((r) => !haveCard.has(r.document.name.split('/').pop()))
console.log(`orgDirectory: ${orgRows.length} organizací, ${missingCards.length} bez vizitky`)

for (const r of missingCards) {
  const orgId = r.document.name.split('/').pop()
  const name = r.document.fields?.name?.stringValue ?? orgId
  writes.push({
    update: {
      name: docPath(`orgDirectory/${orgId}`),
      fields: {
        organizationId: { stringValue: orgId },
        name: { stringValue: name },
        contactPersonName: { stringValue: '' },
        phone: { stringValue: '' },
        email: { stringValue: '' },
        updatedAt: { stringValue: NOW },
        updatedByUid: { stringValue: 'backfill' },
      },
    },
  })
}

console.log(`\nCelkem zápisů: ${writes.length}`)
if (missingCards.length) {
  console.log('POZOR: vizitky se zakládají jen s názvem. Telefon a e-mail musí doplnit')
  console.log('       org_admin — vymyslet je nesmím a prázdná vizitka se hlásí jako chybějící.')
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
