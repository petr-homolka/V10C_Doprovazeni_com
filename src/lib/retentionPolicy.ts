/**
 * RETENČNÍ POLITIKA — jak dlouho co držíme a co se s tím pak stane.
 *
 * PROČ: dneska se ze systému nemaže nic, nikdy. To není jen technický dluh,
 * je to rozpor se zásadou omezení uložení (GDPR čl. 5 odst. 1 písm. e):
 * osobní údaje se smějí držet jen po dobu nezbytnou pro účel, pro který se
 * zpracovávají. U spisu dítěte v pěstounské péči je ta doba dlouhá — ale
 * „dlouhá" není totéž co „navždy" a hlavně musí být NĚJAKÁ, napsaná,
 * doložitelná a skutečně vykonávaná.
 *
 * PROČ TABULKA A NE `if`y PO KÓDU: až se lhůta změní (a změní se), musí to
 * být jedna změna na jednom místě, ne hledání po dvaceti službách. Tabulka
 * je zároveň to, co se dá vytisknout a přiložit ke směrnici organizace.
 *
 * ————————————————————————————————————————————————————————————————
 * CO TENHLE SOUBOR ZÁMĚRNĚ NEDĚLÁ: nevymýšlí lhůty.
 *
 * Většina pravidel má `status: 'needs_decision'` a `keepMonths: null`.
 * Není to nedodělek — je to poctivé přiznání, že archivační doba pro
 * dokumentaci o dítěti v náhradní rodinné péči je právní otázka
 * (skartační řád organizace, zákon o archivnictví, ZSPOD), ne něco, co má
 * odhadnout programátor. Dokud lhůta není rozhodnutá, systém drží data
 * dál a v Nastavení svítí, že se o tom má rozhodnout. To je bezpečnější
 * chyba než smazat spis, který měl zůstat.
 *
 * Rozhodnuté (`active`) jsou jen ty kategorie, kde je odpověď provozní,
 * ne právní — typicky pracovní mezisklady, které vznikly jako kopie
 * a originál pořád existuje jinde.
 * ————————————————————————————————————————————————————————————————
 */

/** Od čeho se lhůta počítá. */
export type RetentionAnchor =
  /** Od vzniku záznamu. */
  | 'createdAt'
  /** Od dokončení dávkové úlohy (import, záloha). */
  | 'finishedAt'
  /** Od skončení Dohody, ke které záznam patří. */
  | 'agreementEnded'
  /** Od poslední aktivity (zájemce, se kterým se rok nic nedělo). */
  | 'lastActivity'

export const RETENTION_ANCHOR_LABELS: Record<RetentionAnchor, string> = {
  createdAt: 'od vzniku záznamu',
  finishedAt: 'od dokončení úlohy',
  agreementEnded: 'od skončení Dohody',
  lastActivity: 'od poslední aktivity',
}

export type RetentionAction =
  /** Záznam zmizí. */
  | 'delete'
  /** Záznam zůstane, ale osobní údaje se z něj vymažou (statistika přežije). */
  | 'anonymize'
  /**
   * Lhůta uplyne a systém se ZEPTÁ. Nic nemaže — vedení rozhodne.
   * U dokumentace o dítěti je tohle jediná přípustná akce: třicetiletá
   * lhůta je MINIMUM, po kterém teprve začíná úvaha, ne rozsudek smrti
   * nad spisem.
   */
  | 'review'

/**
 * MINIMÁLNÍ archivační doba dokumentace o dítěti v náhradní rodinné péči.
 * Zadání Petr Homolka, 2026-07-25: 30 let, a po jejich uplynutí se systém
 * ZEPTÁ (rozhoduje vedení), nemaže sám.
 *
 * Jedno číslo na jednom místě — mění se tady a projeví se v politice,
 * v termínu revize u každé ukončené Dohody i v textech na obrazovce.
 */
export const RETENTION_CHILD_CARE_YEARS = 30
export const RETENTION_CHILD_CARE_MONTHS = RETENTION_CHILD_CARE_YEARS * 12

export interface RetentionRule {
  key: string
  label: string
  /** Co přesně se maže — lidsky, pro směrnici i pro obrazovku. */
  what: string
  /** Cesta v databázi. Dokumentace; scanner si ji řeší sám. */
  path: string
  anchor: RetentionAnchor
  /** Kolik měsíců se drží. `null` = lhůta ještě není rozhodnutá. */
  keepMonths: number | null
  action: RetentionAction
  /** Proč zrovna tolik — nebo co je potřeba ověřit, než se rozhodne. */
  basis: string
  status: 'active' | 'needs_decision'
}

