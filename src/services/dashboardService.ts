import { collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AgreementDoc } from '@/types/agreement'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import { listIppdsNeedingAttention } from '@/services/ippdService'
import { listInspections, findOverdueCorrectiveActions } from '@/services/inspectionService'
import { listFosterProspects, suggestDormantProspects } from '@/services/fosterProspectService'
import { findForgottenOccurrencesForOrg } from '@/services/assistedContactService'
import { listChildrenForOrg, listFosterPersonsForOrg } from '@/services/familyService'
import { parseDateValue } from '@/lib/dateGrid'
import { nameDaysFor } from '@/data/nameDays'
import { WAITING_BUFFER_DAYS, computeVisitAlertTier, daysSince as sharedDaysSince } from '@/lib/familyAlertStatus'
import type { AlertTier } from '@/lib/familyAlertStatus'

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
 * - "krize": `daysSinceLastVisit > visitIntervalDays` — Dohoda už reálně
 *   porušuje svou vlastní zákonnou lhůtu (§3).
 * DOPLNENI_ZADANI-DO-M5 §3 přidává MEZISTUPEŇ "warning" (žluté
 * upozornění) při dosažení 45 dní — na rozdíl od "waiting"/"crisis"
 * (odvozené z KONKRÉTNÍ `visitIntervalDays` Dohody) je 45 dní záměrně
 * PLOCHÉ/natvrdo napříč všemi Dohodami, bez ohledu na jejich vlastní
 * interval (zadání: "Práh 45 dní je zatím natvrdo, ne konfigurovatelný").
 * Pro výchozí 60denní Dohodu se to shoduje se stávajícím "waiting" prahem
 * (60-15=45), ale u Dohody s jiným `visitIntervalDays` se rozejdou — proto
 * `visitStatus` (3 hodnoty), NE už jen `crisis: boolean`.
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
export type VisitStatusTier = Exclude<AlertTier, 'ok'>

export interface DivergentFosterPersonWarning {
  fosterPersonId: string
  name: string
  lastVisitAt: string | null
  visitStatus: VisitStatusTier
}

