import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
}

/**
 * Vyhledávatelný výběr ze seznamu — náhrada `<Select>` tam, kde je seznam
 * dlouhý (desítky+ položek, typicky lidé/instituce), a procházení pouhým
 * rolováním je nepříjemné. Pro krátké pevné výčty (stav, role, typ...)
 * zůstává `<Select>` — combobox by tam byl zbytečná komplikace navíc.
 *
 * `onCreateOption` (2026-07-23, Petrovo zadání "číselníky nesmí mít
 * konečný počet variant... uživatel si je definuje sám"): pokud je
 * zadaná, dole v rozbaleném seznamu se objeví VÝRAZNÉ "+ Přidat nový"
 * tlačítko (Lumo/enterprise "creatable select" vzor — Notion/Linear/
 * GitHub štítky mají identickou afordanci). Klik přepne řádek na mini
 * formulář (text + Uložit/Zrušit) přímo uvnitř rozbaleného seznamu, ne
 * samostatný modál — nová hodnota se hned vybere po uložení. Volající
 * (`onCreateOption`) rozhoduje, KAM se nová hodnota persistuje (typicky
 * per-organizace číselník, viz `enumOptionsService.ts`).
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Vybrat…',
  emptyText = 'Nic nenalezeno.',
  className,
  disabled,
  onCreateOption,
  createLabel = 'Přidat nový',
}: {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  onCreateOption?: (label: string) => Promise<ComboboxOption> | ComboboxOption
  createLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const [creating, setCreating] = useState(false)
  const [createDraft, setCreateDraft] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const createInputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setCreating(false)
        setCreateDraft('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    setHighlighted(0)
  }, [query, open])

  useEffect(() => {
    if (creating) createInputRef.current?.focus()
  }, [creating])

  function openDropdown() {
    if (disabled) return
    setOpen(true)
    setQuery('')
  }

  function commit(option: ComboboxOption) {
    onChange(option.value)
    setOpen(false)
    setQuery('')
    setCreating(false)
    setCreateDraft('')
  }

  function startCreating() {
    setCreateDraft(query.trim())
    setCreating(true)
  }

  async function handleCreateSubmit() {
    const label = createDraft.trim()
    if (!label || !onCreateOption) return
    setCreateBusy(true)
    try {
      const option = await onCreateOption(label)
      commit(option)
    } finally {
      setCreateBusy(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        openDropdown()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const option = filtered[highlighted]
      if (option) commit(option)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      setCreating(false)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        disabled={disabled}
        className={cn(
          'h-9 w-full rounded-sm border border-transparent bg-field px-3 pr-9 text-[16px]',
          'text-text-primary placeholder:text-text-tertiary transition-shadow duration-150',
          'focus:border-accent focus:outline-none focus:shadow-focus',
          'disabled:opacity-50',
        )}
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? '')}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={openDropdown}
        onKeyDown={handleKeyDown}
      />
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border border-border-medium bg-surface-soft py-1 shadow-raised">
          {filtered.length === 0 && !onCreateOption ? (
            <p className="px-3 py-2 text-sm text-text-tertiary">{emptyText}</p>
          ) : (
            filtered.map((option, i) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'block w-full px-3 py-2 text-left text-[15px] text-text-primary',
                  i === highlighted ? 'bg-overlay-active' : 'hover:bg-overlay-active',
                )}
                onMouseEnter={() => setHighlighted(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(option)}
              >
                {option.label}
              </button>
            ))
          )}

          {onCreateOption && (
            <div className="border-t border-border-subtle">
              {creating ? (
                // Vědomě `<div>`, NE `<form>` — tenhle mini-formulář žije
                // uvnitř nadřazeného `<form>` (Combobox je typicky pole
                // v jiném formuláři, viz `CalendarPage.tsx` Typ události).
                // Vnořený `<form>` je v DOMu platný (na rozdíl od HTML
                // parsovaného ze stringu prohlížeč nic neopravuje) — nativní
                // submit se pak probublá i do OBALUJÍCÍHO formuláře a
                // odešle ho taky (živě odhaleno: klik na "Uložit" tady
                // omylem založil/odeslal celou "Novou událost" s prázdným
                // názvem). Ukládání proto řeší výhradně `onClick`/`onKeyDown`.
                <div className="flex items-center gap-1.5 p-2">
                  <input
                    ref={createInputRef}
                    value={createDraft}
                    onChange={(e) => setCreateDraft(e.target.value)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateSubmit()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setCreating(false)
                      }
                    }}
                    placeholder="Název nové položky…"
                    className="h-8 min-w-0 flex-1 rounded-sm border border-transparent bg-field px-2 text-[14px] text-text-primary focus:border-accent focus:outline-none focus:shadow-focus"
                  />
                  <button
                    type="button"
                    disabled={!createDraft.trim() || createBusy}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleCreateSubmit}
                    className="flex h-8 shrink-0 items-center gap-1 rounded-sm bg-primary px-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {createBusy && <Loader2 size={13} className="animate-spin" />}
                    Uložit
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setCreating(false)}
                    className="flex h-8 shrink-0 items-center rounded-sm px-2 text-[13px] text-text-secondary hover:bg-overlay-active"
                  >
                    Zrušit
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={startCreating}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[14px] font-semibold text-primary hover:bg-primary-soft"
                >
                  <Plus size={16} strokeWidth={2.25} /> {createLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
