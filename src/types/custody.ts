import type { DataClassed } from '@/types/dataClass'

/**
 * PRÁVNÍ ROVINA (rozsudek → svěření) ODDĚLENĚ OD SERVISNÍ (dohoda).
 *
 * Návrh Petr Homolka, 2026-07-26. Jádro myšlenky: v pěstounské péči se
 * prolínají dva světy, které se řídí každý svou logikou —
 *
 *   PRÁVNÍ    Kdo je komu svěřen. Určuje SOUD, mění se rozsudkem.
 *   SERVISNÍ  Kdo rodinu doprovází. Určuje SMLOUVA, mění se dohodou.
 *
 * Dosud jsme měli jen tu druhou a první jsme si domýšleli z toho, kdo je
 * v rodině zapsaný. To nefunguje: rozvodem společná pěstounská péče ze
 * zákona zaniká, ale dohoda o výkonu pěstounské péče je jiná smlouva
 * s jinou životností. Bez oddělení se to nedá zapsat, natož vykázat.
 *
 * ─── Tři úpravy proti relačnímu návrhu ────────────────────────────────
 *
 * 1. PĚSTOUNI JSOU POLE, NE DVA SLOUPCE.
 *    Relační návrh měl `pestoun_1_id` / `pestoun_2_id`. Ve Firestore je
 *    to past: dotaz „kde je tahle osoba pěstounem" by musel běžet dvakrát
 *    (jednou na každý sloupec) a výsledky se slučovat, protože OR napříč
 *    poli neexistuje. Zákonný strop dva (společnými pěstouny mohou být jen
 *    manželé) hlídá validace, ne tvar dat.
 *
 *    OPRAVA 27. 7.: původně tu stálo, že `array-contains` nad tímhle polem
 *    bude „jeden dotaz, jeden index". Nebude. Pravidla u `list` vyžadují,
 *    aby dotaz sám dokazoval oprávnění, a jediný přípustný důkaz je
 *    `array-contains` nad `orgAccessList` — dotaz nad `fosterPersonIds`
 *    skončí na `permission-denied`. Pole je pořád správný tvar (dva
 *    sloupce by byly horší), ale hledá se přes něj až v paměti; viz
 *    `listAssignmentsForFoster` v `services/custodyService.ts`.
 *
 * 2. OSOBA ZŮSTÁVÁ ROZDĚLENÁ NA PĚSTOUNA A DÍTĚ.
 *    Sloučit je do jedné tabulky `Osoba` je normalizačně čistší, ale naše
 *    UID nese typ entity v prvních dvou číslicích (10 = pěstoun,
 *    20 = dítě, viz types/identity.ts) a ta čísla už jsou na dokumentech
 *    a v QR kódech. Sloučení by z typu udělalo roli a znamenalo přečíslovat
 *    identitu celé platformy. Cena vysoká, přínos dnes malý — vracíme se
 *    k tomu, až bude potřeba podchytit člověka, který byl dítětem a stal
 *    se pěstounem.
 *
 * 3. PŘÍSTUP ORGANIZACE ZŮSTÁVÁ DENORMALIZOVANÝ.
 *    Bezpečnostní pravidla Firestore neumí join. Dnešní pravidla odpovídají
 *    na „má organizace přístup?" přímým sáhnutím na známou cestu. Přes
 *    `Dohoda → PredmetDohody → SvereniPece → dítě` by se to zjistit
 *    nedalo. Proto se seznam organizací drží i nadále denormalizovaný na
 *    entitě (`orgAccessList`) a nový model ho jen naplňuje — je to
 *    odvozený údaj, ne druhý zdroj pravdy.
 */

// ─── Právní rovina ──────────────────────────────────────────────────────

export type CourtDecisionKind =
  | 'sverenido_pp' // svěření do pěstounské péče
  | 'zruseni_pp' // zrušení pěstounské péče
  | 'uprava_pomeru' // úprava poměrů (typicky po rozvodu pěstounů)

export const COURT_DECISION_KIND_LABELS: Record<CourtDecisionKind, string> = {
  sverenido_pp: 'Svěření do pěstounské péče',
  zruseni_pp: 'Zrušení pěstounské péče',
  uprava_pomeru: 'Úprava poměrů',
}

/**
 * courtDecisions/{id} — ROZHODNUTÍ SOUDU. Právní titul, o který se opírá
 * všechno ostatní.
 *
 * Je to entita platformy, ne organizace: rozsudek platí bez ohledu na to,
 * která organizace zrovna doprovází, a přežije všechny jejich výměny.
 */
export interface CourtDecisionDoc extends DataClassed {
  /**
   * Organizace, které rozhodnutí vidí. Denormalizované ze stejného důvodu
   * jako u rodiny — pravidla Firestore neumí join (viz úprava 3 v hlavičce).
   */
  orgAccessList: string[]

  /** Spisová značka, např. „12 P 45/2023". Lidský identifikátor. */
  fileNumber: string
  courtName: string
  /** Datum právní moci — od něj se počítá účinnost, ne od vydání. */
  effectiveFrom: string
  kind: CourtDecisionKind
  note?: string
  createdAt: string
  createdByOrgId: string
  createdByUid: string
}

export type CustodyStatus = 'aktivni' | 'ukonceno'

export type CustodyForm =
  /** Výhradní péče jednoho pěstouna. */
  | 'vyhradni'
  /** Společná péče manželů. */
  | 'spolecna'
  /** Střídavá péče. */
  | 'stridava'

export const CUSTODY_FORM_LABELS: Record<CustodyForm, string> = {
  vyhradni: 'Výhradní péče',
  spolecna: 'Společná péče manželů',
  stridava: 'Střídavá péče',
}