export const RETENTION_RULES: RetentionRule[] = [
  {
    key: 'import_staging',
    label: 'Nahraná data z importu',
    what: 'Řádky z nahraného .xlsx, ze kterých se založily rodiny, pěstouni a děti.',
    path: 'organizations/{orgId}/importJobs/{jobId}/stagingRecords',
    anchor: 'finishedAt',
    keepMonths: 3,
    action: 'delete',
    basis:
      'Pracovní mezisklad, ne originál: osobní údaje z těchhle řádků už jsou v ostrých ' +
      'záznamech. Po uplynutí lhůty na vrácení importu (30 dnů) je to jen druhá kopie ' +
      'stejných dat navíc. Tři měsíce jsou rezerva na reklamaci importu.',
    status: 'active',
  },
  {
    key: 'import_jobs',
    label: 'Historie importů',
    what: 'Záznam o tom, kdo kdy spustil import a s jakým výsledkem (bez řádků dat).',
    path: 'organizations/{orgId}/importJobs',
    anchor: 'finishedAt',
    keepMonths: null,
    action: 'delete',
    basis:
      'Sám o sobě skoro neobsahuje osobní údaje (jméno toho, kdo import spustil). ' +
      'ROZHODNOUT: má smysl držet stejně dlouho jako auditní stopu, protože je to ' +
      'doklad o původu dat.',
    status: 'needs_decision',
  },
  {
    key: 'backup_jobs',
    label: 'Historie záloh',
    what: 'Záznam o vytvořených zálohách (ne zálohy samotné — ty systém neukládá).',
    path: 'organizations/{orgId}/backupJobs',
    anchor: 'createdAt',
    keepMonths: null,
    action: 'delete',
    basis: 'ROZHODNOUT. Doklad o plnění povinnosti zálohovat — pravděpodobně stejně dlouho jako audit.',
    status: 'needs_decision',
  },
  {
    key: 'foster_prospects',
    label: 'Zájemci, ze kterých nic nebylo',
    what: 'Kontakty a poznámky u zájemců o pěstounství, kteří nikdy nepodepsali Dohodu.',
    path: 'fosterProspects (+ notes)',
    anchor: 'lastActivity',
    keepMonths: null,
    action: 'delete',
    basis:
      'POZOR, tohle je nejexponovanější kategorie: údaje o lidech, kteří se systémem ' +
      'nakonec nemají nic společného, a přesto v něm zůstávají navždy. Právní titul ' +
      'k jejich držení skončil ve chvíli, kdy proces skončil. ROZHODNOUT lhůtu ' +
      '(návrh: 12–24 měsíců od poslední aktivity) a jestli se má mazat, nebo ' +
      'anonymizovat kvůli statistice náboru.',
    status: 'needs_decision',
  },
  {
    key: 'timeline_private',
    label: 'Soukromé poznámky pracovníků',
    what: 'Zápisy označené jako „Soukromé" — vidí je jen jejich autor.',
    path: 'families/{familyId}/timeline (sharing: private)',
    anchor: 'agreementEnded',
    keepMonths: null,
    action: 'delete',
    basis:
      'Nejsou součástí spisu, který se předává ani archivuje — je to pracovní pomůcka ' +
      'konkrétního člověka. ROZHODNOUT: po skončení Dohody nemají účel, ale mazat cizí ' +
      'poznámky automaticky je zásah, na který musí být organizace připravená.',
    status: 'needs_decision',
  },
  {
    key: 'messages',
    label: 'Chat s pěstounem',
    what: 'Zprávy mezi klíčovou osobou a pěstounem, včetně interních poznámek.',
    path: 'families/{familyId}/messages',
    anchor: 'agreementEnded',
    keepMonths: null,
    action: 'delete',
    basis:
      'ROZHODNOUT. Chat může být důkazem o komunikaci (kdy byla rodina na něco ' +
      'upozorněna), takže patrně stejná lhůta jako spis — ale to je právě to ' +
      'rozhodnutí, které tu chybí.',
    status: 'needs_decision',
  },
  {
    key: 'documents_draft',
    label: 'Koncepty dokumentů, které nikam neodešly',
    what: 'Rozepsané dokumenty ve stavu koncept, které se nikdy nestaly konečnými.',
    path: 'families/{familyId}/documents (status: draft)',
    anchor: 'createdAt',
    keepMonths: null,
    action: 'delete',
    basis: 'ROZHODNOUT. Nikdy neopustily organizaci, ale mohou obsahovat citlivé formulace o dítěti.',
    status: 'needs_decision',
  },
  {
    key: 'closed_case_file',
    label: 'Spis po skončení Dohody',
    what: 'Zápisy, dokumenty, zprávy pro OSPOD a evidence u rodiny, se kterou už organizace Dohodu nemá.',
    path: 'families/{familyId}/** (segment ukončené Dohody)',
    anchor: 'agreementEnded',
    keepMonths: RETENTION_CHILD_CARE_MONTHS,
    action: 'review',
    basis:
      'Třicet let od skončení Dohody je MINIMÁLNÍ doba, ne lhůta ke smazání — proto ' +
      'akce „zeptat se", ne „smazat". Po uplynutí systém vyzve vedení k rozhodnutí a ' +
      'do té doby se nesmaže nic. Během těch třiceti let si organizace volí, jestli ' +
      'spis drží v běžném provozu, nebo ho archivuje (zneviditelní — viz ' +
      '`archiveSegment` v agreementService.ts). Archivace NENÍ mazání ani zkrácení ' +
      'lhůty, jen uklizení z cesty. Netýká se testovacích dat (`dataClass: test`).',
    status: 'active',
  },
  {
    key: 'audit_log',
    label: 'Auditní stopa',
    what: 'Záznamy o tom, kdo co udělal.',
    path: 'organizations/{orgId}/auditLog',
    anchor: 'createdAt',
    keepMonths: null,
    action: 'delete',
    basis:
      'ROZHODNOUT — a pozor na past: auditní stopa musí přežít DÉLE než to, co ' +
      'zaznamenává, jinak zmizí důkaz dřív než děj. Zároveň se sama nedá smazat ' +
      'z aplikace (firestore.rules `delete: if false`), takže její úklid bude vždy ' +
      'vědomý zásah přes admin SDK, ne tlačítko v appce.',
    status: 'needs_decision',
  },
]