export interface FamilyAwaitingVisit {
  docId: string
  family: FamilyDoc
  primaryFosterName: string | null
  lastVisitAt: string | null
  visitStatus: VisitStatusTier
  /** DOPLNENI_ZADANI-DO-M5 §2 — vyplněno JEN když se `fosterPersons.
   * lastVisitAt` mezi partnery rozešly (nesdílená návštěva jen jednoho
   * partnera) — varování zvlášť za toho, komu lhůta reálně běží. */
  divergentFosterPerson: DivergentFosterPersonWarning | null
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
    return sharedDaysSince(lastVisitAt, now)
  }
  function computeVisitStatus(daysSinceVisit: number, visitIntervalDays: number): VisitStatusTier {
    const tier = computeVisitAlertTier(daysSinceVisit, visitIntervalDays)
    // Volající vždy filtruje na `daysSince > visitIntervalDays - WAITING_BUFFER_DAYS`
    // dřív, takže `tier` sem nikdy nedorazí jako 'ok' — fallback je jen typová pojistka.
    return tier === 'ok' ? 'waiting' : tier
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

        const fosterPersons = (
          await Promise.all(family.fosterPersonRefs.map((id) => getDoc(doc(db, 'fosterPersons', id))))
        )
          .filter((d) => d.exists())
          .map((d) => ({ id: d.id, ...(d.data() as FosterPersonDoc) }))

        const fp = fosterPersons[0] ?? null

        let divergentFosterPerson: DivergentFosterPersonWarning | null = null
        if (fosterPersons.length >= 2) {
          const withEffectiveDate = fosterPersons.map((p) => ({
            ...p,
            effectiveLastVisitAt: p.lastVisitAt ?? agreement.lastVisitAt ?? null,
          }))
          const distinctDates = new Set(withEffectiveDate.map((p) => p.effectiveLastVisitAt ?? 'never'))
          if (distinctDates.size > 1) {
            // Ten s nejdřívějším (nejstarším) efektivním datem = komu lhůta reálně běží.
            const mostOverdue = withEffectiveDate.reduce((oldest, p) => {
              const pTime = p.effectiveLastVisitAt ? Date.parse(p.effectiveLastVisitAt) : -Infinity
              const oldestTime = oldest.effectiveLastVisitAt ? Date.parse(oldest.effectiveLastVisitAt) : -Infinity
              return pTime < oldestTime ? p : oldest
            })
            divergentFosterPerson = {
              fosterPersonId: mostOverdue.id,
              name: `${mostOverdue.firstName} ${mostOverdue.lastName}`,
              lastVisitAt: mostOverdue.effectiveLastVisitAt,
              visitStatus: computeVisitStatus(daysSince(mostOverdue.effectiveLastVisitAt), agreement.visitIntervalDays),
            }
          }
        }

        return {
          docId: agreement.familyId,
          family,
          primaryFosterName: fp ? `${fp.firstName} ${fp.lastName}` : null,
          lastVisitAt: agreement.lastVisitAt ?? null,
          visitStatus: computeVisitStatus(daysSince(agreement.lastVisitAt), agreement.visitIntervalDays),
          divergentFosterPerson,
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

/**
 * §B.8 "Provozní upozornění" — 4 nová hlídání navíc k "Čeká na vás":
 * IPPD vyhodnocení, nápravná opatření z inspekcí, uspávající se zájemci
 * (§B.7), zapomenutá zaznamenání asistovaného kontaktu (§B.10.2). Každé
 * hlídání je JEDNODUCHÝ text řádek (bez proklikávání do detailu) — plný
 * navigační kontext (odkaz na konkrétní Spis/pěstouna) by vyžadoval další
 * dotazy jen kvůli deep-linku, mimo rozsah týhle lehké "dnes" obrazovky.
 */
export interface OperationalAlert {
  kind: 'ippd' | 'inspection' | 'prospect' | 'assistedContact' | 'birthday' | 'nameDay'
  text: string
  overdue: boolean
}

export async function listOperationalAlerts(organizationId: string): Promise<OperationalAlert[]> {
  const [ippds, inspections, prospects, forgottenOccurrences] = await Promise.all([
    listIppdsNeedingAttention(organizationId),
    listInspections(organizationId),
    listFosterProspects(organizationId),
    findForgottenOccurrencesForOrg(organizationId),
  ])

  const alerts: OperationalAlert[] = []

  for (const { docId, overdue } of ippds) {
    alerts.push({
      kind: 'ippd',
      text: overdue
        ? `IPPD ${docId.slice(0, 6)} má po termínu vyhodnocení.`
        : `IPPD ${docId.slice(0, 6)} se blíží termínu vyhodnocení.`,
      overdue,
    })
  }

  for (const { docId, criterionCode, overdue } of findOverdueCorrectiveActions(inspections)) {
    alerts.push({
      kind: 'inspection',
      text: `Nápravné opatření ${criterionCode} (inspekce ${docId.slice(0, 6)}) ${overdue ? 'je po termínu' : 'se blíží termínu'}.`,
      overdue,
    })
  }

  for (const { prospect } of suggestDormantProspects(prospects)) {
    alerts.push({
      kind: 'prospect',
      text: `Zájemce ${prospect.name}: bez kontaktu 60+ dní, zvažte "uspáno".`,
      overdue: false,
    })
  }

  for (const { docId } of forgottenOccurrences) {
    alerts.push({
      kind: 'assistedContact',
      text: `Asistovaný kontakt (${docId.slice(0, 6)}) proběhl, ale záznam chybí.`,
      overdue: true,
    })
  }

  return alerts
}

const BIRTHDAY_LOOKAHEAD_DAYS = 7

function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Kolik dní zbývá do nejbližšího výskytu měsíce/dne od `today` (0 = dnes,
 * 365 max). `new Date` si sám poradí s 29.2. v nepřestupném roce (posune
 * na 1.3.) — přijatelné běžné chování, ne chyba. */
function daysUntilNextOccurrence(month: number, day: number, today: Date): number {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let next = new Date(today.getFullYear(), month - 1, day)
  if (next.getTime() < todayMidnight.getTime()) next = new Date(today.getFullYear() + 1, month - 1, day)
  return Math.round((next.getTime() - todayMidnight.getTime()) / 86_400_000)
}

function daysWord(n: number): string {
  if (n === 1) return 'den'
  if (n >= 2 && n <= 4) return 'dny'
  return 'dní'
}

/**
 * Narozeninová/jmeninová upozornění (2026-07-23, Petrovo zadání) — ODDĚLENÉ
 * od `listOperationalAlerts` (ne sloučené dovnitř), protože je to jediné
 * upozornění řízené OSOBNÍ preferencí (`UserDoc.notifyBirthdays`), volající
 * strana (Dashboard/mobil) rozhoduje, jestli tuhle funkci vůbec zavolá.
 *
 * Narozeniny potřebují `birthDate` (dřív u dětí nikdy nevyplněné, u
 * pěstounů pole vůbec neexistovalo — doplněno ve stejné dávce), svátek
 * funguje jen na `firstName` bez ohledu na `birthDate`.
 */
export async function listBirthdayAlerts(organizationId: string): Promise<OperationalAlert[]> {
  const [children, fosters] = await Promise.all([
    listChildrenForOrg(organizationId),
    listFosterPersonsForOrg(organizationId),
  ])
  const today = new Date()
  const todayNames = new Set(nameDaysFor(today.getMonth() + 1, today.getDate()).map(stripDiacritics))
  const people = [
    ...children.map(({ child }) => ({ firstName: child.firstName, lastName: child.lastName, birthDate: child.birthDate })),
    ...fosters.map(({ fosterPerson }) => ({
      firstName: fosterPerson.firstName,
      lastName: fosterPerson.lastName,
      birthDate: fosterPerson.birthDate,
    })),
  ]

  const alerts: OperationalAlert[] = []
  for (const p of people) {
    const fullName = `${p.firstName} ${p.lastName}`
    if (p.birthDate) {
      const parsed = parseDateValue(p.birthDate)
      if (parsed) {
        const days = daysUntilNextOccurrence(parsed.month + 1, parsed.day, today)
        if (days <= BIRTHDAY_LOOKAHEAD_DAYS) {
          alerts.push({
            kind: 'birthday',
            text: days === 0 ? `${fullName} má dnes narozeniny.` : `${fullName} má za ${days} ${daysWord(days)} narozeniny.`,
            overdue: false,
          })
        }
      }
    }
    if (todayNames.has(stripDiacritics(p.firstName))) {
      alerts.push({ kind: 'nameDay', text: `${fullName} má dnes svátek.`, overdue: false })
    }
  }
  return alerts
}
