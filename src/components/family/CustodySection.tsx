import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import {
  attachCourtDecision,
  createCourtDecision,
  createCustodyAssignment,
  getCourtDecision,
  listAssignmentsForChild,
} from '@/services/custodyService'
import {
  COURT_DECISION_KIND_LABELS,
  CUSTODY_FORM_LABELS,
  type CourtDecisionDoc,
  type CourtDecisionKind,
  type CustodyAssignmentDoc,
  type CustodyForm,
} from '@/types/custody'
import { isEffective } from '@/lib/custody'
import type { FosterPersonDoc } from '@/types/fosterPerson'

/**
 * SVĚŘENÍ DO PÉČE — právní rovina na profilu dítěte.
 *
 * Sem patří, protože svěření je vždycky O JEDNOM DÍTĚTI. Rozsudek může
 * svěřit sourozence každého zvlášť a rodina není jednotka — kdyby tahle
 * sekce visela na rodině, model by se tím zas smrskl na domácnost.
 *
 * Rozhodnutí soudu se zakládá ROVNOU TADY, ne na vlastní obrazovce.
 * Pracovník má v ruce rozsudek a zapisuje z něj svěření; nutit ho nejdřív
 * někam jinam založit rozsudek a pak se vrátit by znamenalo, že to
 * neudělá ani jedno.
 */
interface Props {
  childId: string
  organizationId: string
  userUid: string
  /** Pěstouni domácnosti — z nich se vybírá, komu je dítě svěřeno. */
  fosterPersons: Array<{ docId: string; fosterPerson: FosterPersonDoc }>
}

