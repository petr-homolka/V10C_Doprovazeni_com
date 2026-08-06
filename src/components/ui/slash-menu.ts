import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import type { Editor, Range } from '@tiptap/core'

/**
 * SLASH MENU — příkazy po napsání „/", jako v Routine.
 *
 * Odečteno z jejich `Editor-*.css` (`.suggestion-list`): panel 240 px široký,
 * max 328 px vysoký, radius 10 px, stín `0 1px 14px #0000000d`, položky
 * s radiusem 7 px a odsazením `6px 8px 6px 12px`, skupinové nadpisy 11 px
 * v barvě #a9a9a9, napravo od popisku ZKRATKA V MARKDOWNU.
 *
 * Ta zkratka napravo je detail, který stojí za povšimnutí: menu neučí jen
 * „co umím", ale i „jak to příště napsat rovnou". Kdo si zapamatuje `##`,
 * přestane menu potřebovat — nástroj, který se dá odrůst.
 *
 * Popisky jsou české, protože appku používají čeští pracovníci; zkratky
 * zůstávají v markdownu, protože ten je stejný ve všech jazycích.
 */

export interface SlashCommand {
  /** Co se ukáže v seznamu. */
  title: string
  /** Skupina, pod kterou položka patří („Text", „Seznamy", „Blok"). */
  group: string
  /** Zkratka v markdownu, vypsaná napravo. */
  hint?: string
  /** Slova, na která se má položka najít i bez přesného názvu. */
  keywords?: string[]
  /** Jméno ikony v `slash-menu-view`, ať tenhle soubor nezávisí na Reactu. */
  icon: string
  run: (props: { editor: Editor; range: Range }) => void
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    title: 'Nadpis 1',
    group: 'Text',
    hint: '#',
    icon: 'h1',
    keywords: ['nadpis', 'titulek', 'heading'],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Nadpis 2',
    group: 'Text',
    hint: '##',
    icon: 'h2',
    keywords: ['nadpis', 'heading'],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Nadpis 3',
    group: 'Text',
    hint: '###',
    icon: 'h3',
    keywords: ['nadpis', 'heading'],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Odstavec',
    group: 'Text',
    icon: 'text',
    keywords: ['text', 'normální', 'body'],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: 'Odrážky',
    group: 'Seznamy',
    hint: '-',
    icon: 'ul',
    keywords: ['seznam', 'bullet', 'list'],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Číslovaný seznam',
    group: 'Seznamy',
    hint: '1.',
    icon: 'ol',
    keywords: ['seznam', 'číslo', 'ordered'],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Úkoly',
    group: 'Seznamy',
    hint: '[]',
    icon: 'task',
    keywords: ['úkol', 'checkbox', 'todo', 'zaškrtávátko'],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Citace',
    group: 'Blok',
    hint: '>',
    icon: 'quote',
    keywords: ['citace', 'quote', 'výrok'],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Blok kódu',
    group: 'Blok',
    hint: '```',
    icon: 'code',
    keywords: ['kód', 'code'],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Oddělovač',
    group: 'Blok',
    hint: '---',
    icon: 'hr',
    keywords: ['linka', 'oddělovač', 'divider'],
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
]

/** Bezdiakritické hledání — „citace" se musí najít i jako „citace"/„citac". */
function norm(text: string): string {
  return text
    .toLocaleLowerCase('cs')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function filterSlashCommands(query: string): SlashCommand[] {
  const q = norm(query.trim())
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter((command) => {
    const haystack = [command.title, ...(command.keywords ?? [])].map(norm)
    return haystack.some((text) => text.includes(q))
  })
}

/** Vytvoří rozšíření; vykreslování panelu dodává `slash-menu-view.tsx`. */
export function createSlashMenu(render: SuggestionOptions['render']): Extension {
  return Extension.create({
    name: 'slashMenu',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '/',
          // Jen na začátku prázdného řádku nebo po mezeře — jinak by „a/b"
          // otevřelo menu uprostřed slova.
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }) => filterSlashCommands(query),
          command: ({ editor, range, props }) => (props as SlashCommand).run({ editor, range }),
          render,
        }),
      ]
    },
  })
}
