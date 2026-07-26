/**
 * ZÁKONNÉ LHŮTY A OMEZENÍ KOLEM DOHODY O VÝKONU PĚSTOUNSKÉ PÉČE.
 *
 * Zdroj: metodika MPSV „Doprovázení pěstounů, dohody o výkonu pěstounské
 * péče", aktualizace 20. 1. 2026, a § 47a–47c zákona č. 359/1999 Sb.
 * Přinesl Petr Homolka 2026-07-26 a několik našich dosavadních předpokladů
 * to vyvrací — proto to jde do kódu jako pravidla s testy, ne jako
 * poznámka v hlavě.
 *
 * ─── Co z metodiky plyne a co jsme měli špatně ────────────────────────
 *
 * 1. JEDNA OSOBA = NEJVÝŠ JEDNA AKTIVNÍ DOHODA.
 *    „Osoba pečující nebo osoba v evidenci může mít v daném čase uzavřenu
 *    pouze jednu dohodu s jedním doprovázejícím subjektem."
 *    Dosavadní předpoklad, že pěstoun může mít na každé dítě dohodu
 *    s jinou organizací, NEPLATÍ. Přijetí dalšího dítěte se řeší ZMĚNOU
 *    stávající dohody, ne novou dohodou.
 *
 *    Jediná výjimka, kterou metodika připouští: každý z manželů má dítě
 *    ve výlučné péči A manželé spolu NEŽIJÍ ve společné domácnosti.
 *
 * 2. MANŽELÉ = JEDNA DOHODA. Tím se ruší dřívější zadání „dva pěstouni
 *    ve společné péči = dvě dohody".
 *
 * 3. DOHODA SE NEDÁ UKONČIT KDYKOLI. Zaniká jen k 30. 6. nebo 31. 12.,
 *    a výpověď musí být doručena nejpozději 30 dnů předem. Doručí-li se
 *    později, posouvá se konec na závěr NÁSLEDUJÍCÍHO pololetí.
 *
 * 4. DOPROVÁZENÍ NEMUSÍ STÁT NA SMLOUVĚ. Neuzavře-li se dohoda do 30 dnů,
 *    OSPOD vydá SPRÁVNÍ ROZHODNUTÍ o úpravě práv a povinností. Systém
 *    musí umět oba právní tituly, ne jen smlouvu.
 */

/** Právní titul doprovázení — smlouva, nebo rozhodnutí úřadu. */
export type LegalTitleKind = 'dohoda' | 'spravni_rozhodnuti'

export const LEGAL_TITLE_LABELS: Record<LegalTitleKind, string> = {
  dohoda: 'Dohoda o výkonu pěstounské péče',
  spravni_rozhodnuti: 'Správní rozhodnutí o právech a povinnostech',
}

/** Lhůta na uzavření dohody od právní moci rozhodnutí o svěření. */
export const AGREEMENT_DEADLINE_DAYS = 30

/** Výpověď musí být doručena nejpozději tolik dnů před koncem pololetí. */
export const NOTICE_DAYS_BEFORE_HALF_YEAR_END = 30

function utc(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0))
}

/** Konec pololetí, do kterého datum spadá: 30. 6. nebo 31. 12. */
export function halfYearEnd(at: Date): Date {
  const year = at.getUTCFullYear()
  return at.getUTCMonth() <= 5 ? utc(year, 5, 30) : utc(year, 11, 31)
}

