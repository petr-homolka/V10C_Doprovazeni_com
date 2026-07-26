/**
 * ŽIVOTNÍ CYKLUS UID — kdo spis spravuje, komu se předává a co se stane,
 * když ho nemá nikdo.
 *
 * Zadání Petr Homolka, 2026-07-26. Celé to stojí na jedné myšlence: UID
 * je věčné a patří ČLOVĚKU, ne organizaci. Organizace se u něj střídají,
 * spis roste dál a systém si pamatuje i období, kdy pěstoun v našem
 * systému vůbec nebyl.
 *
 * ─── Stavy ────────────────────────────────────────────────────────────
 *
 *  zajemce    Nová organizace si UID zavedla do pipeline, ale NEPODEPSALA
 *             Dohodu. Nemá tím pádem k spisu žádný přístup — je to jen
 *             poznámka „jednáme s tímhle číslem". Bez tohohle mezikroku
 *             by organizace musela podepsat naslepo.
 *
 *  aktivni    Organizace má podepsanou Dohodu a spis spravuje.
 *
 *  prevod     PŘECHODNÉ OBDOBÍ, 90 dní. Běží od chvíle, kdy NOVÁ
 *             organizace podepsala Dohodu (ne dřív — zavedení zájemce
 *             lhůtu nespouští). Spis je aktivní u OBOU:
 *               • nová píše a vidí od začátku svoje,
 *               • stará UŽ NEVIDÍ nové zápisy, ale SMÍ dál zapisovat —
 *                 potřebuje dopsat předávací protokoly a odhlášení pro
 *                 OSPOD, a to bez práva zápisu nejde.
 *             Stará může kdykoli sama uzavřít a archivovat. Po 90 dnech
 *             se archivuje sama.
 *
 *  spanek     Stará organizace uzavřela a archivovala, nová si UID
 *             nepřevzala. Pěstoun mohl podepsat s organizací MIMO náš
 *             systém — nebo nepodepsal nikde. UID čeká, klidně roky.
 *             NIKDY se nemaže; historie zůstává celá.
 *
 * ─── Co tenhle soubor záměrně NEŘEŠÍ ──────────────────────────────────
 *
 * Výlučnost NENÍ „jeden pěstoun = jedna organizace". Jeden pěstoun může
 * mít v čase několik dětí, několik Dohod, a při souběžné péči o víc dětí
 * i několik Dohod s RŮZNÝMI organizacemi zároveň. Výlučnost platí na
 * úrovni JEDNOHO SPISU: jeden spis spravuje v jednu chvíli jedna
 * organizace (a během převodu dvě, v jasně vymezených rolích).
 */

/** Délka přechodného období po podpisu nové Dohody. */
export const HANDOVER_WINDOW_DAYS = 90

export type UidLifecycle = 'zajemce' | 'aktivni' | 'prevod' | 'spanek'

export const UID_LIFECYCLE_LABELS: Record<UidLifecycle, string> = {
  zajemce: 'Zájemce',
  aktivni: 'Aktivní',
  prevod: 'Běží převod dohody',
  spanek: 'Spánek — čeká na organizaci',
}

/** Konec přechodného období = podpis nové Dohody + 90 dní. */
export function handoverDeadline(startedAt: string): string {
  const deadline = new Date(startedAt)
  deadline.setDate(deadline.getDate() + HANDOVER_WINDOW_DAYS)
  return deadline.toISOString()
}

/** Kolik dní přechodného období ještě zbývá (0 = vypršelo). */
export function handoverDaysLeft(deadline: string, now: Date = new Date()): number {
  const ms = new Date(deadline).getTime() - now.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000)
}

export function isHandoverExpired(deadline: string | null | undefined, now: Date = new Date()): boolean {
  return !!deadline && new Date(deadline).getTime() <= now.getTime()
}

/**
 * Minimum ze segmentu (Dohody), ze kterého se dá určit stav. Schválně
 * strukturální typ, ne `AgreementDoc` — aby šla logika testovat bez
 * databáze a nešla obejít tím, že si někdo předá „skoro Dohodu".
 */
export interface SegmentState {
  status: 'active' | 'ended'
  archivedAt?: string | null
  /** Nastaveno u STARÉ organizace ve chvíli, kdy nová podepsala. */
  handoverStartedAt?: string | null
  handoverDeadline?: string | null
}

/**
 * Stav jednoho segmentu z pohledu organizace, které patří.
 * `null` = segment už organizaci nic neříká (archivovaný).
 */