/**
 * custodyAssignments/{id} — SVĚŘENÍ PÉČE. Jedno dítě svěřené jednomu nebo
 * dvěma pěstounům jedním rozhodnutím soudu.
 *
 * TOHLE je ta jednotka, kterou jsme dosud neuměli: „rodina" byla
 * domácnost, jenže jeden pěstoun může mít děti ze dvou různých rozsudků
 * a ke každému jinou doprovázející organizaci. Bez svěření by se to
 * nedalo oddělit a druhá organizace by viděla dítě, se kterým nemá
 * žádný právní vztah.
 *
 * Klíč je SURROGÁTNÍ (náhodné ID), nikdy složený z účastníků: tytéž osoby
 * mohou mít v čase víc svěření po sobě (zrušení, nová úprava po rozvodu)
 * a složený klíč by druhé z nich přepsal.
 */
export interface CustodyAssignmentDoc extends DataClassed {
  /** Vlastní id — nese se i uvnitř dokumentu, aby šlo pracovat s polem bez snapshotů. */
  id: string

  /** Viz `CourtDecisionDoc.orgAccessList`. */
  orgAccessList: string[]

  /**
   * Rozhodnutí, kterým bylo dítě svěřeno. `null` = SVĚŘENÍ VÍME, ROZSUDEK NE.
   *
   * Je to stav 282 spisů převedených 27. 7.: z existujících dat se dá
   * spolehlivě odvodit, KDO o koho pečuje, ale číslo jednací ani soud
   * v systému nikdy nebyly. Vymyslet je nesmím, a zahodit svěření kvůli
   * chybějícímu rozsudku by bylo horší — pak by právní vrstva neznala
   * nikoho. `null` je proto poctivé „doplnit" a UI to hlásí.
   */
  courtDecisionId: string | null
  childId: string

  /**
   * Pěstouni. Pole, ne dvě pojmenovaná pole — viz úprava 1 v hlavičce.
   * Nejvýš dva a jen manželé (zákonná podmínka společné pěstounské péče);
   * pořadí NENÍ významné a nesmí se na něj nic vázat.
   */
  fosterPersonIds: string[]

  form: CustodyForm
  validFrom: string

  /**
   * `true` = DATUM JE ODHAD, ne zjištěný údaj.
   *
   * Vzniklo převodem 282 spisů 27. 7.: kdy soud dítě svěřil, systém nikdy
   * neevidoval. Odhad je začátek nejstarší Dohody rodiny — svěření muselo
   * být dřív nebo současně, protože doprovázet se dá jen péče, která už
   * běží. Je to tedy nejzazší možný začátek, ne skutečný.
   *
   * Bez téhle značky by odhad po pár měsících nikdo nerozeznal od údaje
   * z rozsudku. UI ho hlásí a po doplnění rozhodnutí soudu se pole maže.
   */
  validFromIsEstimate?: boolean
  /** `null` = trvá. Vyplní se, když soud rozhodne jinak. */
  validTo: string | null
  status: CustodyStatus

  /**
   * Čím bylo svěření ukončeno. Ukazuje na NOVÉ rozhodnutí, ne na to
   * původní — díky tomu jde přečíst příběh „tímhle rozsudkem to začalo,
   * tímhle skončilo" bez dohadování.
   */
  endedByCourtDecisionId?: string | null

  createdAt: string
  createdByOrgId: string
}

// ─── Servisní rovina ────────────────────────────────────────────────────

/**
 * agreementSubjects/{id} — PŘEDMĚT DOHODY. Které svěření (a kterého
 * pěstouna) daná Dohoda pokrývá.
 *
 * Vazební entita schválně: jedna Dohoda může pokrývat víc dětí (sourozenci
 * z jednoho rozsudku) a naopak jedno svěření může být v čase pokryté
 * několika Dohodami po sobě (organizace se vymění).
 *
 * ROZPOR VYŘEŠEN metodikou MPSV (aktualizace 20. 1. 2026). 26. 7. dopoledne
 * padlo, že dva pěstouni ve společné péči = DVĚ Dohody; odpoledne, že
 * manželé uzavírají JEDNU. Platí to druhé: manželé uzavírají dohodu
 * společně a osoba pečující smí mít v daném čase jen jednu dohodu s jedním
 * doprovázejícím subjektem. Model už po téhle variantě šel, takže se nic
 * nepřepisuje — jedna `Dohoda` a v ní dva `agreementSubjects`, po jednom
 * za každého manžela. Vykazování za konkrétního pěstouna tím zůstává
 * možné, ale smlouva je jedna.
 *
 * Ze stejné metodiky plyne i druhá věc, kterou tenhle tvar dat unese
 * a starý ne: PŘIJETÍ DALŠÍHO DÍTĚTE NENÍ NOVÁ DOHODA, ale změna té
 * stávající — v datech tedy další `agreementSubject` s TÝMŽ `agreementId`.
 * Hlídá to `canOpenNewTitle()` v `lib/agreementLaw.ts`.
 */
export interface AgreementSubjectDoc extends DataClassed {
  /** Organizace Dohody. Předmět patří jedné Dohodě, tedy jedné organizaci. */
  organizationId: string

  /**
   * UID Dohody (`AgreementDoc.uid`), NE její document ID.
   *
   * Document ID Dohody je `organizationId` (viz hlavička `types/agreement.ts`)
   * a je jedinečné jen v rámci jedné rodiny. `agreementSubjects` je ale
   * kolekce nejvyšší úrovně — kdyby se sem ukládalo document ID, měly by
   * dvě rodiny doprovázené touž organizací nerozlišitelné předměty.
   */
  agreementId: string
  custodyAssignmentId: string

  /** Za kterého pěstouna se vykazují klíčové aktivity. */
  fosterPersonId: string

  validFrom: string
  validTo: string | null
}
