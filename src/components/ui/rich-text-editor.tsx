import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import { htmlToMarkdown, markdownToHtml } from '@/lib/markdown'
import { createSlashMenu, filterSlashCommands, type SlashCommand } from '@/components/ui/slash-menu'
import {
  Heading, Type, List, ListOrdered, CheckSquare, Quote, Code, Minus,
} from '@/components/ui/icons'
import { cn } from '@/lib/utils'

/**
 * EDITOR ZÁPISŮ A DOKUMENTŮ — postavený jako ten v Routine.
 *
 * Routine používá ProseMirror; my používáme Tiptap, což je ProseMirror
 * s rozumným rozhraním (obojí MIT). Nekopírujeme jejich kód, staví se to
 * na stejném základu a podle jejich ODEČTENÉHO vzhledu a chování:
 *
 *   - žádná trvalá formátovací lišta. Formátuje se psaním (`##`, `-`, `>`)
 *     nebo příkazem po „/". Lišta nad textem je nábytek, který zabírá místo
 *     každou sekundu, i když se použije dvakrát za dokument.
 *   - šířka textu 650 px, na střed (jejich `.editor{max-width:650px}`).
 *     Řádek delší než ~90 znaků se špatně čte, i když monitor místo má.
 *   - nadpisy 24/20/18 px, řez 600, s velkým odstupem NAD (32/24/16 px)
 *     a malým pod — nadpis patří k tomu, co je za ním, ne k tomu, co je před.
 *   - citace je serifová a velká (22/30) — jediné místo v celé appce, kde je
 *     jiný hlas, protože citace JE jiný hlas.
 *   - odkaz nese podtržení 0.5px, ne barvu. Barva je vyhrazená pro naléhavost.
 *
 * Ukládá se MARKDOWN (`lib/markdown.ts`), takže existující dokumenty se
 * nemusí migrovat a čtecí stránka funguje dál.
 */

const SLASH_ICONS: Record<string, (props: { size?: number }) => React.ReactElement> = {
  h1: Heading,
  h2: Heading,
  h3: Heading,
  text: Type,
  ul: List,
  ol: ListOrdered,
  task: CheckSquare,
  quote: Quote,
  code: Code,
  hr: Minus,
}

