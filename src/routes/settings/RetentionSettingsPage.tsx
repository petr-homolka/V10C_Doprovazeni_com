import { useEffect, useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { PageHead } from '@/components/spis/PageBody'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import {
  RETENTION_RULES,
  applyRetentionOverrides,
  describeRetention,
  summarizeRetention,
  type RetentionRule,
} from '@/lib/retentionPolicy'
import { readRetentionOverrides } from '@/services/retentionSettingsService'
import { auditActor } from '@/services/auditLogService'
import {
  RETENTION_CONFIRMATION,
  executeRetention,
  planRetention,
  type RetentionPlan,
} from '@/services/retentionService'

/**
 * /nastaveni/retence — jak dlouho co držíme.
 *
 * Stránka dělá tři věci a v tomhle pořadí:
 * 1. UKÁŽE POLITIKU. Tabulka je zároveň podklad pro směrnici organizace.
 * 2. PŘIZNÁ, CO NENÍ ROZHODNUTÉ. Většina lhůt u dokumentace o dítěti je
 *    právní otázka; aplikace je nemá vymýšlet a tady je vidět, na co se
 *    čeká. Do rozhodnutí se nemaže nic.
 * 3. TEPRVE POTOM UMOŽNÍ ÚKLID — a to na dva kroky: nejdřív spočítat,
 *    pak opsat slovo. Žádné „Vyčistit" jedním klikem.
 */
export default function RetentionSettingsPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const isOrgAdmin = userDoc?.role === 'org_admin' || userDoc?.role === 'superadmin'

  // Zobrazuje se to, co SKUTEČNĚ platí, ne výchozí hodnoty z kódu. Kdyby
  // tahle stránka ukazovala katalog a mazací běh jel podle nastavení,
  // organizace by četla jiná čísla, než podle kterých se maže.
  const [rules, setRules] = useState<RetentionRule[]>(RETENTION_RULES)
  useEffect(() => {
    readRetentionOverrides()
      .then((o) => setRules(applyRetentionOverrides(o)))
      .catch(() => {
        /* Nepovedlo se načíst nastavení — ukáže se katalog, tedy ta
           přísnější varianta („nerozhodnuto, nemaže se"). */
      })
  }, [])
  const summary = summarizeRetention(rules)

  const [plan, setPlan] = useState<RetentionPlan | null>(null)
  const [planning, setPlanning] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePlan() {
    if (!organizationId) return
    setPlanning(true)
    setError(null)
    setNotice(null)
    try {
      setPlan(await planRetention(organizationId))
    } catch {
      setError('Kontrolu se nepodařilo provést.')
    } finally {
      setPlanning(false)
    }
  }

  async function handleExecute() {
    if (!organizationId || !userDoc) return
    setDeleting(true)
    setError(null)
    try {
      const result = await executeRetention(organizationId, auditActor(userDoc), confirmation)
      setNotice(
        result.deleted === 0
          ? 'Úklid proběhl, za lhůtou nebylo nic.'
          : `Smazáno ${result.deleted} záznamů. Zapsáno do auditní stopy.`,
      )
      setConfirmation('')
      setPlan(null)
    } catch {
      setError('Úklid se nepodařilo dokončit.')
    } finally {
      setDeleting(false)
    }
  }

  if (!organizationId) {
    return (
      <AppShell secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}>
        <PageHead title="Doba uchování" />
        <section className="sp__card sp__card--pad">
          <p className="text-sm text-text-secondary">Tahle stránka je pro zaměstnance konkrétní organizace.</p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}>
      <PageHead
        title="Doba uchování"
        description="Osobní údaje se smějí držet jen po dobu nezbytnou pro účel. Tady je napsané, jak dlouho to u nás je."
      >
        {(notice || error) && (
          <>
            {notice && <p className="text-sm text-success">{notice}</p>}
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </PageHead>

      {summary.needsDecision > 0 && (
        <section className="sp__card sp__card--pad border-l-2 border-l-accent">
          <p className="text-sm text-text-primary">
            {summary.needsDecision} z {summary.total} kategorií nemá rozhodnutou lhůtu.
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Do rozhodnutí se u nich nemaže nic — systém v pochybnostech drží. Délka archivace
            dokumentace o dítěti v náhradní rodinné péči je právní otázka (skartační řád
            organizace, archivační povinnosti), ne nastavení aplikace; až padne rozhodnutí,
            zapíše se do <code className="text-xs">lib/retentionPolicy.ts</code> a projeví se všude.
          </p>
        </section>
      )}

      <section className="sp__card sp__card--pad">
        <h2 className="text-base text-text-primary">Politika</h2>
        <div className="mt-3 flex flex-col">
          {rules.map((rule) => {
            const item = plan?.items.find((i) => i.rule.key === rule.key)
            return (
              <article key={rule.key} className="border-b border-border-subtle py-3 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm text-text-primary">{rule.label}</p>
                  <p
                    className={
                      rule.status === 'needs_decision' ? 'text-sm text-accent' : 'text-sm text-text-secondary'
                    }
                  >
                    {describeRetention(rule)}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-text-tertiary">{rule.what}</p>
                <p className="mt-1 text-xs text-text-faint">{rule.basis}</p>
                {item && (
                  <p className="mt-1 text-xs text-text-secondary">
                    {item.skipped === 'needs_decision'
                      ? 'Nekontrolováno — lhůta není rozhodnutá.'
                      : item.skipped === 'no_scanner'
                        ? 'Lhůta je rozhodnutá, ale úklid pro tuhle kategorii ještě není napsaný.'
                        : `Za lhůtou: ${item.count} záznamů.`}
                    {item.sample.length > 0 && ` (${item.sample.join('; ')})`}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="sp__card sp__card--pad">
        <h2 className="text-base text-text-primary">Úklid</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Nic se nemaže samo — projekt nemá serverovou úlohu, která by běžela v noci. Úklid je
          vždycky vědomé rozhodnutí člověka a zapisuje se do auditní stopy.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handlePlan} disabled={planning}>
            {planning ? 'Počítám…' : 'Spočítat, co je za lhůtou'}
          </Button>
          {plan && (
            <span className="text-sm text-text-secondary">
              {plan.totalToDelete === 0
                ? 'Za lhůtou není nic.'
                : `Za lhůtou je ${plan.totalToDelete} záznamů.`}
            </span>
          )}
        </div>

        {plan && plan.totalToDelete > 0 && isOrgAdmin && (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <p className="text-sm text-text-primary">
              Smazání je nevratné. Pro potvrzení opište slovo <strong>{RETENTION_CONFIRMATION}</strong>.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-[160px]"
                aria-label={`Opište ${RETENTION_CONFIRMATION}`}
              />
              <Button
                variant="destructive"
                size="sm"
                disabled={confirmation !== RETENTION_CONFIRMATION || deleting}
                onClick={handleExecute}
              >
                {deleting ? 'Mažu…' : 'Smazat, co je za lhůtou'}
              </Button>
            </div>
          </div>
        )}

        {plan && plan.totalToDelete > 0 && !isOrgAdmin && (
          <p className="mt-3 text-sm text-text-tertiary">Smazat smí jen správce organizace.</p>
        )}
      </section>
    </AppShell>
  )
}
