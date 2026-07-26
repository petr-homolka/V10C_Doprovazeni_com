/**
 * ROZPOZNÁNÍ, ŽE TAKOVOU OSOBU UŽ V SYSTÉMU MÁME — bez toho, aby z toho
 * byl vyhledávač lidí.
 *
 * Petrovo zadání: nová organizace zadá pěstouna a systém má podle rodného
 * čísla, občanky, pasu, čísla rozsudku, nebo kombinace jména s adresou či
 * s dítětem poznat, že už ho vedeme.
 *
 * ─── PROČ SE NEHLEDÁ PODLE HODNOT, ALE PODLE OTISKŮ ───────────────────
 *
 * Kdyby se v databázi hledalo přímo podle rodného čísla, existovala by
 * kolekce, kde jsou rodná čísla napsaná. Kdokoli s přístupem by si mohl
 * projet, koho systém vede. Proto se ukládá jen SHA-256 OTISK: najít
 * záznam znamená znát tu hodnotu předem — a tu má nová organizace proto,
 * že jí pěstoun sedí naproti a doklad ukazuje.
 *
 * ─── ČEHO SE TÍM NEDOSÁHNE, ať to není překvapení ─────────────────────
 *
 * Sůl je v aplikaci, tedy veřejná. Rodných čísel je řádově 10^10 a mají
 * strukturu, takže odhodlaný útočník je může zkoušet po jednom. Otisk
 * tohle NEZASTAVÍ — jen zabrání tomu, aby šla data přečíst hromadně.
 * Skutečná zábrana je omezení počtu dotazů, a to jde udělat jedině na
 * serveru (Cloud Function), ne v pravidlech Firestore. Do ostrého provozu
 * to musí přibýt; dokud tam není, každý dotaz se aspoň zapisuje do auditu,
 * což je odstrašení, ne zábrana. Radši ať je to napsané tady než aby to
 * někdo objevil za rok.
 */

export type MatchKeyKind =
  | 'rodne_cislo'
  | 'obcansky_prukaz'
  | 'cestovni_pas'
  | 'cislo_rozsudku'
  | 'jmeno_adresa'
  | 'jmeno_dite'

export const MATCH_KEY_LABELS: Record<MatchKeyKind, string> = {
  rodne_cislo: 'Rodné číslo',
  obcansky_prukaz: 'Číslo občanského průkazu',
  cestovni_pas: 'Číslo cestovního pasu',
  cislo_rozsudku: 'Číslo rozsudku',
  jmeno_adresa: 'Jméno, příjmení a adresa',
  jmeno_dite: 'Jméno pěstouna a jméno dítěte',
}

/**
 * Srovnání zápisu do porovnatelné podoby. Bez tohohle by „Nováková Jana"
 * z jedné organizace nikdy nepotkala „Jana Nováková" z druhé, a lomítko
 * v rodném čísle by rozhodovalo o tom, jestli se člověk najde.
 *
 * Diakritika padá schválně: jedna organizace píše „Jiří", druhá „Jiri",
 * a v obou případech jde o téhož člověka.
 */
export function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Sůl. Veřejná (je v balíčku aplikace) — viz hlavička, otisk tu není proti
 * cílenému hádání, ale proti hromadnému čtení. Měnit ji znamená znovu
 * postavit celý index, takže je tady natvrdo a ne v konfiguraci, kde by
 * ji někdo omylem přepsal.
 */
const SALT = 'doprovazeni.cz/personIndex/v1'

/** Materiál k zahašování. Oddělený od hashování, aby šel otestovat bez
 * kryptografie — a aby bylo vidět, že druh klíče je jeho součástí:
 * stejné číslo jako občanka a jako pas nesmí dát tentýž otisk. */
export function matchKeyMaterial(kind: MatchKeyKind, parts: string[]): string | null {
  const normalized = parts.map(normalizeToken).filter((p) => p.length > 0)
  if (normalized.length !== parts.length) return null

  // Krátká hodnota se pozná snadno hádáním a zároveň skoro jistě nikoho
  // jednoznačně neurčuje — takový klíč do indexu nepatří.
  const joined = normalized.join('|')
  if (joined.replace(/\|/g, '').length < 6) return null

  return `${SALT}|${kind}|${joined}`
}

/** SHA-256 hex. Klíč dokumentu v `personIndex`. */
export async function matchKeyHash(kind: MatchKeyKind, parts: string[]): Promise<string | null> {
  const material = matchKeyMaterial(kind, parts)
  if (!material) return null
  const bytes = new TextEncoder().encode(material)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Vstup, ze kterého se dá poskládat sada klíčů pro jednu osobu. */
export interface PersonIdentifiers {
  firstName?: string
  lastName?: string
  birthNumber?: string
  idCardNumber?: string
  passportNumber?: string
  address?: string
  /** Čísla rozsudků, kterými byly děti svěřeny. */
  courtFileNumbers?: string[]
  /** Jména dětí v péči — „Novák Jan" apod. */
  childNames?: string[]
}

/**
 * Všechny klíče, pod kterými se osoba dá najít.
 *
 * Schválně JICH VÍC: organizace nemá vždycky totéž. Jedna má rodné číslo,
 * druhá jen jméno a adresu, třetí zná číslo rozsudku. Shoda na kterémkoli
 * klíči stačí — proto se do indexu zapisují všechny, které jdou složit.
 */
export async function buildMatchKeys(
  person: PersonIdentifiers,
): Promise<Array<{ kind: MatchKeyKind; hash: string }>> {
  const name = [person.firstName ?? '', person.lastName ?? '']
  const candidates: Array<{ kind: MatchKeyKind; parts: string[] }> = []

  if (person.birthNumber) candidates.push({ kind: 'rodne_cislo', parts: [person.birthNumber] })
  if (person.idCardNumber) candidates.push({ kind: 'obcansky_prukaz', parts: [person.idCardNumber] })
  if (person.passportNumber) candidates.push({ kind: 'cestovni_pas', parts: [person.passportNumber] })

  for (const fileNumber of person.courtFileNumbers ?? []) {
    candidates.push({ kind: 'cislo_rozsudku', parts: [fileNumber] })
  }

  if (person.firstName && person.lastName && person.address) {
    candidates.push({ kind: 'jmeno_adresa', parts: [...name, person.address] })
  }
  for (const childName of person.childNames ?? []) {
    if (person.firstName && person.lastName) {
      candidates.push({ kind: 'jmeno_dite', parts: [...name, childName] })
    }
  }

  const keys = await Promise.all(
    candidates.map(async (c) => {
      const hash = await matchKeyHash(c.kind, c.parts)
      return hash ? { kind: c.kind, hash } : null
    }),
  )
  return keys.filter((k): k is { kind: MatchKeyKind; hash: string } => k !== null)
}
