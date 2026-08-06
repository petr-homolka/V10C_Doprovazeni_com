import type { AgreementSubjectDoc, CustodyAssignmentDoc } from '@/types/custody'

/**
 * Odpovědi na otázky, které se nad právní rovinou ptáme každý den.
 *
 * Všechno jsou ČISTÉ funkce nad poli dokumentů. Důvod je stejný jako
 * u `handover.ts`: na těchhle odpovědích visí, kdo koho vidí a komu se
 * co vykazuje. To se musí dát otestovat bez databáze a bez obrazovky —
 * scénáře typu „pěstouni se rozvedli" se jinak ověřují klikáním, a to
 * nikdo nedělá.
 *
 * Časová platnost se všude počítá STEJNĚ: záznam platí, když
 * `validFrom <= den` a zároveň (`validTo` chybí nebo `> den`). Jedno
 * pravidlo, jedna funkce (`isEffective`), žádné varianty po souborech.
 */

/** Cokoli s časovou platností — svěření, předmět dohody, i budoucí věci. */
interface Effective {
  validFrom: string
  validTo?: string | null
}

/** Platí záznam k danému dni? Konec je VÝLUČNÝ — den ukončení už neplatí. */
export function isEffective(record: Effective, at: Date = new Date()): boolean {
  const day = at.toISOString()
  if (record.validFrom > day) return false
  return !record.validTo || record.validTo > day
}

/** Je tahle osoba pěstounem v tomhle svěření? Bez ohledu na pořadí v poli. */
export function isFosterIn(assignment: CustodyAssignmentDoc, fosterPersonId: string): boolean {
  return assignment.fosterPersonIds.includes(fosterPersonId)
}

/**
 * Svěření, která k danému dni skutečně platí.
 *
 * ROZHODUJE ČASOVÁ PLATNOST, NE `status`. Vypadá to jako detail, ale není:
 * `status` je AKTUÁLNÍ příznak („dnes už neplatí"), kdežto otázka zní
 * „platilo to k tomuhle dni". Kdyby se filtrovalo i podle `status`,
 * odpověď na „byl loni pěstounem?" by u mezitím ukončeného svěření zněla
 * NE — a to je špatně. Odhalil to test rozvodového scénáře; do té doby to
 * tu bylo napsané obráceně.
 *
 * `status` zůstává jako denormalizace pro levné dotazy ve Firestore
 * (`where status == 'aktivni'` je jeden index, „validTo je null NEBO
 * větší než teď" se dotazem vyjádřit nedá). Musí ale zrcadlit `validTo` —
 * hlídá to `validateAssignmentConsistency`.
 */
export function activeAssignments(
  assignments: CustodyAssignmentDoc[],
  at: Date = new Date(),
): CustodyAssignmentDoc[] {
  return assignments.filter((a) => isEffective(a, at))
}

/**
 * JE TENHLE ČLOVĚK JEŠTĚ PĚSTOUN?
 *
 * Otázka z rozvodového scénáře: soud svěří děti jen jednomu z manželů,
 * ten druhý tím přestává být pěstounem a Dohodu už nepotřebuje. Nestačí
 * se dívat na Dohodu — ta může ještě chvíli doběhnout. Rozhoduje právní
 * rovina, tedy jestli má aspoň jedno platné svěření.
 */
export function isActiveFosterParent(
  fosterPersonId: string,
  assignments: CustodyAssignmentDoc[],
  at: Date = new Date(),
): boolean {
  return activeAssignments(assignments, at).some((a) => isFosterIn(a, fosterPersonId))
}

/** Děti, které má tenhle pěstoun k danému dni svěřené. */
export function childrenInCareOf(
  fosterPersonId: string,
  assignments: CustodyAssignmentDoc[],
  at: Date = new Date(),
): string[] {
  return [
    ...new Set(
      activeAssignments(assignments, at)
        .filter((a) => isFosterIn(a, fosterPersonId))
        .map((a) => a.childId),
    ),
  ]
}

