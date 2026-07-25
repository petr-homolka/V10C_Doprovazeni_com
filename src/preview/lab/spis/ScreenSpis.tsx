import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '@/contexts/auth-context'
import { previewAuth } from '../../previewAuth'
import { Sidebar } from '@/components/shell/Sidebar'
import { MobileTabBar } from '@/components/mobile/MobileShell'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Tabs } from '@/components/ui/tabs'
import { ViewMenu } from '@/components/ui/view-menu'
import {
  Calendar, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, Home, MoreVertical,
  Plus, Star, StickyNote, X,
} from '@/components/ui/icons'
import { staff } from '../../fixtures'
import { initials } from '../labData'
import {
  NOW, agreement, buildLimits, buildPeople, buildSpis, dayCount, family, nextVisitDue, shortDate,
  type SpisItem, type SpisLimit, type SpisPerson,
} from './spisData'

/**
 * PROFIL RODINY — NÁVRH ZE 2026-07-25, POSTAVENÝ ZNOVU OD STRUKTURY.
 *
 * Petr o předchozí verzi napsal: „stále mi ten profil nepřijde nějak moc
 * jiný než ten původní … ty tlačítka, ty jednotlivé řádky … zahoď to a
 * vymysli to jinak". Měl pravdu — předtím se změnily barvy a písmo, ale
 * kostra zůstala: avatar v hlavičce, řada záložek, pod nimi sekce s řádky
 * a v každém řádku tlačítko. Tady je zahozená ta kostra.
 *
 * ČTYŘI ROZHODNUTÍ, KTERÁ TENHLE NÁVRH DĚLAJÍ JINÝM
 *
 * 1. ŽÁDNÉ ZÁLOŽKY NA STRÁNCE. Rodina není šest oddělených obrazovek
 *    (Přehled / Osa / Kalendář / Úkoly / Dokumenty / Chat), mezi kterými se
 *    člověk proklikává, aby si dal dohromady, jak se rodině vede. Je to
 *    JEDNA DLOUHÁ STRÁNKA, kterou se dá projít shora dolů — tak to řeší
 *    Notion i Routine. Přepínání pohledu zůstalo, ale kleslo o úroveň:
 *    ne stránka, ale JEDNOTLIVÝ BLOK má svoje malé záložky (`size="sm"`,
 *    tentýž vizuální jazyk). Orientaci v délce nedrží záložky, ale OSNOVA
 *    vlevo, která ví, kde člověk právě je.
 *
 * 2. STRÁNKA MÁ POŘADÍ PODLE ČASU, NE PODLE ENTIT. Shora: co musím
 *    (lhůty a limity) → co se blíží (budoucnost) → co bylo (zápisy).
 *    Otázka, se kterou klíčová osoba profil otevírá, není „jaká je adresa",
 *    ale „jak dlouho tuhle rodinu nikdo neviděl a co z toho pro mě plyne".
 *    Proto je nahoře jediná věta, která na to odpovídá, a adresa spadla do
 *    vlastností, kde ji nikdo nehledá zbytečně.
 *
 * 3. ŘÁDEK NENÍ TLAČÍTKO A NENÍ KARTA. Žádné rámy, žádné pozadí, jedna
 *    vlasová linka a sloupce. Akce („Otevřít") se ukáže až na řádku, na
 *    který člověk najede. Kliknutí NEODNAVIGUJE — otevře NÁHLED vedle
 *    seznamu (Notion „side peek"), takže se dá projít deset zápisů za sebou
 *    a neztratit místo. Do celé stránky se jde jen když člověk chce.
 *
 * 4. ČÍSLA, KTERÁ SE POČÍTAJÍ. „Naposledy osobně" u každého člověka,
 *    hodiny vzdělávání z délky událostí, lhůta z Dohody a poslední
 *    návštěvy — všechno v `spisData.ts`, nic napsané do kresby. Právě tohle
 *    je věc, kterou tabulka v Excelu neumí, takže právě tohle má být vidět
 *    nejvýš.
 *
 * Lišta nahoře je zatím součástí návrhu, ne appky: v appce nese `TopBar`
 * jen šipky zpět/vpřed. Až tohle Petr schválí, dostane `TopBar` slot na
 * kontext stránky a akce, aby nebyly lišty dvě pod sebou.
 */

