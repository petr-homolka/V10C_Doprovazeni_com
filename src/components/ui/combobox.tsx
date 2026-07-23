import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
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
 * Stejné vizuální jádro jako `Input`/`Select` (h-10, border-medium,
 * bg-inset, focus = 2px accent border), jen s vlastním rozbaleným
 * seznamem místo nativního prohlížečového — funguje i v PWA/na mobilu
 * (žádné hover-only ovládání, výběr klepnutím funguje stejně jako klikem).
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Vybrat…',
  emptyText = 'Nic nenalezeno.',
  className,
  disabled,
}: {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

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
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    setHighlighted(0)
  }, [query, open])

  function openDropdown() {
    if (disabled) return
    setOpen(true)
    setQuery('')
  }

  function commit(option: ComboboxOption) {
    onChange(option.value)
    setOpen(false)
    setQuery('')
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
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border-medium bg-surface-soft py-1 shadow-raised">
          {filtered.length === 0 ? (
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
        </div>
      )}
    </div>
  )
}
