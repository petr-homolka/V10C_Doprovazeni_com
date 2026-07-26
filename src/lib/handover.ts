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
 *  prevod     DOKONČOVACÍ OBDOBÍ, 90 dní. Běží od ZÁNIKU staré Dohody —
 *             tedy od 30. 6. nebo 31. 12., protože jindy Dohoda skončit
 *             nemůže (viz agreementLaw.ts). Nová Dohoda navazuje dnem
 *             následujícím, takže dvě aktivní Dohody vedle sebe NIKDY
 *             nestojí; překrývá se jen PŘÍSTUP:
 *               • nová organizace spis od prvního dne vede,
 *               • stará ho už nevede, ale ještě 90 dní SMÍ zapisovat do
 *                 svého segmentu — potřebuje dopsat předávací protokoly
 *                 a odhlášení pro OSPOD, a to bez práva zápisu nejde.
 *                 Nové zápisy druhé organizace nevidí.
 *             Stará může kdykoli sama uzavřít a archivovat. Po 90 dnech
 *             se archivuje sama.
 *
 *  archivovano  Organizace spis uklidila z provozu. Data jsou nedotčená,
 *             jen neviditelná (viz retentionPolicy.ts). Je to stav
 *             SEGMENTU — jedné organizace, ne celého UID.
 *
 *  spanek     Stará organizace uzavřela a archivovala, nová si UID
 *             nepřevzala. Pěstoun mohl podepsat s organizací MIMO náš
 *             systém — nebo nepodepsal nikde. UID čeká, klidně roky.
 *             NIKDY se nemaže; historie zůstává celá. Je to stav UID,
 *             ne segmentu.
 *
 * ─── OPRAVA PŘEDPOKLADU, 2026-07-26 odpoledne ─────────────────────────
 *
 * Tady dřív stálo, že jeden pěstoun může mít při souběžné péči o víc dětí
 * několik Dohod s RŮZNÝMI organizacemi zároveň. Metodika MPSV (aktualizace
 * 20. 1. 2026) to VYVRACÍ: osoba pečující smí mít v daném čase uzavřenu
 * jen JEDNU dohodu s JEDNÍM doprovázejícím subjektem. Další dítě se řeší
 * změnou stávající dohody, ne novou. Jediná výjimka — manželé, kteří spolu
 * nežijí, každý s dítětem ve výlučné péči.
 *
 * Hlídá to `canOpenNewTitle()` v `agreementLaw.ts`, kde jsou i lhůty.
 *
 * ─── Co tenhle soubor záměrně NEŘEŠÍ ──────────────────────────────────
 *
 * Výlučnost právního titulu (kolik Dohod smí osoba mít) je věc
 * `agreementLaw.ts`. Tady se řeší jen to, kdo SPIS spravuje: v jednu
 * chvíli jedna organizace, a v dokončovacím období ta nová plus ta stará
 * s právem dopsat vlastní segment.
 */

import { WIND_DOWN_DAYS } from './agreementLaw'

/**
 * Délka dokončovacího období. Je to TÁŽ lhůta jako `WIND_DOWN_DAYS`
 * v `agreementLaw.ts` — schválně odvozená, ne opsaná, aby se dvě „devadesátky"
 * v kódu nemohly rozejít.
 */
export const HANDOVER_WINDOW_DAYS = WIND_DOWN_DAYS

/**
 * Pět stavů. POZOR na to, že nežijí všechny na stejné úrovni:
 *
 *   zajemce, aktivni, prevod, archivovano  … stav SEGMENTU (jedné organizace)
 *   aktivni, prevod, spanek                … stav UID (napříč organizacemi)
 *
 * `archivovano` je proto stav segmentu, ale nikdy ne celého UID: když
 * archivují všichni, UID není „archivované", je ve `spanku` a čeká na
 * další organizaci. A `spanek` naopak nedává smysl u jednoho segmentu.
 * Držet to v jednom výčtu je schválně — jsou to fáze téhož života a dva
 * paralelní výčty by se do měsíce rozešly.
 */
