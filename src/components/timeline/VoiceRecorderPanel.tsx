import { useEffect, useRef, useState } from 'react'
import { Mic, Square, X } from '@/components/ui/icons'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { MicWaveform } from '@/components/ui/mic-waveform'
import { cn } from '@/lib/utils'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useMicLevels } from '@/hooks/useMicLevels'
import { createVisitTimelineEntry, createVoiceTimelineEntry } from '@/services/timelineService'
import { summarizeVoiceEntry } from '@/lib/ai'
import type { SharingLevel } from '@/types/sharing'
import type { SubjectRef } from '@/types/timelineEntry'

export interface RecordablePerson extends SubjectRef {
  label: string
}

/** §A3 bod 3: konec Giant Timeru vede PŘÍMO sem — stejný panel, jen jinak
 * uloží (`createVisitTimelineEntry` místo `createVoiceTimelineEntry`) a
 * zobrazí délku/GPS návštěvy jako kontext nad zápisem. */
export interface VisitContext {
  startedAt: string
  endedAt: string
  durationSeconds: number
  location: { lat: number; lng: number } | null
}

function subjectKey(ref: SubjectRef): string {
  return `${ref.kind}:${ref.id}`
}

function formatDuration(seconds: number): string {
  const min = Math.round(seconds / 60)
  if (min < 1) return '<1 min'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

/**
 * Avatar+mikrofon rychlý hlasový zápis — pravý vyjížděcí panel (§7.6 vzor,
 * ne modál — potřebuje plnou výšku pro víceminutový diktát).
 *
 * Přepracováno 2026-07-24 (Petrova inspirace diktovací lištou v Claude
 * Code): JEDNO kompaktní pole zvládá psaní i diktování zároveň — malé
 * kruhové tlačítko mikrofonu + živý waveform (`useMicLevels`/
 * `MicWaveform`) nad textarea, mikrofon je VYPNUTÝ při otevření (žádné
 * automatické spuštění nahrávání jako dřív) — textarea je hned viditelná
 * a editovatelná, mikrofon je jen doplněk k psaní, ne povinná brána.
 *
 * "Zařadit k" ukazuje jen OSOBY (pěstoun/dítě) stejné rodiny — rodina
 * samotná a Dohoda NEJSOU volitelné položky (nejsou to lidé, ke kterým by
 * dávalo smysl zápis "přiřazovat"), ale pořád se potichu zapíšou do
 * `subjectRefs` přes `implicitSubjects` (rodina vždy, Dohoda jen pokud se
 * nahrávání spustilo z jejího avataru) — beze změny zadání §7.3, jen jiné
 * zobrazení.
 *
 * "AI souhrn" (M10 SEAM uzavřený) — `lib/ai.ts` `summarizeVoiceEntry`,
 * Firebase AI Logic/Gemini. Nahradí `body` učesanou verzí, surový přepis
 * PŘED úpravou se uloží do `originalTranscript` (§7.5, nikdy nemazané).
 */
export function VoiceRecorderPanel({
  familyDocId,
  organizationId,
  createdByUid,
  implicitSubjects,
  people,
  preselectedPeopleKeys,
  partnerSharingDefault = true,
  visit,
  onClose,
  onSaved,
}: {
  familyDocId: string
  organizationId: string
  createdByUid: string
  implicitSubjects: SubjectRef[]
  people: RecordablePerson[]
  preselectedPeopleKeys: string[]
  /** DOPLNENI_ZADANI-DO-M5 §2 — `family.partnerSharingDefault`, výchozí
   * hodnota přepínače "Sdílet s oběma pěstouny" pro tuhle rodinu. */
  partnerSharingDefault?: boolean
  visit?: VisitContext
  onClose: () => void
  onSaved?: () => void
}) {
  const recognizer = useSpeechRecognition()
  const [recording, setRecording] = useState(false)
  const micLevels = useMicLevels(recording)
  const fosterPeople = people.filter((p) => p.kind === 'fosterPerson')
  const [body, setBody] = useState('')
  const [originalTranscript, setOriginalTranscript] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => new Set(preselectedPeopleKeys))
  const [isPrivate, setIsPrivate] = useState(false)
  /** DOPLNENI_ZADANI-DO-M5 §2 — SEAM uzavřený touhle dávkou: `sharingLevel:
   * 'foster'` se dřív nikdy nenastavoval (M3 zjednodušení nechalo jen
   * private/internal binárku), takže "Sdílené zápisy" na `/moje` byly
   * VŽDY prázdné bez ohledu na cokoli jiného. Tenhle přepínač je proto
   * NUTNÁ podmínka pro to, aby "Sdílet s oběma pěstouny" níž mělo vůbec
   * nějaký efekt — zjištěno a rozšířeno vědomě, viz CURRENT_STATE.md. */
  const [shareWithFoster, setShareWithFoster] = useState(false)
  const [shareBothPartners, setShareBothPartners] = useState(partnerSharingDefault)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Živý přepis proudí přímo do textového pole, dokud se nahrává.
  useEffect(() => {
    if (recording) setBody(recognizer.transcript)
  }, [recognizer.transcript, recording])

  function toggleRecording() {
    if (recording) {
      recognizer.stop()
      setRecording(false)
      return
    }
    if (!recognizer.isSupported) return
    recognizer.reset()
    setRecording(true)
    recognizer.start()
  }

  function togglePerson(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const showPartnerToggle = fosterPeople.length >= 2
  const usePartnerScoped = showPartnerToggle && !shareBothPartners

  /** M10 — nahradí `body` učesanou AI verzí, surový přepis se uchová v
   * `originalTranscript` (§7.5, nikdy nemazané, i když se v hlavním
   * zobrazení nepoužívá). Druhé kliknutí (po další ruční úpravě) znovu
   * učeše AKTUÁLNÍ text, `originalTranscript` ale zůstává PRVNÍ surová
   * verze, ne mezistav. */
  async function handleAiSummary() {
    if (!body.trim() || summarizing) return
    setSummarizing(true)
    setError(null)
    try {
      const rawBefore = body
      const summary = await summarizeVoiceEntry(body)
      setOriginalTranscript((prev) => prev ?? rawBefore)
      setBody(summary)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('AI souhrn selhal:', e)
      setError('AI souhrn se nepodařilo vytvořit — zkuste to znovu nebo pokračujte s textem ručně.')
    } finally {
      setSummarizing(false)
    }
  }

  async function handleSave() {
    if (!body.trim()) {
      setError('Zápis je prázdný.')
      return
    }
    if (usePartnerScoped && !fosterPeople.some((p) => checkedKeys.has(subjectKey(p)))) {
      setError('Vyberte v „Zařadit k", kterého pěstouna se zápis týká.')
      return
    }
    if (recording) toggleRecording()
    setSaving(true)
    setError(null)
    try {
      const personRefs: SubjectRef[] = people
        .filter((p) => checkedKeys.has(subjectKey(p)))
        .map(({ kind, id }) => ({ kind, id }))
      const sharingLevel: SharingLevel = isPrivate ? 'private' : shareWithFoster ? 'foster' : 'internal'
      // §2: "Sdílet s oběma pěstouny" VYPNUTO → family-level implicitní
      // subjekt se NAHRAZUJE (ne doplňuje) konkrétně vybraným pěstounem —
      // ten už je v `personRefs` díky zaškrtnuté chipě výš.
      const subjectRefs = usePartnerScoped
        ? [...implicitSubjects.filter((r) => r.kind !== 'family'), ...personRefs]
        : [...implicitSubjects, ...personRefs]

      if (visit) {
        // Lhůta osobního kontaktu (§2) je NEZÁVISLÁ na sharingLevel — návštěva
        // proběhla, ať se zápis sdílí s pěstounem nebo ne. Komu se stamp
        // týká, plyne ze STEJNÉ partner-scoping logiky jako subjectRefs.
        const stampFosterPersonIds = usePartnerScoped
          ? personRefs.filter((r) => r.kind === 'fosterPerson').map((r) => r.id)
          : fosterPeople.map((p) => p.id)
        await createVisitTimelineEntry({
          familyDocId,
          organizationId,
          createdByUid,
          subjectRefs,
          sharingLevel,
          body: body.trim(),
          startedAt: visit.startedAt,
          endedAt: visit.endedAt,
          durationSeconds: visit.durationSeconds,
          location: visit.location,
          originalTranscript,
          stampFosterPersonIds,
        })
      } else {
        await createVoiceTimelineEntry({
          familyDocId,
          organizationId,
          createdByUid,
          subjectRefs,
          sharingLevel,
          body: body.trim(),
          originalTranscript,
        })
      }
      onSaved?.()
      onClose()
    } catch {
      setError(
        'Zápis se nepodařilo uložit — možná tahle rodina nemá s vaší organizací aktivní Dohodu.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer onClose={onClose}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold leading-snug text-text-primary">
            {visit ? 'Zápis z návštěvy' : 'Zápis'}
          </h2>
          {visit && (
            <p className="mt-0.5 text-xs text-text-secondary">
              Délka {formatDuration(visit.durationSeconds)}
              {visit.location && ' · GPS zaznamenáno'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zavřít"
          className="flex size-8 items-center justify-center rounded-sm text-text-secondary transition-colors duration-150 hover:bg-overlay-active"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {people.length > 0 && (
          <div>
            <p className="text-xs font-medium leading-none text-text-secondary">Zařadit k</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {people.map((person) => {
                const key = subjectKey(person)
                const checked = checkedKeys.has(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePerson(key)}
                    className={
                      checked
                        ? 'inline-flex h-7 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground'
                        : 'inline-flex h-7 items-center rounded-full border border-border-strong px-3 text-xs font-medium text-text-secondary hover:bg-overlay-active'
                    }
                  >
                    {person.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Kompaktní řádek: kruhové tlačítko mikrofonu + živý waveform
         * (nahráváno) / nápověda (klid) — nahrazuje dřívější "nahrávám"
         * stav na celou výšku panelu. */}
        <div className="flex h-10 shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleRecording}
            disabled={!recognizer.isSupported}
            aria-label={recording ? 'Zastavit nahrávání' : 'Nahrát hlasem'}
            title={recognizer.isSupported ? undefined : 'Rozpoznávání řeči tenhle prohlížeč nepodporuje'}
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-40',
              recording ? 'bg-danger-solid text-white' : 'bg-primary-soft text-primary',
            )}
          >
            {recording ? <Square size={15} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
          </button>
          {recording ? (
            <MicWaveform levels={micLevels} className="h-6 flex-1" />
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm text-text-tertiary">
              {recognizer.isSupported
                ? 'Napište zápis, nebo klikněte na mikrofon a nadiktujte ho'
                : 'Rozpoznávání řeči tenhle prohlížeč nepodporuje — napište zápis ručně'}
            </span>
          )}
        </div>
        {recognizer.error && <p className="text-sm text-danger">{recognizer.error}</p>}

        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Text zápisu…"
          className={cn(
            'w-full flex-1 resize-none rounded-sm border border-transparent bg-field px-4 py-3',
            'text-lg leading-relaxed text-text-primary placeholder:text-text-tertiary',
            'transition-shadow duration-150 focus:border-accent focus:shadow-focus focus:outline-none',
          )}
        />

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-text-primary">Soukromá poznámka</span>
          <Switch checked={isPrivate} onChange={setIsPrivate} label="Soukromá poznámka" />
        </div>

        {!isPrivate && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-text-primary">Sdílet s pěstounem</span>
            <Switch checked={shareWithFoster} onChange={setShareWithFoster} label="Sdílet s pěstounem" />
          </div>
        )}

        {showPartnerToggle && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-text-primary">Sdílet s oběma pěstouny</span>
            <Switch
              checked={shareBothPartners}
              onChange={setShareBothPartners}
              label="Sdílet s oběma pěstouny"
            />
          </div>
        )}

        {usePartnerScoped && (
          <p className="text-xs text-text-tertiary">
            Vyberte výš v „Zařadit k", kterého pěstouna se zápis týká — druhý partner ho neuvidí.
          </p>
        )}

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border px-5 py-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Ukládám…' : 'Uložit text'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleAiSummary}
          disabled={saving || summarizing || !body.trim()}
          title="Vyčistí mluvenou řeč do stručného profesionálního textu (Gemini) — surový přepis zůstává uložený, nic se neztrácí."
        >
          {summarizing ? 'Vytvářím souhrn…' : 'AI souhrn'}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Zrušit
        </Button>
      </div>
    </Drawer>
  )
}
