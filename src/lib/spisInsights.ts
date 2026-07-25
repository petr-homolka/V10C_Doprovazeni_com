import { EDUCATION_HOURS_TARGET, type AgreementDoc } from '@/types/agreement'
import type { CalendarEventDoc } from '@/types/calendarEvent'
import type { SubjectRef, TimelineEntryDoc } from '@/types/timelineEntry'

/**
 * CO SE DÁ O SPISU SPOČÍTAT — čistá logika, žádné kreslení.
 *
 * Tohle je věc, kterou tabulka v Excelu neumí a kvůli které tahle appka
 * existuje: ne uložit adresu, ale VĚDĚT, že za dva dny propadne zákonná
 * lhůta a že jedno ze dvou dětí nikdo půl roku neviděl osobně.
 *
 * Proč je to knihovna a ne kus stránky: čísla, která se ukazují na profilu,
 * musí být ověřitelná. Když se spočítají špatně, obrazovka LŽE — a to se
 * pohledem nepozná, na rozdíl od ošklivého odsazení. Proto sem nepatří nic
 * z Reactu a proto to má testy.
 */

/** Česky správný počet dní — „1 den", „3 dny", „12 dní". */
export function dayCount(n: number): string {
  const abs = Math.abs(n)
  if (abs === 1) return `${abs} den`
  if (abs >= 2 && abs <= 4) return `${abs} dny`
  return `${abs} dní`
}

/** Krátké datum („22. 7."), s rokem jen když nejde o letošní. */
export function shortDate(value: Date | string, now: Date = new Date()): string {
  const d = typeof value === 'string' ? new Date(value) : value
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

const DAY_MS = 86_400_000

/** Kolik dní je to zpátky (kladné = v minulosti). */
export function daysAgo(value: Date | string, now: Date = new Date()): number {
  const d = typeof value === 'string' ? new Date(value) : value
  return Math.round((now.getTime() - d.getTime()) / DAY_MS)
}

/** Věk z data narození. `null`, když datum chybí — v profilu je pak pomlčka,
 * ne dopočítaná nula. */
export function ageYears(birthDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!birthDate) return null
  const b = new Date(birthDate)
  if (Number.isNaN(b.getTime())) return null
  let years = now.getFullYear() - b.getFullYear()
  const beforeBirthday =
    now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  if (beforeBirthday) years -= 1
  return years
}

/**
 * KDY TUHLE OSOBU NĚKDO NAPOSLEDY VIDĚL OSOBNĚ.
 *
 * Pravidlo přiřazení, které stojí za rozhodnutím: návštěva v rodině se
 * počítá VŠEM PĚSTOUNŮM (byli u ní doma), ale DÍTĚTI jen tehdy, když je
 * v zápisu uvedené jmenovitě (`subjectRefs`). U dětí se totiž kontakt
 * dokládá jmenovitě — „byl jsem v rodině" neznamená „viděl jsem to dítě",
 * a přesně tenhle rozdíl má profil ukázat.
 *
 * Vrací ISO řetězec, ne `Date`, aby se s tím dalo srovnávat i řadit bez
 * převodů.
 */
export function lastSeenInPerson(
  entries: Array<{ entry: TimelineEntryDoc }>,
  ref: Pick<SubjectRef, 'kind' | 'id'>,
): string | null {
  let latest: string | null = null
  for (const { entry } of entries) {
    if (entry.type !== 'visit') continue
    const covered =
      ref.kind === 'fosterPerson' ||
      entry.subjectRefs.some((s) => s.kind === ref.kind && s.id === ref.id)
    if (!covered) continue
    if (!latest || entry.occurredAt > latest) latest = entry.occurredAt
  }
  return latest
}

/**
 * Hodiny vzdělávání za posledních 12 měsíců, sečtené z DÉLKY vzdělávacích
 * událostí. Ne z ručně vyplněného čísla — ruční číslo nikdo neaktualizuje
 * a limit, kterému se nevěří, je k ničemu.
 *
 * Zrušené události se nepočítají (`status: 'zruseno'`).
 */
export function educationHoursInLastYear(
  events: Array<{ event: CalendarEventDoc }>,
  now: Date = new Date(),
): number {
  const from = new Date(now)
  from.setFullYear(from.getFullYear() - 1)
  let hours = 0
  for (const { event } of events) {
    if (event.kind !== 'vzdelavani' || event.status === 'zruseno') continue
    const start = new Date(event.start)
    if (start < from || start > now) continue
    const end = new Date(event.end)
    const length = (end.getTime() - start.getTime()) / 3_600_000
    if (length > 0) hours += length
  }
  return Math.round(hours * 10) / 10
}

export interface CareLimit {
  id: 'navsteva' | 'vzdelavani' | 'zapis'
  label: string
  /** Kolik z limitu je spotřebováno / splněno — pro pruh. */
  done: number
  target: number
  unit: 'dní' | 'h'
  /** Co to znamená lidsky („zbývá 1 den", „splněno"). */
  state: string
  /** Odkud limit je. Bez toho vypadá jako naše vymyšlené pravidlo. */
  source: string
  tone: 'ok' | 'blizko' | 'po'
}

