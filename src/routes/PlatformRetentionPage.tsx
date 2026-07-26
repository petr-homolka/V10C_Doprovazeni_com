import { useEffect, useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { PageHead } from '@/components/spis/PageBody'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import {
  RETENTION_ANCHOR_LABELS,
  RETENTION_RULES,
  applyRetentionOverrides,
  validateRetentionOverride,
  type RetentionAction,
  type RetentionOverrides,
} from '@/lib/retentionPolicy'
import { decision, readRetentionOverrides, saveRetentionOverrides } from '@/services/retentionSettingsService'

/**
 * /platforma/retence — NASTAVENÍ RETENČNÍCH LHŮT. Superadmin.
 *
 * Do 26. 7. byly lhůty konstanty v kódu a měnily se nasazením. Sedm
 * kategorií z devíti přitom nemělo rozhodnutou lhůtu a čekalo se na
 * právní odpověď — jenže „počkat na odpověď a pak zavolat programátora"
 * je postup, který se nikdy nedokončí.
 *
 * Proč platformní a ne per-organizace: lhůta u dokumentace o dítěti
 * vychází ze zákona, ne z chuti organizace. Kdyby si ji každá nastavovala
 * sama, první, kdo bude chtít uklidit, si ji zkrátí.
 *
 * ─── CO STRÁNKA SCHVÁLNĚ NEDĚLÁ ───────────────────────────────────────
 *
 * Nemaže. Tady se lhůty jen ZAPISUJÍ; samotný úklid zůstává v Nastavení
 * organizace na dva kroky (spočítat, pak opsat slovo). Rozhodnutí
 * o pravidle a jeho vykonání nad konkrétními daty jsou dvě různé věci
 * a nemají být na jedné obrazovce vedle sebe.
 */

const ACTION_LABELS: Record<RetentionAction, string> = {
  review: 'Zeptat se (nemazat)',
  anonymize: 'Anonymizovat',
  delete: 'Smazat',
}

interface Draft {
  keepMonths: string
  action: RetentionAction
  note: string
}

export default function PlatformRetentionPage() {
  const { userDoc } = useAuth()
  const isSuperadmin = userDoc?.role === 'superadmin'

  const [overrides, setOverrides] = useState<RetentionOverrides>({})
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuperadmin) {
      setLoaded(true)
      return
    }
    readRetentionOverrides()
      .then((loadedOverrides) => {
        setOverrides(loadedOverrides)
        const effective = applyRetentionOverrides(loadedOverrides)
        setDrafts(
          Object.fromEntries(
            effective.map((r) => [
              r.key,
              {
                keepMonths: r.keepMonths === null ? '' : String(r.keepMonths),
                action: r.action,
                note: loadedOverrides[r.key]?.note ?? '',
              },
            ]),
          ),
        )
      })
      .catch(() => setError('Nastavení se nepodařilo načíst.'))
      .finally(() => setLoaded(true))
  }, [isSuperadmin])

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
    setNotice(null)
  }

  async function handleSave() {
    if (!userDoc) return
    setError(null)
    setNotice(null)

    // Nejdřív se zkontroluje VŠECHNO, teprve pak se ukládá. Uložit půlku
    // a spadnout na šestém řádku by nechalo politiku v půli.
    const next: RetentionOverrides = {}
    for (const rule of RETENTION_RULES) {
      const draft = drafts[rule.key]
      if (!draft) continue
      const raw = draft.keepMonths.trim()
      const keepMonths = raw === '' ? null : Number(raw)
      const problem = validateRetentionOverride({ keepMonths, action: draft.action })
      if (problem) {
        setError(`${rule.label}: ${problem}`)
        return
      }
      next[rule.key] = decision({
        keepMonths,
        action: draft.action,
        note: draft.note.trim() || undefined,
        decidedByUid: userDoc.uid,
      })
    }

    setSaving(true)
    try {
      await saveRetentionOverrides(next, userDoc.uid)
      setOverrides(next)
      setNotice('Uloženo. Projeví se všude, kde se lhůty počítají.')
    } catch {
      setError('Uložení se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  if (!isSuperadmin) {
    return (
      <AppShell>
        <PageHead title="Retenční lhůty" />
        <section className="sp__card sp__card--pad">
          <p className="text-sm text-text-secondary">
            Retenční lhůty nastavuje provozovatel systému. Vaše organizace je vidí v Nastavení →
            Doba uchování.
          </p>
        </section>
      </AppShell>
    )
  }

  const effective = applyRetentionOverrides(overrides)
  const undecided = effective.filter((r) => r.status === 'needs_decision').length

  return (
    <AppShell>
      <PageHead
        title="Retenční lhůty"
        description="Jak dlouho se která kategorie dat drží a co se s ní pak stane. Platí pro celou platformu."
      >
        {notice && <p className="text-sm text-success">{notice}</p>}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </PageHead>

      {loaded && undecided > 0 && (
        <section className="sp__card sp__card--pad border-l-2 border-l-accent">
          <p className="text-sm text-text-primary">
            {undecided} z {effective.length} kategorií nemá rozhodnutou lhůtu.
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            U těch se nemaže nic — systém v pochybnostech drží. Prázdné pole „měsíců" znamená
            přesně tohle: ještě není rozhodnuto.
          </p>
        </section>
      )}

      <section className="sp__card sp__card--pad">
        <div className="flex flex-col">
          {RETENTION_RULES.map((rule) => {
            const draft = drafts[rule.key]
            if (!draft) return null
            const decided = overrides[rule.key]
            return (
              <article key={rule.key} className="border-b border-border-subtle py-4 last:border-0">
                <p className="text-sm text-text-primary">{rule.label}</p>
                <p className="mt-0.5 text-sm text-text-tertiary">{rule.what}</p>
                <p className="mt-0.5 text-xs text-text-faint">
                  {rule.path} · počítá se {RETENTION_ANCHOR_LABELS[rule.anchor]}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[8rem_14rem_1fr]">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-tertiary">Měsíců</span>
                    <Input
                      value={draft.keepMonths}
                      onChange={(e) => update(rule.key, { keepMonths: e.target.value })}
                      placeholder="nerozhodnuto"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-tertiary">Pak</span>
                    <Select
                      value={draft.action}
                      onChange={(e) => update(rule.key, { action: e.target.value as RetentionAction })}
                    >
                      {(Object.keys(ACTION_LABELS) as RetentionAction[]).map((a) => (
                        <option key={a} value={a}>
                          {ACTION_LABELS[a]}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-tertiary">Čím je to podložené</span>
                    <Input
                      value={draft.note}
                      onChange={(e) => update(rule.key, { note: e.target.value })}
                      placeholder={rule.basis.slice(0, 60) + '…'}
                    />
                  </label>
                </div>

                {decided && (
                  <p className="mt-2 text-xs text-text-faint">
                    Naposledy rozhodnuto {decided.decidedAt.slice(0, 10)}.
                  </p>
                )}
              </article>
            )
          })}
        </div>

        <Button className="mt-4" onClick={handleSave} disabled={saving || !loaded}>
          {saving ? 'Ukládám…' : 'Uložit lhůty'}
        </Button>
        <p className="mt-2 text-xs text-text-faint">
          Tahle stránka nic nemaže. Úklid podle lhůt spouští každá organizace u sebe
          v Nastavení → Doba uchování, na dva kroky.
        </p>
      </section>
    </AppShell>
  )
}
