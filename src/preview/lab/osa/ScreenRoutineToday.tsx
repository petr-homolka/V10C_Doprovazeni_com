import { useEffect, useRef } from 'react'
import { OsaShell } from './OsaShell'
import { labRows, initials } from '../labData'
import { calendarEvents, families, fosterPersons, children as childFix } from '../../fixtures'

const HOUR_PX = 44
const DAY_START = 7
const DAY_END = 20

/** „Teď" je ve vzorových datech pevné — screenshoty musí být opakovatelné. */
const NOW_H = 11
const NOW_M = 20

function y(hour: number, minute = 0): number {
  return (hour + minute / 60 - DAY_START) * HOUR_PX
}

/** Jméno + fotka subjektu pro čipy a avatary. */
const SUBJECTS = new Map<string, { label: string; avatarUrl?: string | null }>([
  ...families.map(
    ({ docId, family }) =>
      [`family:${docId}`, { label: family.displayName ?? 'Rodina', avatarUrl: family.avatarUrl }] as const,
  ),
  ...fosterPersons.map(
    ({ docId, fosterPerson: f }) =>
      [`fosterPerson:${docId}`, { label: `${f.firstName} ${f.lastName}`, avatarUrl: f.avatarUrl }] as const,
  ),
  ...childFix.map(
    ({ docId, child: c }) =>
      [`child:${docId}`, { label: `${c.firstName} ${c.lastName}`, avatarUrl: c.avatarUrl }] as const,
  ),
])

/** Úkoly naplánované do dne (v Routine se úkol přetáhne do kalendáře).
 * Čárkovaný blok = můj plán, plný = dohodnutá schůzka. */
const PLANNED = [
  { at: [8, 30], mins: 45, title: 'Zpráva pro OSPOD za 2. kvartál', tag: 'family:f1' },
  { at: [13, 0], mins: 30, title: 'Zavolat Sedláčkovým — domluvit návštěvu', tag: 'family:f12' },
  { at: [16, 0], mins: 60, title: 'Zapsat dnešní návštěvu', tag: 'family:f1' },
] as const

interface LabTask {
  title: string
  due: string
  tag: string
  est: string
  /** Čas, na který je úkol vpravo do dne naplánovaný — spojka mezi panely. */
  plannedAt?: string
  done?: boolean
}

const TASKS: Array<{ group: string; hot?: boolean; items: LabTask[] }> = [
  {
    group: 'Po termínu',
    hot: true,
    items: [
      { title: 'Zpráva pro OSPOD za 2. kvartál', due: '+3 dní', tag: 'family:f1', est: '45 min', plannedAt: '8:30' },
      { title: 'Návštěva u Svobodových', due: '+35 dní', tag: 'family:f2', est: '2 h' },
    ],
  },
  {
    group: 'Dnes',
    items: [
      { title: 'Zavolat Sedláčkovým — domluvit návštěvu', due: 'dnes', tag: 'family:f12', est: '15 min', plannedAt: '13:00' },
      { title: 'Zapsat dnešní návštěvu', due: 'dnes', tag: 'family:f1', est: '30 min', plannedAt: '16:00' },
      { title: 'Poslat Janě odkaz na kurz', due: 'dnes', tag: 'fosterPerson:fp1', est: '5 min' },
    ],
  },
  {
    group: 'Tento týden',
    items: [
      { title: 'Zajistit doučování matematiky', due: '30. 7.', tag: 'child:c1', est: '20 min' },
      { title: 'Objednat respitní pobyt na prázdniny', due: '31. 7.', tag: 'family:f4', est: '30 min' },
      { title: 'Zkontrolovat platnost lékařské zprávy', due: '—', tag: 'child:c2', est: '10 min' },
    ],
  },
  {
    group: 'Hotovo dnes',
    items: [{ title: 'Podepsat aktualizaci Dohody', due: '', tag: 'family:f1', est: '', done: true }],
  },
]

/**
 * „DNES" ve variantě co nejblíž Routine — to, na co uživatel ukázal:
 * rozdělení na ÚKOLY (vlevo) a AGENDU DNEŠNÍHO DNE (vpravo) s vyznačeným
 * časem.
 *
 * Proč to takhle: seznam úkolů říká CO, časová mřížka říká, KDY se to do dne
 * vejde — a vedle sebe ukážou to, co ani jeden sám neumí, totiž že se to
 * nevejde. Klíčová osoba s osmi hodinami a šesti úkoly po termínu potřebuje
 * přesně tuhle konfrontaci.
 *
 * Naše odchylka od Routine: čipy u úkolů nesou TVÁŘ, protože u nás nejsou
 * projekty a tagy, ale lidé. A celodenní pás nese lhůty, které čas nemají,
 * ale den ano.
 */
