import { useState, type ReactNode } from 'react'
import { AlertTriangle } from '@/components/ui/icons'
import { Button } from './button'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'

/**
 * "Nebezpečná zóna" — UX zpětná vazba 2026-07-20, přesně dle Magnific
 * vzoru (orámovaný box, varovný text nahoře, destruktivní akce až uvnitř
 * samostatného vnitřního boxu, ne hned vedle nadpisu profilu). Zatím jen
 * jedno použití (Ukončit Dohodu), ale komponenta je obecná — Magnific má
 * tenhle vzor pro VÍC věcí (zrušení předplatného apod.), takže i tady
 * bude dřív nebo později víc než jedna `DangerZoneAction`.
 */
export function DangerZone({ title = 'Nebezpečná zóna', children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-danger p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <AlertTriangle size={16} className="text-danger" />
        {title}
      </div>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </div>
  )
}

export function DangerZoneAction({
  label,
  description,
  actionLabel,
  confirmLabel = 'Potvrdit',
  onAction,
}: {
  label: string
  description: string
  actionLabel: string
  confirmLabel?: string
  onAction: () => Promise<void> | void
}) {
  const [confirming, setConfirming] = useState(false)
  const { loading, success, run } = useAsyncSubmit()
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setError(null)
    try {
      await run(() => Promise.resolve(onAction()))
      setConfirming(false)
    } catch {
      setError('Akce se nezdařila.')
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md shadow-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-primary">{label}</p>
          <p className="text-xs text-text-secondary">{description}</p>
        </div>
        {!confirming && (
          <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
            {actionLabel}
          </Button>
        )}
      </div>
      {confirming && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-text-secondary">Opravdu? Tuhle akci nejde vzít zpět.</p>
          <Button variant="destructive" size="sm" onClick={handleConfirm} loading={loading} success={success}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={loading}>
            Zrušit
          </Button>
        </div>
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
