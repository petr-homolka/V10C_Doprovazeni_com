import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Mic, Send, Sparkles, Square } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { MicWaveform } from '@/components/ui/mic-waveform'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useMicLevels } from '@/hooks/useMicLevels'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { listFamiliesWithDocIds } from '@/services/familyService'
import { createNoteTimelineEntry } from '@/services/timelineService'
import { summarizeVoiceEntry } from '@/lib/ai'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import { cn } from '@/lib/utils'
import type { FamilyDoc } from '@/types/family'

/**
 * Rychlé zachycení hlasového zápisu z terénu (M11, mobil/PWA) — jádro
 * celé mobilní appky. Petrem přepracováno 2026-07-24 podle inspirace
 * diktovací lištou přímo v Claude Code: JEDNO kompaktní pole, které
 * zvládá psaní i diktování zároveň — malé kruhové tlačítko mikrofonu +
 * živý waveform (`useMicLevels`/`MicWaveform`), žádný samostatný
 * "nahrávám" krok na celou obrazovku a žádný oddělený "napsat místo
 * nahrávání" únik (ten teď nahrazuje samotný fakt, že textarea je vidět
 * a editovatelná OD ZAČÁTKU, mikrofon je jen doplněk, ne povinná brána).
 */
export function VoiceCaptureSheet({
  organizationId,
  createdByUid,
  initialFamilyDocId,
  onClose,
  onSaved,
}: {
  organizationId: string
  createdByUid: string
  /** Otevřeno ze zkratky na profilu rodiny (`MobileFamilyDetailPage`) —
   * rodina je předem daná, krok výběru se přeskočí. */
  initialFamilyDocId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const recognizer = useSpeechRecognition()
  const [recording, setRecording] = useState(false)
  const micLevels = useMicLevels(recording)
  const [body, setBody] = useState('')
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }>>([])
  const [familyDocId, setFamilyDocId] = useState(initialFamilyDocId ?? '')
  const [error, setError] = useState<string | null>(null)
  const { loading: summarizing, run: runSummary } = useAsyncSubmit()
  const { loading: saving, success: saved, run: runSave } = useAsyncSubmit()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    listFamiliesWithDocIds(organizationId)
      .then(setFamilies)
      .catch(() => setError('Rodiny se nepodařilo načíst.'))
    textareaRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Živý přepis proudí přímo do textového pole, dokud se nahrává —
  // uživatel může kdykoli mikrofon vypnout a dopsat/opravit ručně.
  useEffect(() => {
    if (recording) setBody(recognizer.transcript)
  }, [recognizer.transcript, recording])

  const familyOptions: ComboboxOption[] = useMemo(
    () =>
      families
        .map(({ docId, family }) => ({
          value: docId,
          label: resolveFamilyDisplayName(family, null) || family.address || docId,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'cs')),
    [families],
  )

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

  async function handleAiSummary() {
    if (!body.trim()) return
    setError(null)
    try {
      await runSummary(async () => {
        const summary = await summarizeVoiceEntry(body)
        setBody(summary)
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('AI souhrn selhal:', e)
      setError('AI souhrn se nepodařilo vytvořit — text zůstává beze změny.')
    }
  }

  async function handleSend() {
    if (!body.trim() || !familyDocId) return
    if (recording) toggleRecording()
    setError(null)
    try {
      await runSave(async () => {
        await createNoteTimelineEntry({
          familyDocId,
          organizationId,
          createdByUid,
          subjectRefs: [{ kind: 'family', id: familyDocId }],
          sharingLevel: 'internal',
          body: body.trim(),
        })
      })
      setTimeout(() => {
        onSaved()
        onClose()
      }, 600)
    } catch {
      setError('Odeslání se nezdařilo — možná tahle rodina nemá s vaší organizací aktivní Dohodu.')
    }
  }

  return (
    <BottomSheet onClose={onClose} className="min-h-[70vh]">
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 pb-6 pt-4">
        <h2 className="shrink-0 text-[17px] font-semibold text-text-primary">Zápis</h2>

        {/* Kompaktní řádek: kruhové tlačítko mikrofonu + živý waveform
         * (nahráváno) / nápověda (klid) — nahrazuje dřívější "nahrávám"
         * obrazovku na celou výšku. */}
        <div className="flex h-11 shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleRecording}
            disabled={!recognizer.isSupported}
            aria-label={recording ? 'Zastavit nahrávání' : 'Nahrát hlasem'}
            title={recognizer.isSupported ? undefined : 'Rozpoznávání řeči tenhle prohlížeč nepodporuje'}
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-40',
              recording ? 'bg-danger-solid text-white' : 'bg-primary-soft text-primary',
            )}
          >
            {recording ? <Square size={16} strokeWidth={2} /> : <Mic size={20} strokeWidth={2} />}
          </button>
          {recording ? (
            <MicWaveform levels={micLevels} className="h-7 flex-1" />
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm text-text-tertiary">
              {recognizer.isSupported
                ? 'Napište zápis, nebo ťukněte na mikrofon a nadiktujte ho'
                : 'Rozpoznávání řeči tenhle prohlížeč nepodporuje — napište zápis ručně'}
            </span>
          )}
        </div>
        {recognizer.error && <p className="shrink-0 text-sm text-danger">{recognizer.error}</p>}

        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          placeholder="Text zápisu…"
          className="min-h-[120px] w-full flex-1 resize-none rounded-lg border border-transparent bg-field px-4 py-3 text-base leading-relaxed text-text-primary placeholder:text-text-tertiary transition-shadow duration-150 focus:border-accent focus:shadow-focus focus:outline-none"
        />
        <Button
          variant="secondary"
          size="default"
          onClick={handleAiSummary}
          loading={summarizing}
          disabled={!body.trim()}
          className="h-12 shrink-0 gap-2"
        >
          <Sparkles size={18} strokeWidth={1.75} />
          {summarizing ? 'Vytvářím souhrn…' : 'AI souhrn'}
        </Button>

        <label className="flex shrink-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-text-primary">Zařadit k rodině</span>
          <Combobox
            options={familyOptions}
            value={familyDocId}
            onChange={setFamilyDocId}
            placeholder="Vybrat rodinu…"
          />
        </label>

        {error && (
          <p className="shrink-0 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <Button
          onClick={handleSend}
          loading={saving}
          success={saved}
          disabled={!body.trim() || !familyDocId}
          className="h-14 shrink-0 gap-2 text-base"
        >
          {saved ? <Check size={20} /> : <Send size={18} strokeWidth={2} />}
          Odeslat do osy
        </Button>
      </div>
    </BottomSheet>
  )
}
