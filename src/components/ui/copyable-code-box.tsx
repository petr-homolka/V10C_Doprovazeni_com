import { useState } from 'react'
import { Check, Copy } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

/**
 * CopyableCodeBox — přeměřeno 2026-07-19 na živé referenční appce (URL
 * box + copy tlačítko na stránce integrací): bg --bg-inset, border --border-medium, radius-sm,
 * výška 40px, monospace text. Použitelné třeba pro ověřovací URL dokumentu
 * (`crm.doprovazeni.cz/d/{UID}`, §4.3) nebo webhook URL profesionálního
 * importu (§5.5 C), až na ně dojde řada.
 */
export function CopyableCodeBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write can be denied (permissions policy, insecure context) —
      // fail silently rather than leave an unhandled rejection.
    }
  }

  return (
    <div className="flex h-10 items-center gap-2 rounded-sm border border-transparent bg-field pl-4 pr-1">
      <code className="flex-1 truncate font-mono text-base text-text-primary">{value}</code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Kopírovat"
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-sm transition-colors duration-150',
          copied ? 'bg-success text-text-inverse' : 'bg-primary text-primary-foreground hover:bg-primary-hover',
        )}
      >
        {copied ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={1.75} />}
      </button>
    </div>
  )
}
