import { agreementsByFamilyId, calendarEvents, children, families, fosterPersons, staff, tasks, timelineEntries } from '../../fixtures'
import { EDUCATION_HOURS_TARGET } from '@/types/agreement'

/**
 * Data pro NOVÝ návrh profilu rodiny („spis").
 *
 * Nejde o nová vzorová data — všechno se skládá z existujících fixtures,
 * jen se z nich dělá to, co dosavadní profil neumí: JEDEN TOK ČASU, kde
 * vedle sebe stojí zápis, návštěva, úkol a lhůta, a je vidět, co je před
 * dneškem a co za ním.
 *
 * Proč je to tady a ne v komponentě: skládání času z pěti kolekcí je logika,
 * která se dá spočítat a zkontrolovat i bez kreslení, a komponenta má jen
 * kreslit.
 */

export const FAMILY_ID = 'f1'

export type SpisItemKind = 'zapis' | 'navsteva' | 'udalost' | 'ukol' | 'lhuta' | 'dokument'

export interface SpisItem {
  id: string
  kind: SpisItemKind
  /** Kdy se to stalo / stane. ISO. */
  at: string
  title: string
  /** Tělo zápisu nebo poznámka k úkolu. */
  body?: string
  /** Kdo to udělal / má udělat. */
  who?: string
  /** Koho se to týká (pěstoun/dítě) — jména pro čipy. */
  subjects?: string[]
  /** Splněno (úkoly). */
  done?: boolean
  /** Naléhavost — jediná věc, která smí být barevná. */
  urgent?: boolean
  /** Sdílení zápisu s pěstouny. */
  sharing?: 'internal' | 'partner'
}

const staffName = (uid?: string | null) => staff.find((s) => s.uid === uid)?.displayName ?? null

const subjectName = (ref: { kind: string; id: string }): string | null => {
  if (ref.kind === 'fosterPerson') {
    const fp = fosterPersons.find((x) => x.docId === ref.id)?.fosterPerson
    return fp ? `${fp.firstName} ${fp.lastName}` : null
  }
  if (ref.kind === 'child') {
    const c = children.find((x) => x.docId === ref.id)?.child
    return c ? `${c.firstName} ${c.lastName}` : null
  }
  return null
}

export const family = families.find((f) => f.docId === FAMILY_ID)!.family
export const agreement = agreementsByFamilyId[FAMILY_ID]
export const familyFosterPersons = fosterPersons.filter((f) => f.fosterPerson.familyId === FAMILY_ID)
export const familyChildren = children.filter((c) => c.child.familyId === FAMILY_ID)

/** „Teď" je ve vzorových datech pevné, aby byly screenshoty opakovatelné. */
export const NOW = new Date('2026-07-25T09:30:00')

/**
 * Termín další návštěvy: poslední návštěva + interval z Dohody. Tohle je
 * v téhle appce ta nejdůležitější věc na obrazovce — zákonná lhůta.
 */
export function nextVisitDue(): { at: Date; daysLeft: number; overdue: boolean } {
  const last = agreement?.lastVisitAt ? new Date(agreement.lastVisitAt) : NOW
  const at = new Date(last)
  at.setDate(at.getDate() + (agreement?.visitIntervalDays ?? 60))
  const daysLeft = Math.round((at.getTime() - NOW.getTime()) / 86_400_000)
  return { at, daysLeft, overdue: daysLeft < 0 }
}

/** Česky správný počet dní — „1 den", „3 dny", „12 dní". */
export function dayCount(n: number): string {
  const abs = Math.abs(n)
  if (abs === 1) return `${abs} den`
  if (abs >= 2 && abs <= 4) return `${abs} dny`
  return `${abs} dní`
}