export function RoutineToday() {
  const dayRef = useRef<HTMLDivElement>(null)

  /**
   * Na telefonu má mřížka dne VLASTNÍ scroll a startuje u „teď".
   *
   * Bez toho byla celá třináctihodinová mřížka (676 px) nad seznamem úkolů,
   * takže se k úkolům nedalo dostat bez dlouhého scrollu — a nahoře přitom
   * bylo prázdné ráno, které už dávno není aktuální. Na desktopu se nic
   * neděje, tam jsou panely vedle sebe a místo je.
   */
  useEffect(() => {
    const el = dayRef.current
    if (!el || el.scrollHeight <= el.clientHeight) return
    el.scrollTop = Math.max(0, y(NOW_H) - HOUR_PX)
  }, [])

  const overdue = labRows.filter((r) => r.urgency === 'overdue')
  const todayEvents = calendarEvents
    .filter(({ event }) => new Date(event.start).getDate() === 24)
    .sort((a, b) => a.event.start.localeCompare(b.event.start))

  return (
    <OsaShell
      active="Dnes"
      crumb={
        <>
          <b>Dnes</b> · pátek 24. července 2026
        </>
      }
      actions={
        <>
          <button type="button" className="osa__btn">
            Nadiktovat zápis
          </button>
          <button type="button" className="osa__btn osa__btn--primary">
            Nový úkol
          </button>
        </>
      }
    >
      {/* `rt--bleed` ruší odsazení `osa__body` — dvoupanel má sahat k hranám.
          Hodnoty jsou v CSS, protože se na mobilu mění. */}
      <div className="rt rt--bleed">
        <div className="rt__split">
          {/* ---------------- Vlevo: úkoly ---------------- */}
          <section className="rt__pane">
            <header className="rt__panehead">
              <span className="rt__panetitle">Úkoly</span>
              <span className="rt__panemeta">9 otevřených · {overdue.length} po termínu</span>
              <span className="rt__panetools">
                <span className="rt__icon">⌄</span>
                <span className="rt__icon">⋯</span>
              </span>
            </header>

            <div className="rt__panebody">
              <div className="rt__capture rt__capture--focus">
                <span style={{ color: 'var(--ink-3)' }}>+</span>
                <span>Napsat úkol…</span>
                <span className="rt__enter">⏎</span>
              </div>

              {TASKS.map(({ group, items, hot }) => (
                <div key={group}>
                  <h3 className="rt__group">
                    {group}
                    <span className={hot ? 'rt__groupcount' : undefined} style={hot ? undefined : { color: 'var(--ink-4)' }}>
                      {items.length}
                    </span>
                  </h3>
                  {items.map((task) => {
                    const subject = SUBJECTS.get(task.tag)
                    const done = task.done === true
                    return (
                      <div key={task.title} className="rt__task">
                        <span className={`rt__check${done ? ' rt__check--done' : ''}`} />
                        <span className="rt__taskbody">
                          <span
                            className="rt__tasktitle"
                            style={
                              done
                                ? { textDecoration: 'line-through', color: 'var(--ink-3)' }
                                : undefined
                            }
                          >
                            {task.title}
                          </span>
                          <span className="rt__taskmeta">
                            {subject && (
                              <span className="rt__tag">
                                {subject.avatarUrl ? (
                                  <img src={subject.avatarUrl} alt="" />
                                ) : (
                                  <span className="rt__tagface">{initials(subject.label)}</span>
                                )}
                                {subject.label}
                              </span>
                            )}
                            {task.due && (
                              <span className={`rt__due${task.due.startsWith('+') ? ' rt__due--hot' : ''}`}>
                                {task.due}
                              </span>
                            )}
                            {task.plannedAt && (
                              // Bez exotického glyfu: „⧗" Inter neumí a vykreslil
                              // se jako prázdný rámeček (odhaleno na screenshotu).
                              <span className="rt__due" title="Naplánováno do dnešního dne">
                                v plánu {task.plannedAt}
                              </span>
                            )}
                            {task.est && <span className="rt__est">{task.est}</span>}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </section>

          {/* ---------------- Vpravo: den ---------------- */}
          <section className="rt__pane">
            <header className="rt__panehead">
              <span className="rt__panetitle">Pátek 24. července</span>
              <span className="rt__panemeta">
                {todayEvents.length} události · {PLANNED.length} bloky
              </span>
              <span className="rt__panetools">
                <span className="rt__icon">‹</span>
                <span className="rt__icon">›</span>
                <button type="button" className="rt__btn">
                  Dnes
                </button>
              </span>
            </header>

            <div className="rt__allday">
              <span className="rt__alldaylabel">Lhůty</span>
              <span className="rt__alldayitems">
                {overdue.slice(0, 3).map((row) => (
                  <span key={row.id} className="rt__pill rt__pill--hot">
                    {row.name.replace(/^Rodina\s+/, '')} +{row.daysOverdue} dní
                  </span>
                ))}
                <span className="rt__pill rt__pill--warm">Novotní — návštěva za 2 dny</span>
                <span className="rt__pill">Kristýna V. má svátek</span>
              </span>
            </div>

            <div ref={dayRef} className="rt__panebody rt__panebody--day">
              <div className="rt__day">
                <div className="rt__hours">
                  {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                    // První popisek Routine skrývá — posazený nad linkou by
                    // vylezl nad mřížku.
                    <div key={i} className="rt__hourlabel" style={i === 0 ? { visibility: 'hidden' } : undefined}>
                      {DAY_START + i}:00
                    </div>
                  ))}
                </div>

                <div className="rt__track">
                  {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                    <div key={i} className="rt__hourline" />
                  ))}
                  {/* Naplánované úkoly — čárkovaně, „jen můj plán". */}
                  {PLANNED.map((block) => {
                    const subject = SUBJECTS.get(block.tag)
                    const height = (block.mins / 60) * HOUR_PX - 4
                    const short = height < 44
                    const time = `${String(block.at[0]).padStart(2, '0')}:${String(block.at[1]).padStart(2, '0')}`
                    return (
                      <div
                        key={block.title}
                        className={`rt__ev rt__ev--plan${short ? ' rt__ev--short' : ''}`}
                        style={{ top: y(block.at[0], block.at[1]) + 2, height }}
                      >
                        <span className="rt__evstripe" />
                        <div className="rt__evtime">{short ? time : `${time} · ${block.mins} min`}</div>
                        <div className="rt__evtitle">{block.title}</div>
                        {!short && subject && <div className="rt__evsub">{subject.label}</div>}
                      </div>
                    )
                  })}

                  {/* Skutečné události — plná linka, „dohodnuto s někým". */}
                  {todayEvents.map(({ docId, event }) => {
                    const start = new Date(event.start)
                    const end = new Date(event.end)
                    const height = Math.max(30, ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_PX - 4)
                    const short = height < 44
                    const subjects = (event.subjectKeys ?? [])
                      .map((key) => SUBJECTS.get(key))
                      .filter((s): s is { label: string; avatarUrl?: string | null } => !!s)
                    const hot = event.kind === 'navsteva-rodiny'
                    return (
                      <div
                        key={docId}
                        className={`rt__ev${hot ? ' rt__ev--hot' : ''}${short ? ' rt__ev--short' : ''}`}
                        style={{ top: y(start.getHours(), start.getMinutes()) + 2, height }}
                      >
                        <span className="rt__evstripe" />
                        <div className="rt__evtime">
                          {start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                          {!short && `–${end.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                        <div className="rt__evtitle">{event.title}</div>
                        {!short && subjects.length > 0 && (
                          <div className="rt__evfaces">
                            {subjects.slice(0, 4).map((s, i) =>
                              s.avatarUrl ? (
                                <img key={i} src={s.avatarUrl} alt="" title={s.label} />
                              ) : (
                                <span key={i} title={s.label}>
                                  {initials(s.label)}
                                </span>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* TEĎ */}
                  <div className="rt__now" style={{ top: y(NOW_H, NOW_M) }}>
                    <span className="rt__nowtime">
                      {NOW_H}:{String(NOW_M).padStart(2, '0')}
                    </span>
                    <span className="rt__nowdot" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </OsaShell>
  )
}