export function segmentLifecycle(segment: SegmentState, now: Date = new Date()): UidLifecycle | null {
  if (segment.archivedAt) return null
  if (segment.handoverStartedAt) {
    // Po vypršení lhůty se segment CHOVÁ jako archivovaný, i když ho
    // ještě nikdo fyzicky nearchivoval — automatické doarchivování je
    // líné (proběhne při prvním čtení, viz agreementService).
    return isHandoverExpired(segment.handoverDeadline, now) ? null : 'prevod'
  }
  return segment.status === 'active' ? 'aktivni' : null
}

/**
 * Smí tahle organizace během převodu ještě ZAPISOVAT?
 *
 * Ano — a je to záměr, ne opomenutí. Stará organizace musí po předání
 * dopsat předávací protokol a odhlášení pro OSPOD. Kdyby jí zápis
 * zamrzl v okamžiku podpisu nové Dohody, nemohla by dokončit vlastní
 * zákonné povinnosti.
 *
 * Čtení nových zápisů druhé organizace je jiná věc a řeší ji
 * `firestore.rules` (§4.5): plný zápis vidí VÝHRADNĚ organizace, která
 * ho pořídila. Stará tedy nové zápisy nevidí ne proto, že bychom je
 * schovávali navíc, ale protože je nikdy vidět nemohla.
 */
export function canWriteDuringHandover(segment: SegmentState, now: Date = new Date()): boolean {
  return segmentLifecycle(segment, now) === 'prevod' || segmentLifecycle(segment, now) === 'aktivni'
}

/**
 * Stav celého UID napříč všemi organizacemi. Tohle je ta autorita, na
 * kterou se ptá nová organizace, když zadá UID.
 */
export function uidLifecycle(segments: SegmentState[], now: Date = new Date()): UidLifecycle {
  const states = segments.map((s) => segmentLifecycle(s, now)).filter((s): s is UidLifecycle => s !== null)
  if (states.includes('prevod')) return 'prevod'
  if (states.includes('aktivni')) return 'aktivni'
  return 'spanek'
}

export type TakeoverKind =
  /** UID nikdo nespravuje — nová organizace ho jen probudí. */
  | 'obnovit'
  /** UID někdo spravuje — podpisem začne 90denní převod. */
  | 'prevzit'

export interface TakeoverPlan {
  kind: TakeoverKind
  /** Smí nová organizace vůbec podepsat? */
  allowed: boolean
  /** Proč ne, když ne. */
  blockedReason?: string
  /** Co se stane staré organizaci — lidsky, do potvrzovacího dialogu. */
  consequence: string
}

/**
 * Co se stane, když nová organizace na tomhle UID podepíše Dohodu.
 * ČISTÁ funkce: rozhodnutí je testovatelné bez databáze a bez UI, protože
 * na něm visí ukončení cizí Dohody — to není místo na improvizaci.
 */
export function planTakeover(
  segments: SegmentState[],
  /** Má nová organizace UID aspoň zavedené jako zájemce? */
  hasProspect: boolean,
  now: Date = new Date(),
): TakeoverPlan {
  const state = uidLifecycle(segments, now)

  if (!hasProspect) {
    return {
      kind: state === 'spanek' ? 'obnovit' : 'prevzit',
      allowed: false,
      blockedReason:
        'UID musí být nejdřív zavedené jako zájemce. Podepsat Dohodu jde až z toho stavu — ' +
        'aby se cizí spis nedal převzít jedním kliknutím.',
      consequence: '',
    }
  }

  if (state === 'prevod') {
    return {
      kind: 'prevzit',
      allowed: false,
      blockedReason:
        'Na tomhle UID už jeden převod běží. Počkejte, než skončí — dvě současná předání by ' +
        'znamenala, že spis spravují tři organizace naráz.',
      consequence: '',
    }
  }

  if (state === 'spanek') {
    return {
      kind: 'obnovit',
      allowed: true,
      consequence:
        'UID nikdo nespravuje. Podpisem se spis probudí u vás a dostanete dohodnutý rozsah historie. ' +
        'Žádná jiná organizace se nic neztratí.',
    }
  }

  return {
    kind: 'prevzit',
    allowed: true,
    consequence:
      `Spis dnes spravuje jiná organizace. Podpisem začne ${HANDOVER_WINDOW_DAYS}denní přechodné období: ` +
      'dosavadní organizace přestane vidět nové zápisy, ale bude moci dopsat předávací protokoly ' +
      `a odhlášení pro OSPOD. Po ${HANDOVER_WINDOW_DAYS} dnech se jí spis archivuje sám.`,
  }
}
