import { createElement, type ReactElement, type SVGProps } from 'react'
import {
  Add01Icon, MinusSignIcon, Cancel01Icon, Tick02Icon, Search01Icon, Settings01Icon,
  PencilEdit01Icon, Delete02Icon, Copy01Icon, SentIcon, Notification01Icon, Mail01Icon,
  TelephoneIcon, Location01Icon, Logout01Icon, MoreVerticalIcon, Sun01Icon, Moon01Icon,
  StarIcon, SparklesIcon, Shield01Icon, RemoveSquareIcon, Baby01Icon, UserIcon,
  UserMultiple02Icon, UserGroup02Icon, UserSquareIcon, UserSettings01Icon, UserAdd01Icon,
  Home01Icon, Mic01Icon, ArrowRight01Icon, ArrowLeft01Icon, ArrowDown01Icon,
  ArrowRight02Icon, ArrowLeft02Icon, Calendar03Icon, CalendarAdd01Icon, CalendarCheckIcon,
  Calendar02Icon, Calendar04Icon, GridIcon, Clock01Icon, RepeatIcon, Loading03Icon, File01Icon, Xls01Icon,
  StickyNote01Icon, NoteEditIcon, InvoiceIcon, TaskDone01Icon, CheckListIcon,
  LeftToRightListBulletIcon, LeftToRightListNumberIcon, CheckmarkSquare01Icon, SquareIcon,
  CheckmarkCircle02Icon, Alert02Icon, Message01Icon, HandshakeIcon, Mortarboard01Icon,
  CakeIcon, PartyIcon, SidebarRight01Icon, Link01Icon, TextBoldIcon,
  TextItalicIcon, HeadingIcon, QuoteDownIcon, SourceCodeIcon, TableIcon, Image01Icon,
  Attachment01Icon, TextIcon, ArrowTurnBackwardIcon, ArrowTurnForwardIcon,
} from '@hugeicons/core-free-icons'

/**
 * IKONY — HugeIcons ve variantě stroke-rounded.
 *
 * Proč právě tahle sada: v CSS Routine je `font-family:hugeicons-stroke-rounded`.
 * Ikony tedy nepřekreslujeme podle screenshotu, bereme TU SAMOU VEŘEJNOU SADU
 * (balíček `@hugeicons/core-free-icons`, licence MIT) — jen ji kreslíme jako
 * SVG místo ikonového fontu, aby se do bundlu dostaly jen ty, které
 * používáme, místo 400 kB fontu.
 *
 * Proč tenhle soubor a ne přímé volání: appka měla ikony z `lucide-react` na
 * 65 místech, každé s vlastní velikostí a tahem. Tady se jménem `lucide`
 * mapují na HugeIcons, takže:
 *   1. výměna byla změna importu, ne 65 ručních úprav,
 *   2. velikost a TAH rozhoduje JEDNO místo — tah 1.5 při 24px výřezu je to,
 *      co dělá ten tenký, vzdušný dojem; kdyby si to každé volání nastavovalo
 *      samo, rozjede se to do týdne,
 *   3. když někdo použije ikonu, kterou tu nemáme, spadne to při překladu, ne
 *      až v prohlížeči.
 *
 * Rozhraní je záměrně kompatibilní s `lucide-react` (`className`, `size`,
 * `strokeWidth`), takže volající kód zůstal beze změny.
 */

/** Tvar dat z HugeIcons: pole `[tag, props]`. */
type IconNode = ReadonlyArray<readonly [string, Record<string, unknown>]>

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number | string
  strokeWidth?: number
}

/**
 * Typ komponenty ikony pro props typu `icon={Baby}`. Dřív se sem importoval
 * `LucideIcon` — ten už neexistuje, protože ikony nejsou z lucide.
 */
export type IconComponent = (props: IconProps) => ReactElement

/**
 * Tah a zakončení patří na `<svg>`, ne na každou cestu. HugeIcons je má na
 * cestách, takže je odsud odstraňujeme — jinak by se `strokeWidth` z props
 * nedal přebít a všechny ikony by měly natvrdo 1.5.
 */
function stripStroke(props: Record<string, unknown>): Record<string, unknown> {
  const { stroke, strokeWidth, strokeLinecap, strokeLinejoin, ...rest } = props
  void stroke
  void strokeWidth
  void strokeLinecap
  void strokeLinejoin
  return rest
}

function icon(node: IconNode, displayName: string) {
  function Icon({ size = 16, strokeWidth = 1.5, ...rest }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {node.map(([tag, props], i) => createElement(tag, { ...stripStroke(props), key: i }))}
      </svg>
    )
  }
  Icon.displayName = displayName
  return Icon
}

/* Jména vlevo jsou z `lucide-react`, aby se volající kód nemusel měnit.
   Vpravo je HugeIcons ekvivalent — kde sada nemá 1:1 protějšek, je
   u řádku napsané, čím se to nahradilo a proč. */

