import { useEffect, useState, type FormEvent } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import {
  getOrganization,
  getPlatformDefaults,
  updateOrgAgreementDurationMonths,
  updateOrgCapacityThreshold,
} from '@/services/organizationService'
import { DEFAULT_PLATFORM_AGREEMENT_DURATION_MONTHS, DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD } from '@/types/platformDefaults'

/**
 * /nastaveni/organizace — org_admin-only (§5.7 matice: vedení má u
 * organizačních nastavení jen READ, sem se nedostane vůbec). Nav položka
 * na tenhle route existovala už dřív (settingsNavGroups.ts) jako
 * placeholder pro budoucí obsah — tohle je první skutečná náplň.
 *
 * Obě pole jsou VOLITELNÉ org-level přepisy platformní výchozí hodnoty
 * (prázdné pole = "spadni na platformní výchozí"), stejná kaskáda jako
 * per-KO `capacityThresholdOverride` (viz src/lib/capacityThreshold.ts) —
 * `koCapacityThreshold` tu dřív nemělo žádné UI (jen service funkce),
 * doplněno spolu s novou délkou Dohody.
 */
export default function OrganizationSettingsPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const isOrgAdmin = userDoc?.role === 'org_admin'

  const [capacityThreshold, setCapacityThreshold] = useState('')
  const [agreementDuration, setAgreementDuration] = useState('')
  const [platformCapacityDefault, setPlatformCapacityDefault] = useState(DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD)
  const [platformDurationDefault, setPlatformDurationDefault] = useState(DEFAULT_PLATFORM_AGREEMENT_DURATION_MONTHS)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { loading: submitting, success, run } = useAsyncSubmit()

  useEffect(() => {
    if (!isOrgAdmin || !organizationId) return
    Promise.all([getOrganization(organizationId), getPlatformDefaults()])
      .then(([org, platformDefaults]) => {
        setCapacityThreshold(org?.koCapacityThreshold != null ? String(org.koCapacityThreshold) : '')
        setAgreementDuration(org?.agreementDefaultDurationMonths != null ? String(org.agreementDefaultDurationMonths) : '')
        setPlatformCapacityDefault(platformDefaults?.koCapacityThreshold ?? DEFAULT_PLATFORM_KO_CAPACITY_THRESHOLD)
        setPlatformDurationDefault(
          platformDefaults?.agreementDefaultDurationMonths ?? DEFAULT_PLATFORM_AGREEMENT_DURATION_MONTHS,
        )
      })
      .catch(() => setError('Nastavení organizace se nepodařilo načíst.'))
      .finally(() => setLoaded(true))
  }, [isOrgAdmin, organizationId])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!organizationId) return
    setError(null)
    try {
      await run(async () => {
        await Promise.all([
          updateOrgCapacityThreshold(organizationId, capacityThreshold.trim() ? Number(capacityThreshold) : null),
          updateOrgAgreementDurationMonths(
            organizationId,
            agreementDuration.trim() ? Number(agreementDuration) : null,
          ),
        ])
      })
    } catch {
      setError('Uložení se nezdařilo.')
    }
  }

  if (!isOrgAdmin) {
    return (
      <AppShell secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}>
        <PageHeader title="Organizace" variant="settings" />
        <p className="mt-4 text-sm text-text-secondary">Tahle stránka je jen pro org_admina.</p>
      </AppShell>
    )
  }

  return (
    <AppShell
      secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}
    >
      <PageHeader
        title="Organizace"
        description="Vlastní výchozí hodnoty pro tuhle organizaci — prázdné pole = použít platformní výchozí."
        variant="settings"
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
              Práh kapacity klíčové osoby <span className="font-normal text-text-tertiary">(platforma: {platformCapacityDefault})</span>
            </span>
            <Input
              type="number"
              min={1}
              placeholder={String(platformCapacityDefault)}
              value={capacityThreshold}
              onChange={(e) => setCapacityThreshold(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">
              Výchozí délka Dohody v měsících{' '}
              <span className="font-normal text-text-tertiary">(platforma: {platformDurationDefault})</span>
            </span>
            <Input
              type="number"
              min={1}
              placeholder={String(platformDurationDefault)}
              value={agreementDuration}
              onChange={(e) => setAgreementDuration(e.target.value)}
            />
            <span className="text-xs text-text-secondary">
              Jen předvyplní "Platí do" při založení Dohody — klíčová osoba může datum vždy ručně změnit.
            </span>
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