/** Konec pololetí následujícího po tom, do kterého datum spadá. */
export function nextHalfYearEnd(at: Date): Date {
  const year = at.getUTCFullYear()
  return at.getUTCMonth() <= 5 ? utc(year, 11, 31) : utc(year + 1, 5, 30)
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

/**
 * KDY DOHODA SKUTEČNĚ SKONČÍ, když výpověď dorazí v tenhle den.
 *
 * § 47c odst. 5, 6: výpovědní doba končí k poslednímu dni pololetí, ve
 * kterém byla dohoda vypovězena — ale jen když výpověď dorazila aspoň
 * 30 dnů před jeho koncem. Jinak se to posouvá o celé pololetí.
 *
 * Prakticky to znamená, že přechod k jiné organizaci se nedá „stihnout
 * do měsíce": kdo podá výpověď 15. června, končí až 31. prosince.
 */
export function terminationEffectiveDate(noticeDeliveredAt: Date): Date {
  const end = halfYearEnd(noticeDeliveredAt)
  return daysBetween(noticeDeliveredAt, end) >= NOTICE_DAYS_BEFORE_HALF_YEAR_END
    ? end
    : nextHalfYearEnd(noticeDeliveredAt)
}

/** Nová dohoda navazuje dnem po zániku té staré. */
export function nextTitleStartDate(terminationDate: Date): Date {
  const next = new Date(terminationDate)
  next.setUTCDate(next.getUTCDate() + 1)
  return next
}

/**
 * Dokdy musí být uzavřen právní titul. Počítá se od právní moci
 * rozhodnutí o svěření (nebo o zařazení do evidence u PPPD) — a stejná
 * třicetidenní lhůta platí i po zániku předchozí dohody.
 */
export function titleDeadline(effectiveFrom: Date): Date {
  const deadline = new Date(effectiveFrom)
  deadline.setUTCDate(deadline.getUTCDate() + AGREEMENT_DEADLINE_DAYS)
  return deadline
}

/** Kolik dnů zbývá do konce lhůty na uzavření (záporné = po termínu). */
export function daysToTitleDeadline(effectiveFrom: Date, now: Date = new Date()): number {
  return daysBetween(now, titleDeadline(effectiveFrom))
}

// ─── Výlučnost právního titulu ─────────────────────────────────────────

/** Minimum o právním titulu, ze kterého se dá posoudit výlučnost. */
export interface LegalTitleState {
  organizationId: string
  validFrom: string
  validTo?: string | null
}

function isRunning(title: LegalTitleState, at: Date): boolean {
  const day = at.toISOString()
  if (title.validFrom > day) return false
  return !title.validTo || title.validTo > day
}

export interface ExclusivityCheck {
  ok: boolean
  reason?: string
  /** Organizace, u které už titul běží. */
  conflictingOrgId?: string
}

/**
 * SMÍ TAHLE OSOBA UZAVŘÍT DALŠÍ PRÁVNÍ TITUL?
 *
 * Tvrdé pravidlo z metodiky: v daném čase nejvýš jeden. Přijetí dalšího
 * dítěte se řeší ZMĚNOU stávajícího titulu, ne novým — proto tahle
 * kontrola nesmí jít obejít „vždyť je to jiné dítě".
 *
 * `spousesLivingApart` je jediná zákonná výjimka: každý z manželů má dítě
 * ve výlučné péči a manželé spolu nežijí ve společné domácnosti, takže
 * péči fakticky vykonává každý sám. Je to vědomě POVINNÝ parametr — kdo
 * chce výjimku použít, musí ji výslovně potvrdit, ne ji dostat mlčky.
 */
export function canOpenNewTitle(
  existingTitles: LegalTitleState[],
  spousesLivingApart: boolean,
  at: Date = new Date(),
): ExclusivityCheck {
  const running = existingTitles.filter((t) => isRunning(t, at))
  if (running.length === 0) return { ok: true }
  if (spousesLivingApart) return { ok: true }
  return {
    ok: false,
    conflictingOrgId: running[0].organizationId,
    reason:
      'Osoba pečující může mít v daném čase jen jeden právní titul doprovázení. ' +
      'Další dítě se řeší změnou stávající dohody, ne novou. Přechod k jiné organizaci ' +
      'je možný až po zániku té stávající (k 30. 6. nebo 31. 12.).',
  }
}

/**
 * DOKONČOVACÍ LHŮTA PO ZÁNIKU DOHODY — a proč to není „druhá aktivní
 * dohoda".
 *
 * Petrovo zadání z 26. 7. chtělo 90 dní, kdy je spis „aktivní u obou"
 * organizací, aby stará stihla předávací protokoly a odhlášení pro OSPOD.
 * Podle metodiky ale dvě aktivní dohody současně existovat NEMOHOU: stará
 * zaniká k 30. 6. / 31. 12. a nová navazuje dnem následujícím.
 *
 * Zachovaný je tedy ZÁMĚR, ne forma: po zániku vlastní dohody si původní
 * organizace ještě 90 dní udrží PŘÍSTUP KE SVÉMU SEGMENTU s právem zápisu,
 * aby dokončila, co musí. Není to prodloužená dohoda ani nárok na nové
 * údaje — je to dokončovací okno k datům, která už má.
 */
export const WIND_DOWN_DAYS = 90

export function windDownEnd(terminationDate: Date): Date {
  const end = new Date(terminationDate)
  end.setUTCDate(end.getUTCDate() + WIND_DOWN_DAYS)
  return end
}

export function isWithinWindDown(terminationDate: Date, now: Date = new Date()): boolean {
  return now <= windDownEnd(terminationDate)
}