export const Plus = icon(Add01Icon, 'Plus')
export const Minus = icon(MinusSignIcon, 'Minus')
export const X = icon(Cancel01Icon, 'X')
export const Check = icon(Tick02Icon, 'Check')
export const Search = icon(Search01Icon, 'Search')
export const Settings = icon(Settings01Icon, 'Settings')
export const Pencil = icon(PencilEdit01Icon, 'Pencil')
export const Trash2 = icon(Delete02Icon, 'Trash2')
export const Copy = icon(Copy01Icon, 'Copy')
export const Send = icon(SentIcon, 'Send')
export const Bell = icon(Notification01Icon, 'Bell')
export const Mail = icon(Mail01Icon, 'Mail')
export const Phone = icon(TelephoneIcon, 'Phone')
export const MapPin = icon(Location01Icon, 'MapPin')
export const LogOut = icon(Logout01Icon, 'LogOut')
export const MoreVertical = icon(MoreVerticalIcon, 'MoreVertical')
export const Sun = icon(Sun01Icon, 'Sun')
export const Moon = icon(Moon01Icon, 'Moon')
export const Star = icon(StarIcon, 'Star')
export const Sparkles = icon(SparklesIcon, 'Sparkles')
export const ShieldCheck = icon(Shield01Icon, 'ShieldCheck')
/** „Zakázáno" — HugeIcons nemá kolečko s lomítkem, čtverec s minusem ano. */
export const Ban = icon(RemoveSquareIcon, 'Ban')

export const Baby = icon(Baby01Icon, 'Baby')
export const User = icon(UserIcon, 'User')
export const UserRound = icon(UserIcon, 'UserRound')
export const Users = icon(UserMultiple02Icon, 'Users')
export const UsersRound = icon(UserGroup02Icon, 'UsersRound')
export const UserSquare2 = icon(UserSquareIcon, 'UserSquare2')
export const UserCog = icon(UserSettings01Icon, 'UserCog')
export const UserPlus = icon(UserAdd01Icon, 'UserPlus')
export const Home = icon(Home01Icon, 'Home')
export const Mic = icon(Mic01Icon, 'Mic')

/* Šipky: „chevron" je v HugeIcons `ArrowRight01` (jen hrot), plná šipka
   s dříkem je `ArrowRight02`. Ten rozdíl je důležitý — hrot znamená
   „rozbalit / jít dovnitř", šipka s dříkem „přejít jinam". */
export const ChevronRight = icon(ArrowRight01Icon, 'ChevronRight')
export const ChevronLeft = icon(ArrowLeft01Icon, 'ChevronLeft')
export const ChevronDown = icon(ArrowDown01Icon, 'ChevronDown')
export const ArrowRight = icon(ArrowRight02Icon, 'ArrowRight')
export const ArrowLeft = icon(ArrowLeft02Icon, 'ArrowLeft')

export const Calendar = icon(Calendar03Icon, 'Calendar')
export const CalendarDays = icon(Calendar03Icon, 'CalendarDays')
export const CalendarPlus = icon(CalendarAdd01Icon, 'CalendarPlus')
export const CalendarCheck = icon(CalendarCheckIcon, 'CalendarCheck')
export const CalendarClock = icon(Calendar02Icon, 'CalendarClock')
/* Přepínač pohledu kalendáře potřebuje TŘI ODLIŠNÉ ikony — dvě stejné
   u „Měsíc" a „Týden" ikonu k ničemu nedělají. Měsíc = mřížka,
   týden = kalendář se sloupci, den = hodiny. */
export const ViewMonth = icon(GridIcon, 'ViewMonth')
export const ViewWeek = icon(Calendar04Icon, 'ViewWeek')
export const Clock = icon(Clock01Icon, 'Clock')
export const Repeat2 = icon(RepeatIcon, 'Repeat2')
export const Loader2 = icon(Loading03Icon, 'Loader2')

export const FileText = icon(File01Icon, 'FileText')
export const FileSpreadsheet = icon(Xls01Icon, 'FileSpreadsheet')
export const StickyNote = icon(StickyNote01Icon, 'StickyNote')
export const NotebookPen = icon(NoteEditIcon, 'NotebookPen')
/** Účtenka: volná sada má jen `Receipt` s konkrétní valutou, `Invoice` je bez. */
export const Receipt = icon(InvoiceIcon, 'Receipt')
export const ClipboardCheck = icon(TaskDone01Icon, 'ClipboardCheck')
export const ClipboardList = icon(CheckListIcon, 'ClipboardList')
export const ListTodo = icon(CheckListIcon, 'ListTodo')
export const List = icon(LeftToRightListBulletIcon, 'List')
export const ListOrdered = icon(LeftToRightListNumberIcon, 'ListOrdered')
export const CheckSquare = icon(CheckmarkSquare01Icon, 'CheckSquare')
export const Square = icon(SquareIcon, 'Square')
export const CheckCircle2 = icon(CheckmarkCircle02Icon, 'CheckCircle2')
export const AlertTriangle = icon(Alert02Icon, 'AlertTriangle')
export const MessageCircle = icon(Message01Icon, 'MessageCircle')
export const Handshake = icon(HandshakeIcon, 'Handshake')
export const HeartHandshake = icon(HandshakeIcon, 'HeartHandshake')
export const GraduationCap = icon(Mortarboard01Icon, 'GraduationCap')
export const Cake = icon(CakeIcon, 'Cake')
export const PartyPopper = icon(PartyIcon, 'PartyPopper')
export const PanelRight = icon(SidebarRight01Icon, 'PanelRight')

/* Editor zápisů. */
export const Link2 = icon(Link01Icon, 'Link2')
export const Bold = icon(TextBoldIcon, 'Bold')
export const Italic = icon(TextItalicIcon, 'Italic')
export const Heading = icon(HeadingIcon, 'Heading')
export const Quote = icon(QuoteDownIcon, 'Quote')
export const Code = icon(SourceCodeIcon, 'Code')
export const Table = icon(TableIcon, 'Table')
export const Image = icon(Image01Icon, 'Image')
export const Paperclip = icon(Attachment01Icon, 'Paperclip')
export const Type = icon(TextIcon, 'Type')
export const Undo = icon(ArrowTurnBackwardIcon, 'Undo')
export const Redo = icon(ArrowTurnForwardIcon, 'Redo')