/** Datum krátce („22. 7."), případně i s rokem, když nejde o letošní. */
export function shortDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  const sameYear = d.getFullYear() === NOW.getFullYear()
  return d.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export interface SpisPerson {
  id: string
  name: string
  role: 'Pěstoun' | 'Pěstounka' | 'Dítě v péči'
  /** Druhý řádek — telefon u dospělého, věk u dítěte. */
  detail: string
  contact: string | null
  avatarUrl: string | null
  /** Kdy tuhle konkrétní osobu někdo naposledy viděl OSOBNĚ. */
  lastSeen: Date | null
}

/**
 * Lidé ve spisu, každý s datem „naposledy osobně".
 *
 * Tohle je jádro celého návrhu: dosavadní profil ukazoval u člověka telefon
 * a e-mail — tedy věci, které se nemění a nikdo je nehledá v profilu. Otázka,
 * kterou klíčová osoba nad rodinou skutečně řeší, je „koho z nich jsem
 * půl roku neviděl".
 *
 * Pravidlo přiřazení: návštěva v rodině se počítá VŠEM pěstounům (byli
 * tam), dítěti jen když je uvedené v `subjectRefs` — u dětí se dokládá
 * kontakt jmenovitě.
 */
export function buildPeople(): SpisPerson[] {
  const visits = buildSpis().filter((i) => i.kind === 'navsteva')
  const lastVisit = visits[0] ? new Date(visits[0].at) : null

  const people: SpisPerson[] = []

  for (const { docId, fosterPerson: f } of familyFosterPersons) {
    const name = `${f.firstName} ${f.lastName}`
    people.push({
      id: docId,
      name,
      role: f.firstName.endsWith('a') ? 'Pěstounka' : 'Pěstoun',
      detail: f.birthDate ? `${age(f.birthDate)} let` : '—',
      contact: f.phone ?? f.email ?? null,
      avatarUrl: f.avatarUrl ?? null,
      lastSeen: lastVisit,
    })
  }

  for (const { docId, child: c } of familyChildren) {
    const name = `${c.firstName} ${c.lastName}`
    const seen = visits.find((v) => v.subjects?.includes(name))
    people.push({
      id: docId,
      name,
      role: 'Dítě v péči',
      detail: c.birthNumber ? `${ageFromBirthNumber(c.birthNumber)} let` : '—',
      contact: null,
      avatarUrl: c.avatarUrl ?? null,
      lastSeen: seen ? new Date(seen.at) : null,
    })
  }

  return people
}

function age(birthDate: string): number {
  const b = new Date(birthDate)
  let years = NOW.getFullYear() - b.getFullYear()
  const beforeBirthday =
    NOW.getMonth() < b.getMonth() || (NOW.getMonth() === b.getMonth() && NOW.getDate() < b.getDate())
  if (beforeBirthday) years -= 1
  return years
}

/** Rodné číslo ve vzorových datech je vymyšlené, takže věk z něj bereme
 * jen z prvních dvou číslic (rok) — stačí to na to, aby v návrhu stálo
 * číslo, které dává smysl. */
function ageFromBirthNumber(rn: string): number {
  const yy = Number(rn.slice(0, 2))
  const year = yy > 30 ? 1900 + yy : 2000 + yy
  return NOW.getFullYear() - year
}

export interface SpisLimit {
  id: string
  label: string
  /** Kolik je splněno / kolik je potřeba — pro pruh. */
  done: number
  target: number
  /** Co to znamená lidsky („zbývá 1 den", „splněno"). */
  state: string
  /** Odkud limit je — bez toho to vypadá jako naše výmyslné pravidlo. */
  source: string
  tone: 'ok' | 'blizko' | 'po'
}

/**
 * LHŮTY A LIMITY — jediná věc, kterou tahle appka umí a tabulka v Excelu ne.
 *
 * Všechno se počítá z Dohody a z toho, co se stalo; nic se sem nepíše ručně.
 * Proto to smí být na profilu tak vysoko: kdyby to byl ruční text, byla by
 * to jen další rubrika, které nikdo nevěří.
 */