/**
 * KTERÉ ORGANIZACE DOPROVÁZEJÍ TOHLE DÍTĚ?
 *
 * Tohle je ta otázka, kvůli které celý model vznikl. Dřív se odpovídalo
 * „ta, co má Dohodu k rodině" — jenže rodina je domácnost a v ní můžou
 * být děti ze dvou různých rozsudků, každé s jinou organizací. Odpověď
 * teď vede přes svěření konkrétního dítěte, ne přes domácnost.
 *
 * Vrací množinu, protože u společné péče manželů může mít každý z nich
 * vykazování u téže Dohody a u sourozenců z jednoho rozsudku se organizace
 * nemusí shodovat.
 */
export function organizationsAccompanyingChild(
  childId: string,
  assignments: CustodyAssignmentDoc[],
  subjects: AgreementSubjectDoc[],
  agreementOrgById: Record<string, string>,
  at: Date = new Date(),
): string[] {
  const assignmentIds = new Set(
    activeAssignments(assignments, at)
      .filter((a) => a.childId === childId)
      .map((a) => a.id),
  )
  const orgs = subjects
    .filter((s) => assignmentIds.has(s.custodyAssignmentId) && isEffective(s, at))
    .map((s) => agreementOrgById[s.agreementId])
    .filter((org): org is string => !!org)
  return [...new Set(orgs)]
}

/**
 * Pokrývá tahle Dohoda tohle dítě? Používá se tam, kde se rozhoduje
 * o přístupu — proto výslovně přes svěření, ne přes rodinu.
 */
export function agreementCoversChild(
  agreementId: string,
  childId: string,
  assignments: CustodyAssignmentDoc[],
  subjects: AgreementSubjectDoc[],
  at: Date = new Date(),
): boolean {
  const assignmentIds = new Set(
    activeAssignments(assignments, at)
      .filter((a) => a.childId === childId)
      .map((a) => a.id),
  )
  return subjects.some(
    (s) => s.agreementId === agreementId && assignmentIds.has(s.custodyAssignmentId) && isEffective(s, at),
  )
}

/**
 * Osiřelá svěření: platné svěření, které NEPOKRÝVÁ žádná Dohoda.
 *
 * Prakticky to znamená „dítě je svěřené, ale nikdo rodinu nedoprovází" —
 * pěstoun má na uzavření Dohody 30 dnů od svěření. Tohle je přesně ten
 * seznam, který má někoho zajímat, a bez oddělení právní roviny by nešel
 * sestavit vůbec.
 */
export function assignmentsWithoutAgreement(
  assignments: CustodyAssignmentDoc[],
  subjects: AgreementSubjectDoc[],
  at: Date = new Date(),
): CustodyAssignmentDoc[] {
  const covered = new Set(subjects.filter((s) => isEffective(s, at)).map((s) => s.custodyAssignmentId))
  return activeAssignments(assignments, at).filter((a) => !covered.has(a.id))
}

/**
 * `status` musí zrcadlit `validTo`. Dvě pole o téže věci se dřív nebo
 * později rozejdou; tohle je místo, kde se to pozná dřív.
 */
export function validateAssignmentConsistency(
  assignment: Pick<CustodyAssignmentDoc, 'status' | 'validTo'>,
): string | null {
  if (assignment.status === 'ukonceno' && !assignment.validTo) {
    return 'Ukončené svěření musí mít datum ukončení (`validTo`).'
  }
  if (assignment.status === 'aktivni' && assignment.validTo) {
    return 'Svěření s datem ukončení nemůže být ve stavu „aktivní".'
  }
  return null
}

/** Zákonná podmínka: společnými pěstouny mohou být jen manželé, tedy dva. */
export function validateFosterCount(assignment: Pick<CustodyAssignmentDoc, 'fosterPersonIds' | 'form'>): string | null {
  const count = assignment.fosterPersonIds.length
  if (count === 0) return 'Svěření musí mít aspoň jednoho pěstouna.'
  if (count > 2) return 'Společnými pěstouny mohou být jen manželé — nejvýš dva.'
  if (assignment.form === 'spolecna' && count !== 2) {
    return 'Společná péče manželů předpokládá dva pěstouny.'
  }
  if (assignment.form === 'vyhradni' && count !== 1) {
    return 'Výhradní péče předpokládá jednoho pěstouna.'
  }
  return null
}
