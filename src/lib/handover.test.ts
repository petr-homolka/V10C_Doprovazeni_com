import { describe, expect, it } from 'vitest'
import {
  HANDOVER_WINDOW_DAYS,
  canWriteDuringHandover,
  handoverDaysLeft,
  handoverDeadline,
  isHandoverExpired,
  planTakeover,
  segmentLifecycle,
  uidLifecycle,
  type SegmentState,
} from './handover'

const NOW = new Date('2026-07-26T12:00:00.000Z')

const active: SegmentState = { status: 'active' }
const ended: SegmentState = { status: 'ended' }
const archived: SegmentState = { status: 'ended', archivedAt: '2026-01-01T00:00:00.000Z' }
const inHandover: SegmentState = {
  status: 'active',
  handoverStartedAt: '2026-07-01T00:00:00.000Z',
  handoverDeadline: handoverDeadline('2026-07-01T00:00:00.000Z'),
}
const handoverExpired: SegmentState = {
  status: 'active',
  handoverStartedAt: '2026-01-01T00:00:00.000Z',
  handoverDeadline: handoverDeadline('2026-01-01T00:00:00.000Z'),
}

describe('přechodné období', () => {
  it('trvá 90 dní', () => {
    expect(HANDOVER_WINDOW_DAYS).toBe(90)
    expect(handoverDeadline('2026-07-01T00:00:00.000Z').slice(0, 10)).toBe('2026-09-29')
  })

  it('počítá zbývající dny a nikdy nejde pod nulu', () => {
    expect(handoverDaysLeft('2026-08-01T12:00:00.000Z', NOW)).toBe(6)
    expect(handoverDaysLeft('2026-07-01T12:00:00.000Z', NOW)).toBe(0)
  })

  it('pozná vypršení', () => {
    expect(isHandoverExpired('2026-07-01T00:00:00.000Z', NOW)).toBe(true)
    expect(isHandoverExpired('2026-12-01T00:00:00.000Z', NOW)).toBe(false)
    expect(isHandoverExpired(null, NOW)).toBe(false)
  })
})

describe('stav jednoho segmentu', () => {
  it('aktivní Dohoda = aktivní', () => {
    expect(segmentLifecycle(active, NOW)).toBe('aktivni')
  })

  it('běžící převod = převod', () => {
    expect(segmentLifecycle(inHandover, NOW)).toBe('prevod')
  })

  it('archivovaný segment má vlastní stav, ne prázdno', () => {
    expect(segmentLifecycle(archived, NOW)).toBe('archivovano')
  })

  it('ukončená Dohoda bez archivace taky nic neříká', () => {
    expect(segmentLifecycle(ended, NOW)).toBeNull()
  })

  /**
   * Po 90 dnech se segment chová jako archivovaný i bez toho, aby ho
   * někdo fyzicky archivoval. Kdyby se choval dál jako „převod", držela
   * by si stará organizace přístup navěky jen tím, že nic neudělá.
   */
  it('po vypršení lhůty se chová jako archivovaný, i když ho nikdo neuklidil', () => {
    expect(segmentLifecycle(handoverExpired, NOW)).toBe('archivovano')
  })
})

describe('právo zápisu během převodu', () => {
  it('stará organizace SMÍ zapisovat — musí dopsat protokoly a odhlášení pro OSPOD', () => {
    expect(canWriteDuringHandover(inHandover, NOW)).toBe(true)
  })

  it('po vypršení lhůty už zapisovat nesmí', () => {
    expect(canWriteDuringHandover(handoverExpired, NOW)).toBe(false)
  })

  it('archivovaný segment zapisovat nesmí', () => {
    expect(canWriteDuringHandover(archived, NOW)).toBe(false)
  })
})

describe('stav celého UID', () => {
  /**
   * `archivovano` je stav SEGMENTU, nikdy celého UID: když archivují
   * všichni, UID není archivované — čeká na další organizaci.
   */
  it('samé archivované segmenty znamenají spánek UID, ne archiv', () => {
    expect(uidLifecycle([archived, archived], NOW)).toBe('spanek')
  })

  it('bez jakéhokoli živého segmentu je UID ve spánku', () => {
    expect(uidLifecycle([], NOW)).toBe('spanek')
    expect(uidLifecycle([archived, ended], NOW)).toBe('spanek')
  })

  it('jedna aktivní Dohoda = aktivní', () => {
    expect(uidLifecycle([archived, active], NOW)).toBe('aktivni')
  })

  it('běžící převod přebíjí všechno ostatní', () => {
    expect(uidLifecycle([active, inHandover], NOW)).toBe('prevod')
  })

  /** Pěstoun mohl podepsat mimo náš systém — UID pak čeká klidně roky. */
  it('UID ve spánku zůstává ve spánku i po letech', () => {
    const later = new Date('2031-01-01T00:00:00.000Z')
    expect(uidLifecycle([archived], later)).toBe('spanek')
  })
})

describe('plán převzetí', () => {
  it('bez zavedení jako zájemce to nejde ani u spícího UID', () => {
    const plan = planTakeover([archived], false, NOW)
    expect(plan.allowed).toBe(false)
    expect(plan.blockedReason).toContain('zájemce')
  })

  it('spící UID se probouzí („obnovit") a nikoho nepoškodí', () => {
    const plan = planTakeover([archived], true, NOW)
    expect(plan.kind).toBe('obnovit')
    expect(plan.allowed).toBe(true)
  })

  it('aktivní UID se přebírá („převzít") a spustí 90denní lhůtu', () => {
    const plan = planTakeover([active], true, NOW)
    expect(plan.kind).toBe('prevzit')
    expect(plan.allowed).toBe(true)
    expect(plan.consequence).toContain('90')
  })

  /**
   * Dva souběžné převody by znamenaly tři organizace nad jedním spisem
   * a nikdo by nevěděl, komu vlastně patří. Radši druhý pokus zablokovat.
   */
  it('druhý souběžný převod je zakázaný', () => {
    const plan = planTakeover([inHandover], true, NOW)
    expect(plan.allowed).toBe(false)
    expect(plan.blockedReason).toContain('převod')
  })

  it('po vypršení předchozího převodu jde UID převzít znovu', () => {
    const plan = planTakeover([handoverExpired], true, NOW)
    expect(plan.allowed).toBe(true)
  })
})