export function buildLimits(): SpisLimit[] {
  const limits: SpisLimit[] = []

  // 1. Interval návštěv (§ „min. 1× za 2 měsíce", v Dohodě jako dny).
  const interval = agreement?.visitIntervalDays ?? 60
  const due = nextVisitDue()
  const elapsed = interval - due.daysLeft
  limits.push({
    id: 'navsteva',
    label: 'Osobní návštěva v rodině',
    done: Math.min(elapsed, interval),
    target: interval,
    state: due.overdue
      ? `po termínu o ${dayCount(due.daysLeft)}`
      : due.daysLeft === 0
        ? 'termín je dnes'
        : `zbývá ${dayCount(due.daysLeft)}`,
    source: `Dohoda: každých ${dayCount(interval)} · naposledy ${shortDate(agreement.lastVisitAt!)}`,
    tone: due.overdue ? 'po' : due.daysLeft <= 14 ? 'blizko' : 'ok',
  })

  // 2. Vzdělávání — hodiny se sčítají z délky vzdělávacích událostí, ne
  //    z ručně vyplněného čísla.
  const target = agreement?.educationHoursTarget ?? EDUCATION_HOURS_TARGET[agreement?.careType ?? 'zprostredkovana']
  const windowStart = new Date(NOW)
  windowStart.setFullYear(windowStart.getFullYear() - 1)
  const hours = calendarEvents
    .filter(({ event }) => event.kind === 'vzdelavani' && event.familyDocId === FAMILY_ID)
    .filter(({ event }) => new Date(event.start) >= windowStart)
    .reduce((sum, { event }) => sum + (new Date(event.end).getTime() - new Date(event.start).getTime()) / 3_600_000, 0)
  const windowEnd = new Date(agreement.validFrom)
  windowEnd.setFullYear(windowEnd.getFullYear() + 1)
  const monthsLeft = Math.max(0, Math.round((windowEnd.getTime() - NOW.getTime()) / 2_592_000_000))
  limits.push({
    id: 'vzdelavani',
    label: 'Vzdělávání pěstounů',
    done: hours,
    target,
    state: hours >= target ? 'splněno' : `chybí ${target - hours} h`,
    source: `Zákon: ${target} h za 12 měsíců · období do ${shortDate(windowEnd)}, tedy ${monthsLeft} měsíce`,
    tone: hours >= target ? 'ok' : monthsLeft <= 3 ? 'blizko' : 'ok',
  })

  // 3. Zápis z návštěvy do N hodin — jediná lhůta, která běží na hodiny,
  //    a jediná, kterou má člověk plně ve svých rukou.
  const noteHours = agreement?.noteDeadlineHours ?? 72
  const lastVisitEntry = timelineEntries
    .filter(({ entry }) => (entry as unknown as { familyId?: string }).familyId === FAMILY_ID && entry.type === 'visit')
    .sort((a, b) => b.entry.occurredAt.localeCompare(a.entry.occurredAt))[0]
  /* POZOR — DÍRA V DATOVÉM MODELU, ne v návrhu: `TimelineEntryDoc` nemá
     `createdAt`, takže se z dat NEDÁ zjistit, KDY zápis vznikl — jen kdy se
     stalo to, o čem je. Lhůtu „zápis do 72 h" proto umíme vyhodnotit jen
     na „existuje / neexistuje", a dokud neexistuje, ukazujeme, kolik času
     z lhůty už uteklo. Až se do modelu `createdAt` doplní, tenhle řádek
     začne říkat i „napsáno za 4 h" bez zásahu do kresby. */
  const written = !!lastVisitEntry?.entry.body?.trim()
  const sinceVisit = lastVisitEntry
    ? Math.round((NOW.getTime() - new Date(lastVisitEntry.entry.occurredAt).getTime()) / 3_600_000)
    : 0
  limits.push({
    id: 'zapis',
    label: 'Zápis z poslední návštěvy',
    done: written ? noteHours : Math.min(sinceVisit, noteHours),
    target: noteHours,
    state: written ? 'splněno' : `zbývá ${Math.max(0, noteHours - sinceVisit)} h`,
    source: written
      ? `Dohoda: do ${noteHours} h od návštěvy · zápis z ${shortDate(lastVisitEntry!.entry.occurredAt)} je hotový`
      : `Dohoda: do ${noteHours} h od návštěvy`,
    tone: written ? 'ok' : sinceVisit > noteHours ? 'po' : 'blizko',
  })

  return limits
}