const KIND_ICON = {
  zapis: StickyNote,
  navsteva: Home,
  udalost: Calendar,
  ukol: CheckSquare,
  lhuta: Clock,
  dokument: FileText,
} as const

const SECTIONS = [
  { id: 'prehled', label: 'Přehled' },
  { id: 'lide', label: 'Lidé' },
  { id: 'lhuty', label: 'Lhůty a limity' },
  { id: 'blizi', label: 'Co se blíží' },
  { id: 'zapisy', label: 'Zápisy' },
] as const

/** První věta zápisu je jeho nadpis — psát k zápisu ještě zvlášť titulek
 * nikdo nebude, a „Poznámka" jako nadpis neříká nic. */
function headline(item: SpisItem): string {
  if (item.kind !== 'zapis' && item.kind !== 'navsteva') return item.title
  const body = (item.body ?? '').trim()
  if (!body) return item.title
  const end = body.search(/[.!?](\s|$)/)
  const first = end > 0 ? body.slice(0, end + 1) : body
  return first.length > 96 ? `${first.slice(0, 96).trimEnd()}…` : first
}

function rest(item: SpisItem): string {
  const body = (item.body ?? '').trim()
  const head = headline(item)
  return body.startsWith(head) ? body.slice(head.length).trim() : ''
}

function Avatar({ url, name, size = 20 }: { url?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size }
  return url ? (
    <img src={url} alt="" className="shrink-0 rounded-full object-cover" style={style} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-overlay-active text-2xs text-text-tertiary"
      style={style}
    >
      {initials(name)}
    </span>
  )
}

/** Nadpis bloku. Malý, tichý, s počtem — nadpis nemá soutěžit s obsahem. */
function BlockHead({
  id,
  title,
  count,
  children,
}: {
  id: string
  title: string
  count?: number
  children?: ReactNode
}) {
  return (
    <div className="sp__blockhead" id={id}>
      <h2 className="text-base font-medium text-text-primary">{title}</h2>
      {count !== undefined && <span className="text-sm text-text-faint">{count}</span>}
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </div>
  )
}

function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[30px] items-start gap-3 py-1">
      <span className="w-[148px] shrink-0 pt-0.5 text-sm text-text-tertiary">{label}</span>
      <span className="min-w-0 flex-1 text-sm text-text-primary">{children}</span>
    </div>
  )
}

