import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Bold, Italic, Heading, List, ListOrdered, Link2 } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

/**
 * MarkdownEditor (UX zpětná vazba 2026-07-21) — dokument se PÍŠE v markdownu
 * (ukládá se jako markdown, čte přes `react-markdown`, viz DocumentDetailPage),
 * ale holé `<textarea>` s popiskem "(markdown)" bylo na uživatele hozené
 * břemeno "napiš si značky sám". Tenhle editor dává formátovací lištu
 * (obalí výběr značkou) + přepínač Psát/Náhled se ŽIVÝM renderem stejným
 * komponentem, jakým se dokument nakonec zobrazí — WYSIWYG-blízko bez
 * těžké contenteditable knihovny (žádná nová závislost, jen react-markdown,
 * co v projektu už je).
 */
type Wrap = { before: string; after: string }
type LinePrefix = { prefix: string }

export function MarkdownEditor({
  value,
  onChange,
  rows = 14,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const ref = useRef<HTMLTextAreaElement>(null)

  function applyWrap({ before, after }: Wrap) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || 'text'
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
    // Po re-renderu vrátíme kurzor tak, aby obklopoval vložený text.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  function applyLinePrefix({ prefix }: LinePrefix) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  const toolButton =
    'flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-overlay-active hover:text-text-primary'

  return (
    <div className="overflow-hidden rounded-md border border-transparent bg-field">
      <div className="flex items-center justify-between border-b border-border-subtle bg-surface-soft px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <button type="button" className={toolButton} title="Tučně" onClick={() => applyWrap({ before: '**', after: '**' })}>
            <Bold size={15} strokeWidth={2} />
          </button>
          <button type="button" className={toolButton} title="Kurzíva" onClick={() => applyWrap({ before: '_', after: '_' })}>
            <Italic size={15} strokeWidth={2} />
          </button>
          <button type="button" className={toolButton} title="Nadpis" onClick={() => applyLinePrefix({ prefix: '## ' })}>
            <Heading size={15} strokeWidth={2} />
          </button>
          <button type="button" className={toolButton} title="Odrážky" onClick={() => applyLinePrefix({ prefix: '- ' })}>
            <List size={15} strokeWidth={2} />
          </button>
          <button type="button" className={toolButton} title="Číslovaný seznam" onClick={() => applyLinePrefix({ prefix: '1. ' })}>
            <ListOrdered size={15} strokeWidth={2} />
          </button>
          <button type="button" className={toolButton} title="Odkaz" onClick={() => applyWrap({ before: '[', after: '](https://)' })}>
            <Link2 size={15} strokeWidth={2} />
          </button>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={cn('rounded-md px-2.5 py-1 font-medium transition-colors', tab === 'write' ? 'bg-primary text-primary-foreground' : 'text-text-secondary hover:text-text-primary')}
          >
            Psát
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={cn('rounded-md px-2.5 py-1 font-medium transition-colors', tab === 'preview' ? 'bg-primary text-primary-foreground' : 'text-text-secondary hover:text-text-primary')}
          >
            Náhled
          </button>
        </div>
      </div>

      {tab === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-y bg-inset px-4 py-3 text-lg leading-relaxed text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
      ) : (
        <div className="min-h-[8rem] px-4 py-3" style={{ minHeight: `${rows * 1.6}rem` }}>
          {value.trim() ? (
            <div className="prose prose-sm max-w-none text-text-primary">
              <ReactMarkdown>{value}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Zatím prázdné — přepněte na „Psát“.</p>
          )}
        </div>
      )}
    </div>
  )
}