/** Termín další osobní návštěvy z Dohody a poslední návštěvy. */
export function nextVisitDue(
  agreement: Pick<AgreementDoc, 'visitIntervalDays' | 'lastVisitAt'>,
  now: Date = new Date(),
): { at: Date; daysLeft: number; overdue: boolean } | null {
  if (!agreement.lastVisitAt) return null
  const interval = agreement.visitIntervalDays || 60
  const at = new Date(agreement.lastVisitAt)
  at.setDate(at.getDate() + interval)
  const daysLeft = Math.round((at.getTime() - now.getTime()) / DAY_MS)
  return { at, daysLeft, overdue: daysLeft < 0 }
}

/**
 * LHŮTY A LIMITY jedné rodiny.
 *
 * Pruh u každého řádku znamená VŽDYCKY totéž — kolik z limitu je pryč —
 * a jeho barvu určuje TÓN, ne délka: splněná lhůta je klidná šedá, i když je
 * pruh plný. Bez toho vypadal hotový zápis („72 / 72 h") stejně nebezpečně
 * jako propadlá návštěva.
 */
export function buildCareLimits({
  agreement,
  entries,
  educationHours,
  now = new Date(),
}: {
  agreement: AgreementDoc | null
  entries: Array<{ entry: TimelineEntryDoc }>
  educationHours: number
  now?: Date
}): CareLimit[] {
  if (!agreement) return []
  const limits: CareLimit[] = []

  const interval = agreement.visitIntervalDays || 60
  const due = nextVisitDue(agreement, now)
  if (due) {
    const elapsed = Math.min(interval - due.daysLeft, interval)
    limits.push({
      id: 'navsteva',
      label: 'Osobní návštěva v rodině',
      done: Math.max(0, elapsed),
      target: interval,
      unit: 'dní',
      state: due.overdue
        ? `po termínu o ${dayCount(due.daysLeft)}`
        : due.daysLeft === 0
          ? 'termín je dnes'
          : `zbývá ${dayCount(due.daysLeft)}`,
      source: `Dohoda: každých ${dayCount(interval)} · naposledy ${shortDate(agreement.lastVisitAt!, now)}`,
      tone: due.overdue ? 'po' : due.daysLeft <= 14 ? 'blizko' : 'ok',
    })
  } else {
    limits.push({
      id: 'navsteva',
      label: 'Osobní návštěva v rodině',
      done: 0,
      target: interval,
      unit: 'dní',
      state: 'zatím žádná návštěva',
      source: `Dohoda: každých ${dayCount(interval)}`,
      tone: 'blizko',
    })
  }

  const target = agreement.educationHoursTarget ?? EDUCATION_HOURS_TARGET[agreement.careType]
  const windowEnd = new Date(agreement.validFrom)
  while (windowEnd < now) windowEnd.setFullYear(windowEnd.getFullYear() + 1)
  const monthsLeft = Math.max(0, Math.round((windowEnd.getTime() - now.getTime()) / (30 * DAY_MS)))
  limits.push({
    id: 'vzdelavani',
    label: 'Vzdělávání pěstounů',
    done: Math.min(educationHours, target),
    target,
    unit: 'h',
    state: educationHours >= target ? 'splněno' : `chybí ${Math.round((target - educationHours) * 10) / 10} h`,
    source: `Zákon: ${target} h za 12 měsíců · období do ${shortDate(windowEnd, now)}, tedy ${monthsLeft} měsíce`,
    tone: educationHours >= target ? 'ok' : monthsLeft <= 3 ? 'blizko' : 'ok',
  })

  /* POZOR — DÍRA V DATOVÉM MODELU, ne v návrhu: `TimelineEntryDoc` nemá
     `createdAt`, takže se z dat nedá zjistit, KDY zápis vznikl, jen kdy se
     stalo to, o čem je. Lhůtu „zápis do N hodin" proto umíme vyhodnotit jen
     na „existuje / neexistuje", a dokud zápis chybí, ukazujeme, kolik času
     z lhůty už uteklo. Až se `createdAt` doplní, řádek začne říkat i „napsáno
     za 4 h" bez zásahu do kresby. */
  const noteHours = agreement.noteDeadlineHours || 72
  const lastVisit = [...entries]
    .filter(({ entry }) => entry.type === 'visit')
    .sort((a, b) => b.entry.occurredAt.localeCompare(a.entry.occurredAt))[0]
  if (lastVisit) {
    const written = !!lastVisit.entry.body?.trim()
    const sinceVisit = Math.round((now.getTime() - new Date(lastVisit.entry.occurredAt).getTime()) / 3_600_000)
    limits.push({
      id: 'zapis',
      label: 'Zápis z poslední návštěvy',
      done: written ? noteHours : Math.min(sinceVisit, noteHours),
      target: noteHours,
      unit: 'h',
      state: written ? 'splněno' : `zbývá ${Math.max(0, noteHours - sinceVisit)} h`,
      source: written
        ? `Dohoda: do ${noteHours} h od návštěvy · zápis z ${shortDate(lastVisit.entry.occurredAt, now)} je hotový`
        : `Dohoda: do ${noteHours} h od návštěvy`,
      tone: written ? 'ok' : sinceVisit > noteHours ? 'po' : 'blizko',
    })
  }

  return limits
}