function LimitRow({ limit }: { limit: SpisLimit }) {
  const pct = Math.min(100, Math.round((limit.done / limit.target) * 100))
  return (
    <div className="sp__row sp__row--lhuta">
      <div className="min-w-0">
        <p className="text-sm text-text-primary">{limit.label}</p>
        <div className="sp__meter mt-2 max-w-[420px]">
          {/* Barva pruhu podle TÓNU, ne podle délky: splněná lhůta je klidná
              šedá, i když je pruh plný. Bez toho vypadal hotový zápis
              („72 / 72 h") stejně nebezpečně jako propadlá návštěva. */}
          <span
            className={`sp__meterfill sp__meterfill--${limit.tone}`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-text-faint">{limit.source}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm ${limit.tone === 'po' ? 'text-accent' : 'text-text-primary'}`}>{limit.state}</p>
        <p className="text-xs text-text-faint">
          {limit.done} / {limit.target}
          {limit.id === 'vzdelavani' ? ' h' : limit.id === 'zapis' ? ' h' : ` ${dayCount(limit.target).split(' ')[1]}`}
        </p>
      </div>
    </div>
  )
}

function PeopleRow({ person, onOpen }: { person: SpisPerson; onOpen: () => void }) {
  const days = person.lastSeen ? Math.round((NOW.getTime() - person.lastSeen.getTime()) / 86_400_000) : null
  return (
    <button type="button" onClick={onOpen} className="sp__row sp__row--lide">
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar url={person.avatarUrl} name={person.name} />
        <span className="truncate text-sm text-text-primary">{person.name}</span>
      </span>
      <span className="sp__col--vek text-sm text-text-tertiary">{person.detail}</span>
      <span className="sp__col--kontakt truncate text-sm text-text-tertiary">{person.contact ?? '—'}</span>
      <span className="text-right text-sm">
        {days === null ? (
          <span className="text-accent">nikdy osobně</span>
        ) : (
          <>
            <span className="text-text-primary">{shortDate(person.lastSeen!)}</span>
            <span className="ml-1.5 text-text-faint">{dayCount(days)}</span>
          </>
        )}
      </span>
      <span className="sp__reveal sp__col--rev text-text-tertiary">
        <ChevronRight size={15} />
      </span>
    </button>
  )
}

function StreamRow({
  item,
  variant,
  onOpen,
}: {
  item: SpisItem
  variant: 'zapis' | 'blizi'
  onOpen: () => void
}) {
  const at = new Date(item.at)
  const Icon = KIND_ICON[item.kind]
  const author = staff.find((s) => s.displayName === item.who)
  const excerpt = rest(item)

  return (
    <button type="button" onClick={onOpen} className={`sp__row sp__row--${variant}`}>
      <span className="text-right">
        <span className={`block text-sm ${item.urgent ? 'text-accent' : 'text-text-primary'}`}>{shortDate(at)}</span>
        <span className="block text-2xs text-text-faint">
          {at.toLocaleDateString('cs-CZ', { weekday: 'short' })}
        </span>
      </span>

      <span className="flex min-w-0 items-start gap-2.5">
        <Icon size={15} className="mt-0.5 shrink-0 text-text-faint" />
        <span className="min-w-0">
          <span className="block truncate text-sm text-text-primary">{headline(item)}</span>
          {excerpt && <span className="block truncate text-xs text-text-tertiary">{excerpt}</span>}
        </span>
      </span>

      <span className="sp__col--subjects flex min-w-0 items-center gap-1">
        {(item.subjects ?? []).slice(0, 2).map((name) => (
          <span key={name} className="truncate rounded-sm bg-overlay-active px-1.5 py-0.5 text-xs text-text-secondary">
            {name}
          </span>
        ))}
        {(item.subjects?.length ?? 0) > 2 && (
          <span className="text-xs text-text-faint">+{(item.subjects?.length ?? 0) - 2}</span>
        )}
      </span>

      {variant === 'zapis' && (
        <span className="sp__col--author">{item.who && <Avatar url={author?.avatarUrl} name={item.who} size={18} />}</span>
      )}

      <span className="sp__reveal sp__col--rev text-text-tertiary">
        <ChevronRight size={15} />
      </span>
    </button>
  )
}

/** Náhled záznamu vedle seznamu. Není to formulář ani nová stránka — je to
 * to samé, co bylo na řádku, jen celé. */
function Peek({ item, onClose }: { item: SpisItem; onClose: () => void }) {
  const at = new Date(item.at)
  const author = staff.find((s) => s.displayName === item.who)
  return (
    <aside className="sp__peek">
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-border-subtle px-3">
        <button type="button" className="flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-text-secondary hover:bg-overlay-active">
          Otevřít jako stránku
          <ChevronRight size={14} />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label="Další" className="flex size-7 items-center justify-center rounded-md text-text-tertiary hover:bg-overlay-active">
            <MoreVertical size={15} />
          </button>
          <button type="button" aria-label="Zavřít" onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-text-tertiary hover:bg-overlay-active">
            <X size={15} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <p className="text-xs uppercase tracking-wide text-text-faint">{item.title}</p>
        <h3 className="mt-1.5 text-xl text-text-primary">{headline(item)}</h3>

        <div className="mt-4 border-t border-border-subtle pt-3">
          <PropertyRow label="Kdy">
            {at.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
            {', '}
            {at.toLocaleTimeString('cs-CZ', { hour: 'numeric', minute: '2-digit' })}
          </PropertyRow>
          <PropertyRow label="Zapsal">
            {item.who ? (
              <span className="flex items-center gap-2">
                <Avatar url={author?.avatarUrl} name={item.who} size={18} />
                {item.who}
              </span>
            ) : (
              '—'
            )}
          </PropertyRow>
          <PropertyRow label="Koho se týká">
            {item.subjects?.length ? (
              <span className="flex flex-wrap gap-1">
                {item.subjects.map((name) => (
                  <span key={name} className="rounded-sm bg-overlay-active px-1.5 py-0.5 text-xs text-text-secondary">
                    {name}
                  </span>
                ))}
              </span>
            ) : (
              'celá rodina'
            )}
          </PropertyRow>
          <PropertyRow label="Sdílení">
            {item.sharing === 'partner' ? 'Vidí i pěstouni' : 'Jen tým organizace'}
          </PropertyRow>
        </div>

        {/* Bez první věty — ta je nadpisem výše. Opsat ji ještě do těla
            znamená, že náhled začíná dvakrát tím samým. */}
        {rest(item) && (
          <p className="mt-5 whitespace-pre-wrap border-t border-border-subtle pt-4 text-base leading-[22px] text-text-secondary">
            {rest(item)}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-border-subtle p-3">
        <p className="text-sm text-text-faint">Přidat komentář…</p>
      </div>
    </aside>
  )
}

export function LabSpis() {
  const spis = useMemo(() => buildSpis(), [])
  const people = useMemo(() => buildPeople(), [])
  const limits = useMemo(() => buildLimits(), [])
  const due = nextVisitDue()

  const zapisy = spis.filter((i) => i.kind === 'zapis' || i.kind === 'navsteva')
  const blizi = spis.filter((i) => new Date(i.at) >= NOW || (i.kind === 'ukol' && !i.done)).slice(0, 5)

  const [openItem, setOpenItem] = useState<SpisItem | null>(null)
  const [allProps, setAllProps] = useState(false)
  const [zapisView, setZapisView] = useState('seznam')
  const [lideView, setLideView] = useState('seznam')
  const [grouping, setGrouping] = useState('mesic')
  const [stuck, setStuck] = useState(false)
  const mobile = useIsMobile()
  const [active, setActive] = useState<string>('prehled')
  const scroller = useRef<HTMLDivElement>(null)

  /* Lišta a osnova reagují na ROLOVÁNÍ, ne na kliknutí — člověk nemá říkat
     rozhraní, kde je; rozhraní to má vědět. */
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    function onScroll() {
      const top = el!.scrollTop
      setStuck(top > 140)
      const line = top + 120
      let current = SECTIONS[0].id as string
      for (const { id } of SECTIONS) {
        const node = document.getElementById(id)
        if (node && node.offsetTop <= line) current = id
      }
      setActive(current)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  /* `?scroll=` posune stránku hned po načtení a `?peek=` otevře náhled
     N-tého zápisu — jinak by se stavy za rolováním a za kliknutím nedaly
     vyfotit. (`AutoInteract` z `main.tsx` na návrhové obrazovky nedosáhne,
     protože si router obalují samy.) */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const scroll = Number(params.get('scroll') ?? 0)
    if (scroll > 0) scroller.current?.scrollTo({ top: scroll })
    const peek = params.get('peek')
    if (peek !== null) setOpenItem(zapisy[Number(peek) || 0] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Seskupení zápisů po měsících. Skupina se nekreslí jako rám, jen jako
     tichý popisek — dělí to čas, ne obsah. */
  const groups = useMemo(() => {
    if (grouping === 'nic') return [{ label: '', items: zapisy }]
    const map = new Map<string, SpisItem[]>()
    for (const item of zapisy) {
      const key = new Date(item.at).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
    return [...map].map(([label, items]) => ({ label, items }))
  }, [grouping, zapisy])

  const keyWorker = staff.find((s) => s.uid === agreement?.assignedTo)

  /* Kdo z rodiny je nejdéle bez osobního kontaktu. Kdyby to na obrazovce
     nebylo, musel by si to člověk odvodit z pěti řádků — a přesně proto se
     na to zapomíná. */
  const longestUnseen = people.reduce<SpisPerson | null>((worst, person) => {
    if (!person.lastSeen) return person
    if (!worst) return person
    if (!worst.lastSeen) return worst
    return person.lastSeen < worst.lastSeen ? person : worst
  }, null)

  return (
    <AuthContext.Provider value={previewAuth}>
      <MemoryRouter initialEntries={['/rodiny/9900010000015']}>
        {/* Na telefonu není postranní panel čím zúžit — 240 px z 390 je
            polovina obrazovky. Mizí a navigaci přebírá spodní lišta, přesně
            jako ve zbytku appky. Stránka samotná se NEMĚNÍ: osnova zmizí
            (CSS), sloupce se uberou podle šířky plátna (`@container`) a
            náhled záznamu se otevře jako spodní plachta. */}
        <div className={`sp flex bg-app ${mobile ? 'h-[100dvh] flex-col' : 'h-screen'}`}>
          {!mobile && <Sidebar />}

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* JEDNA lišta: šipky, kde jsem, a jedna akce. */}
            <div className={`sp__bar${stuck ? ' sp__bar--stuck' : ''}`}>
              <button type="button" aria-label="Zpět" className="flex size-7 items-center justify-center rounded-md text-text-tertiary hover:bg-overlay-active">
                <ChevronLeft size={17} />
              </button>
              <button type="button" aria-label="Vpřed" disabled className="flex size-7 items-center justify-center rounded-md text-text-faint">
                <ChevronRight size={17} />
              </button>

              {/* Na telefonu drobečky KONČÍ u „Rodiny" — jméno rodiny je
                  hned pod lištou jako nadpis a na 390 px se o šířku nemá
                  s čím hádat. */}
              <nav className="ml-1 flex min-w-0 items-center gap-1.5 text-sm">
                <span className="shrink-0 text-text-tertiary">Rodiny</span>
                {!mobile && (
                  <>
                    <span className="text-text-faint">/</span>
                    <span className="truncate text-text-primary">{family.displayName}</span>
                  </>
                )}
              </nav>

              {/* Kontext, který v liště PŘIROSTE, až nadpis odjede — dokud je
                  vidět nahoře, lišta ho neopakuje. Na telefonu přiroste
                  JMÉNO (to člověku odjelo), na desktopu LHŮTA (jméno tam
                  zůstalo v drobečkách). */}
              <span className="sp__grown min-w-0">
                {mobile ? (
                  <span className="truncate text-sm text-text-primary">{family.displayName}</span>
                ) : (
                  <>
                    <span className="text-border-default">·</span>
                    <span className={`truncate text-sm ${due.overdue || due.daysLeft <= 14 ? 'text-accent' : 'text-text-tertiary'}`}>
                      návštěva {due.overdue ? `po termínu o ${dayCount(due.daysLeft)}` : `za ${dayCount(due.daysLeft)}`}
                    </span>
                  </>
                )}
              </span>

              <div className="ml-auto flex shrink-0 items-center gap-1">
                {!mobile && (
                  <button type="button" aria-label="Do oblíbených" className="flex size-7 items-center justify-center rounded-md text-text-tertiary hover:bg-overlay-active">
                    <Star size={15} />
                  </button>
                )}
                <button type="button" aria-label="Další" className="flex size-7 items-center justify-center rounded-md text-text-tertiary hover:bg-overlay-active">
                  <MoreVertical size={15} />
                </button>
                <button
                  type="button"
                  className="ml-1 flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-sm text-primary-foreground transition-colors duration-150 hover:bg-primary-hover"
                >
                  Zapsat
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>

            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
              <div className="sp__wrap">
                {/* OSNOVA — místo záložek. Ví, kde člověk je. */}
                <nav className="sp__rail">
                  {SECTIONS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className={`sp__raillink${active === id ? ' sp__raillink--active' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </nav>

                <div className="sp__canvas min-w-0">
                  {/* ---------- PŘEHLED ---------- */}
                  <div id="prehled" style={{ scrollMarginTop: 76 }}>
                    <div className="flex items-center gap-3">
                      <Avatar url={family.avatarUrl} name={family.displayName ?? 'Rodina'} size={28} />
                      <h1 className="min-w-0 truncate text-3xl text-text-primary">{family.displayName}</h1>
                    </div>
                    <p className="mt-1.5 text-sm text-text-tertiary">
                      Spis {family.uid} · {family.address}
                    </p>

                    {/* JEDNA VĚTA, kvůli které se profil otevírá. Ne karta,
                        ne rám — svislá linka a text. */}
                    <div className="mt-6 border-l-2 border-accent pl-4">
                      <p className="text-base text-text-primary">
                        {due.overdue
                          ? `Osobní návštěva je po termínu o ${dayCount(due.daysLeft)}.`
                          : `Do termínu osobní návštěvy zbývá ${dayCount(due.daysLeft)}.`}
                      </p>
                      <p className="mt-1 text-sm text-text-tertiary">
                        Naposledy jste v rodině byli {shortDate(agreement.lastVisitAt!)}, Dohoda říká každých{' '}
                        {dayCount(agreement.visitIntervalDays)}.
                        {/* Věta se skládá z DAT, ne z textu v kresbě — jinak
                            by na obrazovce po první změně dat stálo něco,
                            co není pravda (a to se mi tady jednou stalo). */}
                        {longestUnseen && (
                          <>
                            {' '}
                            Nejdéle bez osobního kontaktu: {longestUnseen.name}
                            {' — '}
                            {longestUnseen.lastSeen
                              ? dayCount(Math.round((NOW.getTime() - longestUnseen.lastSeen.getTime()) / 86_400_000))
                              : 'nikdy'}
                            .
                          </>
                        )}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-7 items-center rounded-md bg-primary px-2.5 text-sm text-primary-foreground hover:bg-primary-hover"
                        >
                          Zapsat návštěvu
                        </button>
                        <button
                          type="button"
                          className="flex h-7 items-center rounded-md px-2 text-sm text-text-secondary hover:bg-overlay-active"
                        >
                          Naplánovat na 26. 7.
                        </button>
                      </div>
                    </div>

                    {/* Vlastnosti: pět vidět, ostatní na požádání. Adresa a
                        spisovka jsou důležité JEDNOU za rok — nemají trvale
                        zabírat nejlepší místo na stránce. */}
                    <div className="mt-7 border-t border-border-subtle pt-3">
                      <PropertyRow label="Klíčová osoba">
                        <span className="flex items-center gap-2">
                          <Avatar url={keyWorker?.avatarUrl} name={keyWorker?.displayName ?? '—'} size={18} />
                          {keyWorker?.displayName}
                        </span>
                      </PropertyRow>
                      <PropertyRow label="Dohoda">
                        Aktivní od {shortDate(agreement.validFrom)}
                      </PropertyRow>
                      <PropertyRow label="Typ péče">Zprostředkovaná</PropertyRow>
                      <PropertyRow label="Interval návštěv">{dayCount(agreement.visitIntervalDays)}</PropertyRow>
                      <PropertyRow label="Sdílení zápisů">Oběma pěstounům</PropertyRow>

                      {allProps && (
                        <>
                          <PropertyRow label="Adresa">{family.address}</PropertyRow>
                          <PropertyRow label="OSPOD">Brno-střed · Mgr. Lenka Šimková</PropertyRow>
                          <PropertyRow label="Soud">Městský soud Brno, sp. zn. 24 P 118/2023</PropertyRow>
                          <PropertyRow label="Biologická rodina">Matka v kontaktu, otec neznámý</PropertyRow>
                          <PropertyRow label="Vzdělávání">24 h / 12 měsíců</PropertyRow>
                          <PropertyRow label="Spis vznikl">{shortDate(family.createdAt)}</PropertyRow>
                          <PropertyRow label="Naposledy upraveno">{shortDate(spis[0]?.at ?? NOW)}</PropertyRow>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setAllProps((v) => !v)}
                        className="mt-1 flex h-7 items-center gap-1.5 text-sm text-text-faint hover:text-text-secondary"
                      >
                        <ChevronDown size={14} className={allProps ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        {allProps ? 'Skrýt vlastnosti' : 'Zobrazit dalších 7 vlastností'}
                      </button>
                    </div>
                  </div>

                  {/* ---------- LIDÉ ---------- */}
                  <section className="sp__block">
                    <BlockHead id="lide" title="Lidé" count={people.length}>
                      <Tabs
                        size="sm"
                        underline={false}
                        active={lideView}
                        onSelect={setLideView}
                        items={[
                          { key: 'seznam', label: 'Seznam' },
                          { key: 'karty', label: 'Karty' },
                        ]}
                      />
                    </BlockHead>

                    <div className="sp__labels sp__row sp__row--lide mt-2">
                      <span>Jméno</span>
                      <span className="sp__col--vek">Věk</span>
                      <span className="sp__col--kontakt">Kontakt</span>
                      <span className="text-right">Naposledy osobně</span>
                      <span />
                    </div>

                    {['Pěstouni', 'Děti v péči'].map((group) => {
                      const rows = people.filter((p) =>
                        group === 'Pěstouni' ? p.role !== 'Dítě v péči' : p.role === 'Dítě v péči',
                      )
                      return (
                        <div key={group}>
                          <p className="pt-4 pb-1 text-xs text-text-faint">
                            {group} <span className="ml-1">{rows.length}</span>
                          </p>
                          {rows.map((person) => (
                            <PeopleRow key={person.id} person={person} onOpen={() => setOpenItem(spis[0] ?? null)} />
                          ))}
                        </div>
                      )
                    })}

                    <button type="button" className="sp__add">
                      <Plus size={14} />
                      Přidat člověka do spisu
                    </button>
                  </section>

                  {/* ---------- LHŮTY A LIMITY ---------- */}
                  <section className="sp__block">
                    <BlockHead id="lhuty" title="Lhůty a limity">
                      <span className="text-xs text-text-faint">počítá se z Dohody a ze zápisů</span>
                    </BlockHead>
                    <div className="mt-2 border-t border-border-subtle">
                      {limits.map((limit) => (
                        <LimitRow key={limit.id} limit={limit} />
                      ))}
                    </div>
                  </section>

                  {/* ---------- CO SE BLÍŽÍ ---------- */}
                  <section className="sp__block">
                    <BlockHead id="blizi" title="Co se blíží" count={blizi.length}>
                      <button type="button" className="text-sm text-text-tertiary hover:text-text-primary">
                        Otevřít v kalendáři
                      </button>
                    </BlockHead>
                    <div className="mt-2 border-t border-border-subtle">
                      {blizi.map((item) => (
                        <StreamRow key={item.id} item={item} variant="blizi" onOpen={() => setOpenItem(item)} />
                      ))}
                    </div>
                    <button type="button" className="sp__add">
                      <Plus size={14} />
                      Naplánovat událost nebo úkol
                    </button>
                  </section>

                  {/* ---------- ZÁPISY ---------- */}
                  <section className="sp__block">
                    <BlockHead id="zapisy" title="Zápisy" count={zapisy.length}>
                      <Tabs
                        size="sm"
                        underline={false}
                        active={zapisView}
                        onSelect={setZapisView}
                        items={[
                          { key: 'seznam', label: 'Seznam' },
                          { key: 'osa', label: 'Osa' },
                          { key: 'kalendar', label: 'Kalendář' },
                        ]}
                      />
                      <ViewMenu
                        groups={[
                          {
                            label: 'Seskupit',
                            value: grouping,
                            onChange: setGrouping,
                            options: [
                              { value: 'mesic', label: 'Měsíc' },
                              { value: 'nic', label: 'Bez seskupení' },
                            ],
                          },
                        ]}
                      />
                    </BlockHead>

                    {/* Psaní zápisu je na stránce rodiny ta nejčastější práce
                        — patří proto NAD seznam a ne za tlačítko. */}
                    <button
                      type="button"
                      className="mt-3 flex h-9 w-full items-center gap-2 rounded-md border border-border-default px-2.5 text-left text-sm text-text-faint transition-colors duration-150 hover:border-border-strong"
                    >
                      <Plus size={15} className="shrink-0" />
                      <span className="flex-1">Napsat zápis…</span>
                      <span className="shrink-0 text-xs">⌘⏎ uloží · / vloží blok</span>
                    </button>

                    <div className="sp__labels sp__row sp__row--zapis mt-3">
                      <span className="text-right">Kdy</span>
                      <span>Zápis</span>
                      <span className="sp__col--subjects">Koho se týká</span>
                      <span className="sp__col--author">Kdo</span>
                      <span />
                    </div>

                    {groups.map(({ label, items }) => (
                      <div key={label || 'vse'}>
                        {label && (
                          <p className="pt-4 pb-1 text-xs text-text-faint">
                            {label} <span className="ml-1">{items.length}</span>
                          </p>
                        )}
                        {items.map((item) => (
                          <StreamRow key={item.id} item={item} variant="zapis" onOpen={() => setOpenItem(item)} />
                        ))}
                      </div>
                    ))}

                    <div className="mt-1 flex items-center gap-4">
                      <button type="button" className="sp__add" style={{ width: 'auto' }}>
                        <Plus size={14} />
                        Nový zápis
                      </button>
                      <button type="button" className="text-sm text-text-faint hover:text-text-secondary">
                        Zobrazit starší
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </main>

          {mobile && <MobileTabBar />}
          {openItem && <Peek item={openItem} onClose={() => setOpenItem(null)} />}
        </div>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}