/**
 * Datum, ke kterému je záznam „za lhůtou". Vrací `null`, když lhůta není
 * rozhodnutá — volající to musí umět, právě proto to není číslo.
 */
export function retentionCutoff(rule: RetentionRule, today: Date = new Date()): string | null {
  if (rule.keepMonths === null) return null
  const cutoff = new Date(today)
  cutoff.setMonth(cutoff.getMonth() - rule.keepMonths)
  return cutoff.toISOString()
}

/** Je záznam s tímhle kotevním datem za lhůtou? */
export function isPastRetention(
  rule: RetentionRule,
  anchorDate: string | null | undefined,
  today: Date = new Date(),
): boolean {
  const cutoff = retentionCutoff(rule, today)
  if (!cutoff || !anchorDate) return false
  return anchorDate < cutoff
}

/**
 * Kdy se má vedení zeptat, co dál se spisem. Počítá se od skončení Dohody
 * a ukládá se na Dohodu (`retentionReviewDueAt`), aby to šlo číst bez
 * dopočítávání a aby zůstalo zafixované i kdyby se lhůta v budoucnu
 * změnila — u záznamu má platit ta, která platila při ukončení.
 */
export function retentionReviewDueDate(agreementEndedAt: string): string {
  const due = new Date(agreementEndedAt)
  due.setFullYear(due.getFullYear() + RETENTION_CHILD_CARE_YEARS)
  return due.toISOString()
}

/** Je termín revize už za námi? */
export function isRetentionReviewDue(reviewDueAt: string | null | undefined, today: Date = new Date()): boolean {
  return !!reviewDueAt && reviewDueAt <= today.toISOString()
}

export interface RetentionSummary {
  total: number
  active: number
  needsDecision: number
}

export function summarizeRetention(rules: RetentionRule[] = RETENTION_RULES): RetentionSummary {
  return {
    total: rules.length,
    active: rules.filter((r) => r.status === 'active').length,
    needsDecision: rules.filter((r) => r.status === 'needs_decision').length,
  }
}

/** Lidský popis lhůty — „3 měsíce od dokončení úlohy" / „nerozhodnuto". */
export function describeRetention(rule: RetentionRule): string {
  if (rule.keepMonths === null) return 'Lhůta není rozhodnutá — data se drží dál.'
  const years = rule.keepMonths / 12
  const period =
    rule.keepMonths % 12 === 0 && years >= 1
      ? `${years} ${years === 1 ? 'rok' : years < 5 ? 'roky' : 'let'}`
      : `${rule.keepMonths} ${rule.keepMonths < 5 ? 'měsíce' : 'měsíců'}`
  return `${period} ${RETENTION_ANCHOR_LABELS[rule.anchor]}`
}