export function CustodySection({ childId, organizationId, userUid, fosterPersons }: Props) {
  const [assignments, setAssignments] = useState<CustodyAssignmentDoc[] | null>(null)
  const [decisions, setDecisions] = useState<Record<string, CourtDecisionDoc>>({})
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [selectedFosters, setSelectedFosters] = useState<string[]>([])
  const [form, setForm] = useState<CustodyForm>('spolecna')
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10))

  /** Id svěření, ke kterému se právě dopisuje rozsudek. `null` = žádné. */
  const [attachTo, setAttachTo] = useState<string | null>(null)

  // Pole rozsudku jsou SPOLEČNÁ pro zakládání i pro dodatečné doplnění —
  // je to tentýž formulář, jen jednou putuje do nového svěření a podruhé
  // do existujícího. Dvě kopie by se rozešly.
  const [fileNumber, setFileNumber] = useState('')
  const [courtName, setCourtName] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [kind, setKind] = useState<CourtDecisionKind>('sverenido_pp')
  const decisionFilled = !!fileNumber.trim() && !!courtName.trim() && !!effectiveFrom

  async function reload() {
    try {
      const list = await listAssignmentsForChild(childId, organizationId)
      setAssignments(list)
      const ids = [...new Set(list.map((a) => a.courtDecisionId).filter((id): id is string => !!id))]
      const loaded = await Promise.all(ids.map(async (id) => [id, await getCourtDecision(id)] as const))
      setDecisions(Object.fromEntries(loaded.filter(([, d]) => d) as Array<[string, CourtDecisionDoc]>))
    } catch {
      // Prázdný seznam, ne věčné „Načítám…" — viz stejná chyba u auditu.
      setAssignments([])
      setError('Svěření se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, organizationId])

  function toggleFoster(id: string) {
    setSelectedFosters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }

  function resetDecisionFields() {
    setFileNumber('')
    setCourtName('')
    setEffectiveFrom('')
    setKind('sverenido_pp')
  }

  /** Rozsudek do vlastní kolekce; vrací jeho id nebo `null`, není-li vyplněný. */
  async function saveDecisionIfFilled(): Promise<string | null> {
    if (!decisionFilled) return null
    return await createCourtDecision({
      fileNumber,
      courtName,
      effectiveFrom: new Date(effectiveFrom).toISOString(),
      kind,
      organizationId,
      createdByUid: userUid,
    })
  }

  /**
   * Doplnění rozsudku k existujícímu svěření. Tohle je cesta, kterou projde
   * všech 410 svěření převedených ze spisů — u nich se ví, kdo o koho pečuje,
   * ale spisová značka v systému nikdy nebyla.
   */
  async function handleAttach(assignmentId: string) {
    setError(null)
    setSaving(true)
    try {
      const courtDecisionId = await saveDecisionIfFilled()
      if (!courtDecisionId) throw new Error('Vyplňte spisovou značku, soud i datum právní moci.')
      await attachCourtDecision({
        assignmentId,
        courtDecisionId,
        validFrom: new Date(effectiveFrom).toISOString(),
      })
      setAttachTo(null)
      resetDecisionFields()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rozhodnutí soudu se nepodařilo doplnit.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate() {
    setError(null)
    setSaving(true)
    try {
      // Rozsudek je VOLITELNÝ. Pracovník ho nemusí mít po ruce a svěření
      // bez čísla jednacího je pořád lepší než žádné — viz komentář
      // u `courtDecisionId` v types/custody.ts.
      const courtDecisionId = await saveDecisionIfFilled()

      await createCustodyAssignment({
        childId,
        fosterPersonIds: selectedFosters,
        form,
        validFrom: new Date(validFrom).toISOString(),
        courtDecisionId,
        organizationId,
      })

      setShowForm(false)
      setSelectedFosters([])
      resetDecisionFields()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Svěření se nepodařilo založit.')
    } finally {
      setSaving(false)
    }
  }

  const fosterName = (id: string) => {
    const f = fosterPersons.find((p) => p.docId === id)
    return f ? `${f.fosterPerson.firstName} ${f.fosterPerson.lastName}` : id
  }

  /**
   * Pole rozsudku. Schválně JEDEN prvek použitý na dvou místech, ne
   * vnořená komponenta — vnořená by se při každém překreslení vytvořila
   * znovu, React by ji odmountoval a políčku by při psaní utíkal kurzor.
   */
  const decisionFields = (
    <div className="sp__group">
      <span className="sp__grouplabel">Rozhodnutí soudu</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          placeholder="Spisová značka (12 P 45/2023)"
          value={fileNumber}
          onChange={(e) => setFileNumber(e.target.value)}
        />
        <Input placeholder="Soud" value={courtName} onChange={(e) => setCourtName(e.target.value)} />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-tertiary">Datum právní moci</span>
          <DatePicker value={effectiveFrom} onChange={setEffectiveFrom} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-tertiary">Druh rozhodnutí</span>
          <Select value={kind} onChange={(e) => setKind(e.target.value as CourtDecisionKind)}>
            {(Object.keys(COURT_DECISION_KIND_LABELS) as CourtDecisionKind[]).map((k) => (
              <option key={k} value={k}>
                {COURT_DECISION_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </label>
      </div>
    </div>
  )

  return (
    <div className="max-w-[720px]">
      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {assignments === null ? (
        <p className="text-sm text-text-secondary">Načítám…</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-text-secondary">
          U tohohle dítěte zatím není zapsané žádné svěření do péče.
        </p>
      ) : (
        <div className="flex flex-col">
          {assignments.map((a) => {
            const decision = a.courtDecisionId ? decisions[a.courtDecisionId] : null
            const active = isEffective(a)
            return (
              <article key={a.id} className="border-b border-border-subtle py-3 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm text-text-primary">
                    {CUSTODY_FORM_LABELS[a.form]} — {a.fosterPersonIds.map(fosterName).join(' a ')}
                  </p>
                  <p className={active ? 'text-sm text-success' : 'text-sm text-text-tertiary'}>
                    {active ? 'Platné' : 'Ukončené'}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-text-tertiary">
                  Od {a.validFrom.slice(0, 10)}
                  {a.validTo ? ` do ${a.validTo.slice(0, 10)}` : ''}
                  {/* Odhad se musí přiznat. Datum svěření se u převedených
                      spisů odvodilo ze začátku Dohody — je to nejzazší možný
                      začátek, ne skutečný, a bez téhle značky by ho po pár
                      měsících nikdo nerozeznal od údaje z rozsudku. */}
                  {a.validFromIsEstimate && <span className="text-accent"> · odhad</span>}
                </p>
                {decision ? (
                  <p className="mt-0.5 text-xs text-text-faint">
                    {COURT_DECISION_KIND_LABELS[decision.kind]} · {decision.fileNumber} ·{' '}
                    {decision.courtName} · právní moc {decision.effectiveFrom.slice(0, 10)}
                  </p>
                ) : attachTo === a.id ? (
                  <div className="sp__sub mt-2">
                    {decisionFields}
                    <div className="mt-3 flex gap-3">
                      <Button size="sm" onClick={() => handleAttach(a.id)} disabled={saving || !decisionFilled}>
                        {saving ? 'Ukládám…' : 'Doplnit rozhodnutí'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAttachTo(null)}>
                        Zrušit
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-2 text-xs text-accent">
                    Rozhodnutí soudu není doplněné — svěření známe, spisovou značku ne.
                    <button
                      type="button"
                      className="text-text-secondary underline hover:text-text-primary"
                      onClick={() => {
                        resetDecisionFields()
                        setAttachTo(a.id)
                      }}
                    >
                      Doplnit
                    </button>
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}

      {!showForm ? (
        <Button className="mt-4" variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          Zapsat svěření
        </Button>
      ) : (
        <div className="sp__sub mt-4">
          <div className="sp__group">
            <span className="sp__grouplabel">Komu je dítě svěřeno</span>
            {fosterPersons.length === 0 ? (
              <p className="text-sm text-text-tertiary">V domácnosti není zapsaný žádný pěstoun.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {fosterPersons.map(({ docId, fosterPerson }) => (
                  <label key={docId} className="flex items-center gap-2 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={selectedFosters.includes(docId)}
                      onChange={() => toggleFoster(docId)}
                    />
                    {fosterPerson.firstName} {fosterPerson.lastName}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="sp__group">
            <label className="sp__grouplabel" htmlFor="forma-pece">
              Forma péče
            </label>
            <Select id="forma-pece" value={form} onChange={(e) => setForm(e.target.value as CustodyForm)}>
              {(Object.keys(CUSTODY_FORM_LABELS) as CustodyForm[]).map((f) => (
                <option key={f} value={f}>
                  {CUSTODY_FORM_LABELS[f]}
                </option>
              ))}
            </Select>
          </div>

          <div className="sp__group">
            <label className="flex flex-col gap-1">
              <span className="sp__grouplabel">Svěřeno od</span>
              <DatePicker value={validFrom} onChange={setValidFrom} />
            </label>
          </div>

          <p className="mt-3 text-xs text-text-faint">
            Rozsudek je volitelný. Nemáte-li ho po ruce, nechte pole prázdná — svěření se zapíše
            i tak a spisová značka se dá doplnit později. Vymýšlet ji nemá smysl.
          </p>
          {decisionFields}

          <div className="mt-3 flex gap-3">
            <Button size="sm" onClick={handleCreate} disabled={saving || selectedFosters.length === 0}>
              {saving ? 'Ukládám…' : 'Zapsat svěření'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Zrušit
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