export type UidLifecycle = 'zajemce' | 'aktivni' | 'prevod' | 'archivovano' | 'spanek'

export const UID_LIFECYCLE_LABELS: Record<UidLifecycle, string> = {
  zajemce: 'Zájemce',
  aktivni: 'Aktivní',
  prevod: 'Běží převod dohody',
  archivovano: 'Archivováno',
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
 * `null` = organizaci už tenhle segment nic neříká (ukončený a neuklizený).
 */
export function segmentLifecycle(segment: SegmentState, now: Date = new Date()): UidLifecycle | null {
  if (segment.archivedAt) return 'archivovano'
  if (segment.handoverStartedAt) {
    // Po vypršení lhůty se segment CHOVÁ jako archivovaný, i když ho
    // ještě nikdo fyzicky nearchivoval — automatické doarchivování je
    // líné (proběhne při prvním čtení, viz agreementService).
    return isHandoverExpired(segment.handoverDeadline, now) ? 'archivovano' : 'prevod'
  }
  return segment.status === 'active' ? 'aktivni' : null
}

/** Pracuje s tímhle segmentem organizace ještě aktivně? */
export function isLiveSegment(segment: SegmentState, now: Date = new Date()): boolean {
  const state = segmentLifecycle(segment, now)
  return state === 'aktivni' || state === 'prevod'
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
  return isLiveSegment(segment, now)
}

/**
 * Stav celého UID napříč všemi organizacemi. Tohle je ta autorita, na
 * kterou se ptá nová organizace, když zadá UID.
 */
export function uidLifecycle(segments: SegmentState[], now: Date = new Date()): UidLifecycle {
  const states = segments.map((s) => segmentLifecycle(s, now))
  if (states.includes('prevod')) return 'prevod'
  if (states.includes('aktivni')) return 'aktivni'
  // Ani samé „archivovano" nedělá z UID archivované — UID se archivovat
  // nedá, jen čeká na další organizaci.
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
  /**
   * Podepsat jde, ale něco to má. Schválně oddělené od `blockedReason`:
   * varování se ukáže a jde přes něj projít, blokace ne.
   */
  warning?: string
}

/**
 * Doprovázející subjekt MIMO náš systém. Typicky OSPOD, který vydal
 * správní rozhodnutí a doprovází sám, nebo konkurenční organizace.
 *
 * Nevidíme u něj nic — ani kdy jeho titul skončí. Proto se s ním nedá
 * zacházet jako s naším segmentem: nejde říct „už skončil", jde jen říct
 * „naposledy jsme věděli tohle".
 */
export interface ExternalAccompaniment {
  subjectName: string
  /** Co o konci víme, když něco. `null` = nevíme nic. */
  knownEndsAt?: string | null
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
  /** Víme o doprovázení mimo náš systém? (OSPOD, cizí organizace.) */
  external: ExternalAccompaniment | null = null,
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
        'UID v našem systému nikdo nespravuje. Podpisem se spis probudí u vás a dostanete ' +
        'dohodnutý rozsah historie. Žádná jiná organizace se nic neztratí.',
      // Spánek u NÁS neznamená, že osobu nikdo nedoprovází — doprovázet ji
      // může OSPOD nebo organizace mimo systém, a pak platí výlučnost
      // titulu úplně stejně. Nesmíme to zablokovat (konec cizího titulu
      // nevidíme a systém by se tím dal zamknout napořád), ale zamlčet
      // taky ne: kdo podepíše, ať ví, co si má ověřit.
      warning: external
        ? `Podle poslední známé informace osobu doprovází ${external.subjectName} — subjekt mimo ` +
          'náš systém. Souběžně mohou platit dva tituly jen u manželů žijících odděleně. ' +
          'Před podpisem si ověřte, že předchozí doprovázení skončilo' +
          (external.knownEndsAt ? ` (evidujeme konec k ${external.knownEndsAt.slice(0, 10)}).` : ' — datum konce u sebe nemáme.')
        : undefined,
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
