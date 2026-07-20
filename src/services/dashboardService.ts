import { collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AgreementDoc } from '@/types/agreement'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'

/**
 * "Dnes" (§1/§4/§14) — M3.4 nahrazuje ukázková data v TodaySections
 * skutečným dotazem. §A3 bod 5 doslovně: "spisy s lastVisitAt starším 45
 * dní (krize >60, ideálně navázáno na Dohodu — 2měsíční lhůta z §3)".
 * Čteno jako: 45/60 jsou VÝCHOZÍ hodnoty vyplývající z
 * `DEFAULT_VISIT_INTERVAL_DAYS` (60, "2měsíční lhůta z §3"), ne dvě
 * nezávislá magická čísla — proto se práh počítá z KONKRÉTNÍ Dohody
 * (`agreement.visitIntervalDays`), ne natvrdo:
 * - "čeká" (waiting): `visitIntervalDays - WAITING_BUFFER_DAYS` (60-15=45
 *   pro výchozí Dohodu — dvoutýdenní předstih před zákonnou lhůtou).
 * - "krize" (`crisis: true`): `daysSinceLastVisit > visitIntervalDays` —
 *   Dohoda už reálně porušuje svou vlastní zákonnou lhůtu (§3).
 * "Statistika návštěv týdne" (druhá půlka §A3 bodu 5) je SEAM — mimo
 * rozsah M3.4, samostatný krok (potřebuje jinou agregaci, ne overdue-check).
 *
 * `collectionGroup('agreements')` se dvěma rovnostními filtry
 * (`organizationId`+`status`) vyžaduje vlastní složený index —
 * **`queryScope: "COLLECTION_GROUP"`, NE `"COLLECTION"`** (živě ověřeno
 * 2026-07-19: `failed-precondition` přetrvávalo i po úspěšném "READY"
 * indexu, dokud jsem si nevšiml, že jsem do `firestore.indexes.json`
 * omylem zkopíroval `queryScope: "COLLECTION"` z `timeline` indexu — ten
 * je ale správně `COLLECTION` schválně, protože `listTimelineEntries`
 * dotazuje JEDNU konkrétní podkolekci přes `collection()`, ne
 * `collectionGroup()`. Index se správným scope se ale i tak musí ZNOVU
 * BUILDNOUT — samotná změna `queryScope` na existujícím indexu vyžaduje
 * smazání + nové vytvoření, ne update na místě). Při týž příležitosti se
 * ukázalo, že stejný gap má odjakživa i `agreementService.checkKoCapacity`
 * — index pro `organizationId`+`assignedTo`+`status` (týž
 * `COLLECTION_GROUP` scope) byl přidán současně, i když ho žádná live
 * cesta v M2 nikdy nevyžádala natolik, aby chybu odhalila.
 *
 * `lastVisitAt` čte se PŘÍMO z Dohody vrácené první query (žádné další
 * čtení navíc) — živě opraveno 2026-07-19: v prvním návrhu bydlelo na
 * `FamilyDoc` a vyžadovalo `getDoc(family)` pro KAŽDOU aktivní Dohodu jen
 * kvůli tomuhle jednomu poli; přesun na Dohodu (viz `AgreementDoc.
 * lastVisitAt` komentář — hlavní důvod byl cross-org únik, tohle je
 * vedlejší zisk) navíc SNIŽUJE počet čtení — `getDoc(family)` se teď dělá
 * jen pro skutečně přehledné (overdue) rodiny, ne pro všechny aktivní.
 *
 * Jméno karty se bere z PRVNÍHO pěstouna Spisu (`fosterPersonRefs[0]`) —
 * `FamilyDoc` nemá vlastní "název rodiny" pole (jen adresu), a správné
 * české přechýlení příjmení do tvaru "Rodina Novákových" by vyžadovalo
 * morfologickou knihovnu nad rámec týhle dávky práce.
 *
 * SEAM: nescopuje se na `assignedTo == přihlášená KO` (na rozdíl od
 * `agreementService.checkKoCapacity`, který tenhle vzor už má) — "Čeká na
 * vás" tak dnes ukazuje VŠECHNY přehledné rodiny organizace, ne jen
 * vlastní caseload přihlášené osoby. Vědomá volba pro M3.4: org_admin
 * (typický divák dashboardu v tomhle buildu) sám není obvykle žádné
 * rodině přiřazen jako KO, takže scoping na `assignedTo` by mu ukázal
 * prázdný seznam — per-KO personalizace čeká na skutečné odlišení
 * pohledu dle role.
 */
const WAITING_BUFFER_DAYS = 15
const DAY_MS = 24 * 60 * 60 * 1000

export interface FamilyAwaitingVisit {
  docId: string
  family: FamilyDoc
  primaryFosterName: string | null
  lastVisitAt: string | null
  crisis: boolean
}

export async function listFamiliesAwaitingVisit(organizationId: string): Promise<FamilyAwaitingVisit[]> {
  const agreementsSnap = await getDocs(
    query(
      collectionGroup(db, 'agreements'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'active'),
    ),
  )

  const now = Date.now()
  function daysSince(lastVisitAt: string | null | undefined): number {
    return lastVisitAt ? (now - Date.parse(lastVisitAt)) / DAY_MS : Infinity
  }

  const overdueAgreements = agreementsSnap.docs
    .map((d) => d.data() as AgreementDoc)
    .filter((agreement) => {
      const waitingThresholdDays = Math.max(0, agreement.visitIntervalDays - WAITING_BUFFER_DAYS)
      return daysSince(agreement.lastVisitAt) > waitingThresholdDays
    })

  const withNames = (
    await Promise.all(
      overdueAgreements.map(async (agreement) => {
        const snap = await getDoc(doc(db, 'families', agreement.familyId))
        if (!snap.exists()) return null
        const family = snap.data() as FamilyDoc
        const firstRef = family.fosterPersonRefs[0]
        const fpSnap = firstRef ? await getDoc(doc(db, 'fosterPersons', firstRef)) : null
        const fp = fpSnap?.exists() ? (fpSnap.data() as FosterPersonDoc) : null
        return {
          docId: agreement.familyId,
          family,
          primaryFosterName: fp ? `${fp.firstName} ${fp.lastName}` : null,
          lastVisitAt: agreement.lastVisitAt ?? null,
          crisis: daysSince(agreement.lastVisitAt) > agreement.visitIntervalDays,
        }
      }),
    )
  ).filter((f): f is FamilyAwaitingVisit => f !== null)

  // Nejdéle čekající první — nikdy nenavštívené (bez `lastVisitAt`) úplně nahoru.
  withNames.sort((a, b) => {
    const aTime = a.lastVisitAt ? Date.parse(a.lastVisitAt) : -Infinity
    const bTime = b.lastVisitAt ? Date.parse(b.lastVisitAt) : -Infinity
    return aTime - bTime
  })

  return withNames
}
