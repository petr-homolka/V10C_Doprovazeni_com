/**
 * Převod stávajících spisů do PRÁVNÍ ROVINY (`custodyAssignments`,
 * `agreementSubjects`).
 *
 * PROČ TO MUSÍ PROBĚHNOUT: právní rovina od 27. 7. existuje — má typy,
 * pravidla, službu i obrazovku na profilu dítěte. Jenže je PRÁZDNÁ.
 * Prázdná právní rovina je horší než žádná: obrazovka u každého dítěte
 * hlásí „není zapsané žádné svěření", což vypadá jako chyba v datech,
 * a všechno, co by se na svěření mělo vázat, by se muselo dál domýšlet
 * z toho, kdo je v rodině zapsaný — tedy přesně to, kvůli čemu právní
 * rovina vznikla.
 *
 * ─── CO SE DÁ ODVODIT A CO NE ─────────────────────────────────────────
 *
 * ODVODIT SE DÁ: kdo o koho pečuje. Dítě má `familyId`, rodina má
 * `fosterPersonRefs`. Tahle informace je v systému spolehlivá — pracuje
 * se s ní denně.
 *
 * ODVODIT SE NEDÁ:
 *   • ROZHODNUTÍ SOUDU. Spisová značka ani soud v systému nikdy nebyly.
 *     Zapisuje se `courtDecisionId: null` a UI to hlásí jako „doplnit".
 *     Vymýšlet číslo jednací nesmím ani náhodou.
 *   • DATUM SVĚŘENÍ. Odhaduje se začátkem nejstarší Dohody rodiny —
 *     doprovázet se dá jen péče, která už běží, takže svěření bylo
 *     nejpozději tehdy. Je to horní mez, ne skutečnost, a značí se
 *     `validFromIsEstimate: true`.
 *   • FORMA PÉČE. Dva pěstouni v domácnosti = `spolecna`, jeden =
 *     `vyhradni`. Střídavou péči z dat poznat nejde, takže se nikdy
 *     nezapíše — kdo ji má, musí ji opravit ručně.
 *
 * ─── BEZPEČNOSTNÍ VLASTNOSTI ──────────────────────────────────────────
 *
 * - Bez `--zapsat` jen počítá a vypíše, co by udělal.
 * - NIC NEMAŽE A NIC NEPŘEPISUJE. Píše jen do dvou nových kolekcí.
 * - JE IDEMPOTENTNÍ. Document ID je odvozené (`migr-{childId}`) a děti,
 *   které už svěření mají — ať z převodu, nebo zapsané ručně — se
 *   přeskočí. Opakovaný běh tedy nic nezdvojí.
 * - `orgAccessList` se KOPÍRUJE z rodiny. Převod tím nikomu nic
 *   nezpřístupní ani neodebere: kdo dnes vidí spis, uvidí i svěření.
 * - Děti, u kterých by vznikl neplatný záznam (rodina bez pěstounů, víc
 *   než dva pěstouni), se PŘESKOČÍ a vypíšou. Hádat, který ze tří
 *   pěstounů je ten pravý, skriptu nepřísluší.
 *
 * Použití:
 *   node scripts/migrate-custody-from-spis.mjs             # suchý běh
 *   node scripts/migrate-custody-from-spis.mjs --zapsat
 */
import { getAccessToken, runQuery, firestoreCommit, PROJECT_ID } from './lib/firestore-rest.mjs'

const WRITE = process.argv.includes('--zapsat')
const NOW = new Date().toISOString()

/** Z plné Firestore cesty na relativní. `/documents/` je v cestě dvakrát,
 * naivní split míří na rodiče — viz mark-test-data.mjs. */
function relPath(name) {
  return name.split('/documents/').slice(1).join('/documents/')
}

const str = (fields, key) => fields?.[key]?.stringValue ?? null
const arr = (fields, key) => (fields?.[key]?.arrayValue?.values ?? []).map((v) => v.stringValue)
const docPath = (coll, id) => `projects/${PROJECT_ID}/databases/(default)/documents/${coll}/${id}`

const token = await getAccessToken()

console.log('Načítám děti, rodiny a Dohody…')
const [childRows, familyRows, agreementRows, existingRows] = await Promise.all([
  runQuery(token, { from: [{ collectionId: 'children' }] }),
  runQuery(token, { from: [{ collectionId: 'families' }] }),
  runQuery(token, { from: [{ collectionId: 'agreements', allDescendants: true }] }),
  runQuery(token, { from: [{ collectionId: 'custodyAssignments' }] }),
])
console.log(`  ${childRows.length} dětí, ${familyRows.length} rodin, ${agreementRows.length} Dohod`)
console.log(`  ${existingRows.length} svěření už v systému je`)

/** familyDocId → { fosterPersonRefs, orgAccessList } */
const families = new Map()
for (const r of familyRows) {
  families.set(r.document.name.split('/').pop(), {
    fosterPersonRefs: arr(r.document.fields, 'fosterPersonRefs'),
    orgAccessList: arr(r.document.fields, 'orgAccessList'),
  })
}

/** familyDocId → [{ uid, organizationId, validFrom, validTo }] */
const agreementsByFamily = new Map()
for (const r of agreementRows) {
  const f = r.document.fields ?? {}
  const familyDocId = relPath(r.document.name).split('/')[1]
  const uid = str(f, 'uid')
  const organizationId = str(f, 'organizationId')
  const validFrom = str(f, 'validFrom')
  if (!uid || !organizationId || !validFrom) continue
  if (!agreementsByFamily.has(familyDocId)) agreementsByFamily.set(familyDocId, [])
  agreementsByFamily.get(familyDocId).push({ uid, organizationId, validFrom, validTo: str(f, 'validTo') })
}