interface MenuState {
  items: SlashCommand[]
  selected: number
  rect: { left: number; top: number; bottom: number } | null
  onSelect: (command: SlashCommand) => void
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Začněte psát, nebo napište „/" pro příkazy…',
  minHeight = 260,
  className,
}: {
  /** Markdown. */
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  minHeight?: number
  className?: string
}) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  /** Ať `onChange` nepřepíše obsah, který uživatel právě píše. */
  const lastEmitted = useRef(value)

  /* Slash menu se vykresluje mimo editor (fixed), protože panel nesmí být
     ořezaný přetečením formuláře v pravém panelu. */
  const slashMenu = useMemo(
    () =>
      createSlashMenu(() => {
        let command: ((item: SlashCommand) => void) | null = null
        let items: SlashCommand[] = []
        let selected = 0
        // `onKeyDown` od Tiptapu NEDOSTÁVÁ `clientRect` (jen `onStart`
        // a `onUpdate`), takže si polohu kurzoru držíme sami — jinak by menu
        // při pohybu šipkami zmizelo.
        let rect: { left: number; top: number; bottom: number } | null = null

        const paint = () => {
          setMenu({ items, selected, rect, onSelect: (item) => command?.(item) })
        }
        const remember = (get?: () => DOMRect | null) => {
          const box = get?.()
          if (box) rect = { left: box.left, top: box.top, bottom: box.bottom }
        }

        return {
          onStart: (props) => {
            items = props.items as SlashCommand[]
            selected = 0
            command = (item) => props.command(item)
            remember(props.clientRect ?? undefined)
            paint()
          },
          onUpdate: (props) => {
            items = props.items as SlashCommand[]
            selected = Math.min(selected, Math.max(0, items.length - 1))
            command = (item) => props.command(item)
            remember(props.clientRect ?? undefined)
            paint()
          },
          onKeyDown: (props) => {
            if (props.event.key === 'Escape') {
              setMenu(null)
              return true
            }
            if (props.event.key === 'ArrowDown') {
              selected = (selected + 1) % Math.max(1, items.length)
              paint()
              return true
            }
            if (props.event.key === 'ArrowUp') {
              selected = (selected - 1 + items.length) % Math.max(1, items.length)
              paint()
              return true
            }
            if (props.event.key === 'Enter' || props.event.key === 'Tab') {
              const item = items[selected]
              if (item) command?.(item)
              return true
            }
            return false
          },
          onExit: () => setMenu(null),
        }
      }),
    [],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Odkazy řeší rozšíření Link (potřebuje vlastní nastavení), takže
        // ve StarterKitu by se registrovaly dvakrát.
        link: false,
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        // Bez tohohle by se do dokumentu dal vložit `javascript:` odkaz.
        protocols: ['http', 'https', 'mailto', 'tel'],
      }),
      slashMenu,
    ],
    content: markdownToHtml(value),
    // Kurzor do editoru hned po otevření — panel „Nový zápis" se otvírá právě
    // proto, aby se do něj psalo.
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'rte__content',
        spellcheck: 'true',
        lang: 'cs',
      },
    },
    onUpdate: ({ editor: instance }) => {
      const markdown = htmlToMarkdown(instance.getHTML())
      lastEmitted.current = markdown
      onChange(markdown)
    },
  })

  /* Když se hodnota změní ZVENČÍ (načtení dokumentu, přepnutí záznamu),
     obsah se přenastaví. Porovnání proti `lastEmitted` je nutné — bez něj
     by každý stisk klávesy vyvolal `setContent` a kurzor by skákal na začátek. */
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return
    lastEmitted.current = value
    editor.commands.setContent(markdownToHtml(value), { emitUpdate: false })
  }, [editor, value])

  const headings = useHeadings(editor)

  return (
    <div className={cn('rte', className)}>
      <div className="rte__frame" style={{ minHeight }}>
        <EditorContent editor={editor} />
        {/* Osnova z nadpisů — jejich `.table-of-contents`: svislý sloupek
            čárek napravo od textu, které se na kurzoru rozbalí na názvy.
            Ukazuje se, jen když má co ukazovat. */}
        {headings.length > 1 && (
          <nav className="rte__toc" aria-label="Osnova dokumentu">
            {headings.map((heading) => (
              <button
                key={heading.id}
                type="button"
                className="rte__tocitem"
                onClick={() => editor?.commands.focus(heading.pos)}
              >
                <span className={`rte__tocline rte__tocline--${heading.level}`} />
                <span className="rte__toctext">{heading.text}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      <p className="rte__hint">
        Napište <kbd>/</kbd> pro příkazy · <kbd>##</kbd> nadpis · <kbd>-</kbd> odrážka ·{' '}
        <kbd>&gt;</kbd> citace
      </p>

      {menu && menu.rect && menu.items.length > 0 && <SlashMenuPanel menu={menu} />}
    </div>
  )
}

/** Panel příkazů. Skupiny se vypisují průběžně, jak se mění filtr. */
function SlashMenuPanel({ menu }: { menu: MenuState }) {
  const { items, selected, rect, onSelect } = menu
  // Pod kurzorem, pokud se vejde; jinak nad něj.
  const spaceBelow = window.innerHeight - (rect?.bottom ?? 0)
  const above = spaceBelow < 340
  const style = above
    ? { left: rect?.left, bottom: window.innerHeight - (rect?.top ?? 0) + 6 }
    : { left: rect?.left, top: (rect?.bottom ?? 0) + 6 }

  let lastGroup = ''
  return (
    <div className="rte__menu" style={style} role="listbox">
      {items.map((item, index) => {
        const Icon = SLASH_ICONS[item.icon] ?? Type
        const groupChanged = item.group !== lastGroup
        lastGroup = item.group
        return (
          <div key={item.title}>
            {groupChanged && <div className="rte__menugroup">{item.group}</div>}
            <button
              type="button"
              role="option"
              aria-selected={index === selected}
              className={cn('rte__menuitem', index === selected && 'rte__menuitem--on')}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(item)
              }}
            >
              <span className="rte__menuicon">
                <Icon size={16} />
              </span>
              <span className="rte__menutitle">{item.title}</span>
              {item.hint && <span className="rte__menuhint">{item.hint}</span>}
            </button>
          </div>
        )
      })}
    </div>
  )
}

interface HeadingRef {
  id: string
  level: number
  text: string
  pos: number
}

/** Nadpisy dokumentu pro osnovu. Přepočítává se při každé změně obsahu. */
function useHeadings(editor: Editor | null): HeadingRef[] {
  const [headings, setHeadings] = useState<HeadingRef[]>([])

  const collect = useCallback((instance: Editor) => {
    const found: HeadingRef[] = []
    instance.state.doc.descendants((node, pos) => {
      if (node.type.name !== 'heading') return
      found.push({
        id: `${pos}`,
        level: Number(node.attrs.level ?? 1),
        text: node.textContent || 'Bez názvu',
        pos: pos + 1,
      })
    })
    setHeadings(found)
  }, [])

  useEffect(() => {
    if (!editor) return
    collect(editor)
    const handler = () => collect(editor)
    editor.on('update', handler)
    return () => {
      editor.off('update', handler)
    }
  }, [editor, collect])

  return headings
}

/** Filtr příkazů je vytažený, aby se dal otestovat bez editoru. */
export { filterSlashCommands }
