import { useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import {
  getPlatformDefaults,
  setPlatformAgreementDefaultDurationMonths,
  setPlatformKoCapacityThreshold,
} from '@/services/organizationService'
import { DEFAULT_PLATFORM_AGREEMENT_DURATION_MONTHS, DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD } from '@/types/platformDefaults'

/**
 * /platforma — DOPLNENI_ZADANI-DO-M5 §1 bod 3. PRVNÍ superadmin-only
 * stránka v celé appce (dosud žádná neexistovala, viz research před touhle
 * dávkou) — mimo `/nastaveni/*` (ty jsou vždy org-scoped, §5.7 matice),
 * proto vlastní top-level route bez `secondaryPanel` nav.
 */
export default function PlatformSettingsPage() {
  const { userDoc } = useAuth()
  const [threshold, setThreshold] = useState('')
  const [agreementDuration, setAgreementDuration] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { loading: submitting, success, run } = useAsyncSubmit()

  const isSuperadmin = userDoc?.role === 'superadmin'

  useEffect(() => {
    if (!isSuperadmin) return
    getPlatformDefaults()
      .then((defaults) => {
        setThreshold(String(defaults?.koCapacityThreshold ?? DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD))
        setAgreementDuration(String(defaults?.agreementDefaultDurationMonths ?? DEFAULT_PLATFORM_AGREEMENT_DURATION_MONTHS))
      })
      .catch(() => setError('Platformní nastavení se nepodařilo načíst.'))
      .finally(() => setLoaded(true))
  }, [isSuperadmin])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await run(async () => {
        await Promise.all([
          setPlatformKoCapacityThreshold(Math.max(1, Number(threshold) || DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD)),
          setPlatformAgreementDefaultDurationMonths(
            Math.max(1, Number(agreementDuration) || DEFAULT_PLATFORM_AGREEMENT_DURATION_MONTHS),
          ),
        ])
      })
    } catch {
      setError('Uložení se nezdařilo.')
    }
  }

  if (!isSuperadmin) {
    return (
      <AppShell breadcrumb={[{ label: 'Platforma' }]}>
        <PageHeader title="Platforma" />
        <p className="mt-4 text-sm text-text-secondary">Tahle stránka je jen pro superadmina.</p>
      </AppShell>
    )
  }

  return (
    <AppShell breadcrumb={[{ label: 'Platforma' }]}>
      <PageHeader
        title="Platforma"
        description="Výchozí hodnoty pro všechny organizace, dokud si je organizace sama nepřepíše."
      />

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {loaded && (
        <form onSubmit={handleSave} className="mt-6 max-w-[560px] space-y-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">
              Výchozí práh kapacity klíčové osoby
            </span>
            <Input type="number" min={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">
              Výchozí délka Dohody (měsíce)
            </span>
            <Input
              type="number"
              min={1}
              value={agreementDuration}
              onChange={(e) => setAgreementDuration(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="secondary" size="sm" loading={submitting} success={success}>
              Uložit
            </Button>
            {success && <span className="text-sm text-success">Uloženo.</span>}
          </div>
        </form>
      )}
    </AppShell>
  )
}