/** Děti, které svěření už mají — ať z dřívějšího běhu, nebo zapsané ručně. */
const childrenWithAssignment = new Set(
  existingRows.map((r) => str(r.document.fields, 'childId')).filter(Boolean),
)

const writes = []
let assignmentCount = 0
let subjectCount = 0
let estimatedDates = 0
const skipped = { jizMa: [], bezRodiny: [], bezPestounu: [], vicNezDva: [] }

for (const r of childRows) {
  const childId = r.document.name.split('/').pop()
  const f = r.document.fields ?? {}
  const familyId = str(f, 'familyId')
  const child = `${str(f, 'firstName') ?? '?'} ${str(f, 'lastName') ?? '?'}`

  if (childrenWithAssignment.has(childId)) {
    skipped.jizMa.push(child)
    continue
  }

  const family = familyId ? families.get(familyId) : null
  if (!family) {
    skipped.bezRodiny.push(`${child} (${childId})`)
    continue
  }

  const fosters = family.fosterPersonRefs
  if (fosters.length === 0) {
    skipped.bezPestounu.push(`${child} (rodina ${familyId})`)
    continue
  }
  if (fosters.length > 2) {
    // Zákonný strop: společnými pěstouny mohou být jen manželé, tedy nejvýš
    // dva. Tři a víc v domácnosti znamená, že jsou to dvě svěření a rozdělit
    // je umí jen člověk, který zná rozsudky.
    skipped.vicNezDva.push(`${child} (rodina ${familyId}, ${fosters.length} pěstounů)`)
    continue
  }

  const famAgreements = agreementsByFamily.get(familyId) ?? []
  const earliest = famAgreements.map((a) => a.validFrom).sort()[0] ?? str(f, 'createdAt') ?? NOW
  estimatedDates++

  // `orgAccessList` z rodiny 1:1 — kdo vidí spis, uvidí i svěření.
  // Rodina bez historie Dohod (čerstvě založená) spadne na organizaci dítěte.
  const orgAccessList = family.orgAccessList.length
    ? family.orgAccessList
    : [str(f, 'organizationId')].filter(Boolean)
  if (orgAccessList.length === 0) {
    skipped.bezRodiny.push(`${child} (rodina ${familyId} bez organizace)`)
    continue
  }

  const assignmentId = `migr-${childId}`
  assignmentCount++
  writes.push({
    update: {
      name: docPath('custodyAssignments', assignmentId),
      fields: {
        id: { stringValue: assignmentId },
        orgAccessList: { arrayValue: { values: orgAccessList.map((o) => ({ stringValue: o })) } },
        courtDecisionId: { nullValue: null },
        childId: { stringValue: childId },
        fosterPersonIds: { arrayValue: { values: fosters.map((p) => ({ stringValue: p })) } },
        form: { stringValue: fosters.length === 2 ? 'spolecna' : 'vyhradni' },
        validFrom: { stringValue: earliest },
        validFromIsEstimate: { booleanValue: true },
        validTo: { nullValue: null },
        status: { stringValue: 'aktivni' },
        createdAt: { stringValue: NOW },
        createdByOrgId: { stringValue: orgAccessList[0] },
      },
    },
  })

  // PŘEDMĚT DOHODY jen k BĚŽÍCÍM Dohodám. U skončených bychom museli
  // hádat, které děti tehdy pokrývaly — dítě mohlo přijít až potom.
  // Doplní se ručně, pokud to někdo bude potřebovat vykázat zpětně.
  for (const a of famAgreements) {
    if (a.validTo && a.validTo <= NOW) continue
    for (const fosterId of fosters) {
      const subjectId = `migr-${assignmentId}-${a.organizationId}-${fosterId}`
      subjectCount++
      writes.push({
        update: {
          name: docPath('agreementSubjects', subjectId),
          fields: {
            organizationId: { stringValue: a.organizationId },
            agreementId: { stringValue: a.uid },
            custodyAssignmentId: { stringValue: assignmentId },
            fosterPersonId: { stringValue: fosterId },
            validFrom: { stringValue: a.validFrom },
            validTo: { nullValue: null },
          },
        },
      })
    }
  }
}

console.log(`\nK zapsání:`)
console.log(`  svěření péče      ${assignmentCount}`)
console.log(`  předměty dohody   ${subjectCount}`)
console.log(`  z toho odhadované datum svěření: ${estimatedDates} (všechna — přesné datum systém nikdy neevidoval)`)
console.log(`  rozhodnutí soudu: 0 — spisová značka v datech není, doplní se ručně`)

const report = (label, list) => {
  if (!list.length) return
  console.log(`\n⚠️  ${label}: ${list.length}`)
  for (const x of list.slice(0, 15)) console.log(`      ${x}`)
  if (list.length > 15) console.log(`      … a dalších ${list.length - 15}`)
}
report('Přeskočeno — svěření už mají', skipped.jizMa)
report('Přeskočeno — dítě bez rodiny', skipped.bezRodiny)
report('Přeskočeno — rodina bez pěstouna', skipped.bezPestounu)
report('Přeskočeno — víc než dva pěstouni, rozdělit musí člověk', skipped.vicNezDva)

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
