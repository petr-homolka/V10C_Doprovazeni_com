import { useEffect, useMemo, useState } from 'react'
import { Check, Mic, Send, Sparkles, Square } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { listFamiliesWithDocIds } from '@/services/familyService'
import { createNoteTimelineEntry } from '@/services/timelineService'
import { summarizeVoiceEntry } from '@/lib/ai'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { FamilyDoc } from '@/types/family'

type CaptureStep = 'recording' | 'review'

/**
 * Rychlé zachycení hlasového zápisu z terénu (M11, mobil/PWA) — jádro
 * celé mobilní appky ("KO nezajímá seznam klientů, ale spíš nadiktovat
 * zprávu a poslat do osy"). Otevře se VŽDY už nahrávající (stejná
 * konvence jako `VoiceRecorderPanel.tsx` §7.1), "AI souhrn" znovupoužívá
 * STEJNOU `lib/ai.ts` funkci jako desktop — jen zjednodušený tok (žádné
 * partner-sharing přepínače, žádné "Zařadit k" osobám, jen rodina) — pole
 * pro terén, ne kompletní desktopový formulář.
 *
 * `sharingLevel: 'internal'` napevno — tým zápis uvidí vždy, sdílení s
 * pěstounem je rozhodnutí, které má smysl udělat s rozvahou na desktopu,
 * ne za jízdy mezi návštěvami.
 */
export function VoiceCaptureSheet({
  organizationId,
  createdByUid,
  onClose,
  onSaved,
}: {
  organizationId: string
  createdByUid: string
  onClose: () => void
  onSaved: () => void
}) {
  const recognizer = useSpeechRecognition()
  const [step, setStep] = useState<CaptureStep>('recording')
  const [body, setBody] = useState('')
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }>>([])
  const [familyDocId, setFamilyDocId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { loading: summarizing, run: runSummary } = useAsyncSubmit()
  const { loading: saving, success: saved, run: runSave } = useAsyncSubmit()

  useEffect(() => {
    if (recognizer.isSupported) recognizer.start()
    listFamiliesWithDocIds(organizationId)
      .then(setFamilies)
      .catch(() => setError('Rodiny se nepodařilo načíst.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  function handleStop() {
    recognizer.stop()
    setBody(recognizer.transcript)
    setStep('review')
  }

  async function handleAiSummary() {
    if (!body.trim()) return
    setError(null)
    try {
      await runSummary(async () => {
        const summary = await summarizeVoiceEntry(body)
        setBody(summary)
      })
    } catch {
      setError('AI souhrn se nepodařilo vytvořit — text zůstává beze změny.')
    }
  }

  async function handleSend() {
    if (!body.trim() || !familyDocId) return
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
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 pt-4">
        {step === 'recording' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
            <div className="relative flex size-28 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-danger-solid animate-mic-ring" />
              <span className="absolute inset-0 rounded-full bg-danger-solid/40 animate-mic-ring [animation-delay:0.7s]" />
              <span className="relative flex size-28 items-center justify-center rounded-full bg-danger-solid text-white shadow-overlay animate-mic-breathe">
                <Mic size={44} strokeWidth={2} />
              </span>
            </div>
            <p className="max-w-[280px] text-center text-base leading-relaxed text-text-primary">
              {recognizer.transcript || 'Nahrávám… mluvte.'}
            </p>
            {!recognizer.isSupported && (
              <p className="max-w-[280px] text-center text-sm text-text-tertiary">
                Rozpoznávání řeči tenhle prohlížeč nepodporuje — text napíšete ručně na další obrazovce.
              </p>
            )}
            {recognizer.error && <p className="text-sm text-danger">{recognizer.error}</p>}
            <Button
              variant="destructive"
              size="default"
              onClick={handleStop}
              className="h-14 w-full max-w-[280px] gap-2 text-base"
            >
              <Square size={18} strokeWidth={2} />
              Zastavit
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
            <h2 className="text-lg font-normal text-text-primary">Zkontrolovat a odeslat</h2>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={7}
              placeholder="Text zápisu…"
              className="w-full flex-1 resize-none rounded-lg border border-border-medium bg-inset px-4 py-3 text-base leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-2 focus:border-accent focus:outline-none"
            />
            <Button
              variant="secondary"
              size="default"
              onClick={handleAiSummary}
              loading={summarizing}
              disabled={!body.trim()}
              className="h-12 gap-2"
            >
              <Sparkles size={18} strokeWidth={1.75} />
              {summarizing ? 'Vytvářím souhrn…' : 'AI souhrn'}
            </Button>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-primary">Zařadit k rodině</span>
              <Combobox
                options={familyOptions}
                value={familyDocId}
                onChange={setFamilyDocId}
                placeholder="Vybrat rodinu…"
              />
            </label>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <Button
              onClick={handleSend}
              loading={saving}
              success={saved}
              disabled={!body.trim() || !familyDocId}
              className="h-14 gap-2 text-base"
            >
              {saved ? <Check size={20} /> : <Send size={18} strokeWidth={2} />}
              Odeslat do osy
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