/** Celý spis jako jeden tok času, od nejnovějšího. */
export function buildSpis(): SpisItem[] {
  const items: SpisItem[] = []

  for (const { docId, entry } of timelineEntries) {
    // `TimelineEntryDoc` nemá `familyId` — zápisy žijí v podkolekci rodiny,
    // takže v produkci je rodina dána cestou. Ve fixtures je navíc, aby se
    // daly držet v jednom poli.
    const owner = (entry as unknown as { familyId?: string }).familyId
    if (owner !== FAMILY_ID) continue
    items.push({
      id: `tl-${docId}`,
      kind: entry.type === 'visit' ? 'navsteva' : 'zapis',
      at: entry.occurredAt,
      title: entry.type === 'visit' ? 'Návštěva v rodině' : entry.type === 'voice_entry' ? 'Telefonát' : 'Poznámka',
      body: entry.body,
      who: staffName(entry.createdByUid) ?? undefined,
      subjects: (entry.subjectRefs ?? []).map(subjectName).filter((x): x is string => !!x),
      // `foster` = sdíleno s pěstouny; cokoli jinak je interní.
      sharing: entry.sharingLevel === 'foster' ? 'partner' : 'internal',
    })
  }

  for (const { docId, event } of calendarEvents) {
    if (!(event.subjectKeys ?? []).some((k) => k === `family:${FAMILY_ID}`)) continue
    items.push({
      id: `ev-${docId}`,
      kind: 'udalost',
      at: event.start,
      title: event.title,
      who: staffName(event.assignedToUid) ?? undefined,
      subjects: (event.subjectRefs ?? []).map(subjectName).filter((x): x is string => !!x),
    })
  }

  for (const { docId, task } of tasks) {
    const mine = (task.subjectKeys ?? []).some(
      (k) => k === `family:${FAMILY_ID}` || familyChildren.some((c) => k === `child:${c.docId}`),
    )
    if (!mine) continue
    const due = task.dueDate ? new Date(`${task.dueDate}T12:00:00`) : null
    items.push({
      id: `tk-${docId}`,
      kind: 'ukol',
      at: (due ?? new Date(task.createdAt)).toISOString(),
      title: task.title,
      body: task.notes ?? undefined,
      who: staffName(task.assignedToUid) ?? undefined,
      done: task.status === 'hotovo',
      urgent: task.status !== 'hotovo' && !!due && due < NOW,
      subjects: (task.subjectRefs ?? []).map(subjectName).filter((x): x is string => !!x),
    })
  }

  // Lhůta návštěvy je taky položka času — je to nejdůležitější budoucí bod
  // spisu a nikde jinde ho vidět není.
  const due = nextVisitDue()
  items.push({
    id: 'lhuta-navsteva',
    kind: 'lhuta',
    at: due.at.toISOString(),
    title: due.overdue
      ? `Návštěva po termínu o ${dayCount(due.daysLeft)}`
      : `Termín osobní návštěvy — zbývá ${dayCount(due.daysLeft)}`,
    body: `Interval z Dohody: ${dayCount(agreement?.visitIntervalDays ?? 60)}.`,
    urgent: due.overdue || due.daysLeft <= 14,
  })

  return items.sort((a, b) => b.at.localeCompare(a.at))
}
