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
  const [step, setStep] = useState<CaptureStep>('recording')
  const [body, setBody] = useState('')
  const [families, setFamilies] = useState<Array<{ docId: string; family: FamilyDoc }>>([])
  const [familyDocId, setFamilyDocId] = useState(initialFamilyDocId ?? '')
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

  /** Petrem výslovně vyžádáno (2026-07-23 živý test): nahrávání se dřív
   * spouštělo VŽDY automaticky bez možnosti přeskočit rovnou na psaní —
   * "když píše, může se vracet, smazat, přepsat, může to prostě cokoliv",
   * na rozdíl od mluvení. Přeskočí na `review` s PRÁZDNÝM textem (ne s
   * dosavadním přepisem — jde o vědomou volbu psát místo diktování, ne o
   * zkrácení nahrávky). */
  function handleWriteInstead() {
    recognizer.stop()
    setBody('')
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
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('AI souhrn selhal:', e)
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
          <div className="flex min-h-0 flex-1 flex-col items-center gap-6 py-6">
            <div className="relative flex size-28 shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-danger-solid animate-mic-ring" />
              <span className="absolute inset-0 rounded-full bg-danger-solid/40 animate-mic-ring [animation-delay:0.7s]" />
              <span className="relative flex size-28 items-center justify-center rounded-full bg-danger-solid text-white shadow-overlay animate-mic-breathe">
                <Mic size={44} strokeWidth={2} />
              </span>
            </div>
            {/* Dlouhý přepis roste za běhu nahrávání — vlastní scrollovatelná
             * oblast (ne celá obrazovka), ať "Zastavit" zůstane VŽDY na
             * dohled/klikatelné (živě nahlášeno Petrem 2026-07-22).
             * Zarovnání POUZE doleva, celá šířka (2026-07-23 zpět
             * opraveno — dřív zarovnaná bublina napravo + `text-justify`
             * živě Petrem popsáno jako "nesouměrné, víc místa na jedny
             * straně" — navíc se ta asymetrie nesla i vizuálně nepříjemně
             * do dalšího kroku "Zkontrolovat a odeslat", kde textarea žádné
             * takové zarovnání nemá — sjednoceno na stejný plný, doleva
             * zarovnaný blok v obou krocích). */}
            <div className="w-full min-h-0 flex-1 overflow-y-auto">
              <p className="text-left text-base leading-relaxed text-text-primary">
                {recognizer.transcript || 'Nahrávám… mluvte.'}
              </p>
            </div>
            {!recognizer.isSupported && (
              <p className="max-w-[280px] shrink-0 text-center text-sm text-text-tertiary">
                Rozpoznávání řeči tenhle prohlížeč nepodporuje — text napíšete ručně na další obrazovce.
              </p>
            )}
            {recognizer.error && <p className="shrink-0 text-sm text-danger">{recognizer.error}</p>}
            <div className="flex w-full max-w-[280px] shrink-0 flex-col gap-2">
              <Button
                variant="destructive"
                size="default"
                onClick={handleStop}
                className="h-14 w-full gap-2 text-base"
              >
                <Square size={18} strokeWidth={2} />
                Zastavit
              </Button>
              <button
                type="button"
                onClick={handleWriteInstead}
                className="text-sm font-medium text-text-secondary underline-offset-2 hover:underline"
              >
                Napsat text místo nahrávání
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <h2 className="shrink-0 text-[17px] font-semibold text-text-primary">Zkontrolovat a odeslat</h2>
            {/* min-h-* místo jen `flex-1` — bez spodní meze by textarea u
             * dlouhého textu roztáhla celý sheet a tlačítko "Odeslat do osy"
             * bylo pod hranicí viditelné oblasti (stejná chyba jako u živého
             * přepisu výš, živě nahlášeno Petrem 2026-07-22). Uvnitř
             * textarea funguje nativní scroll prohlížeče. */}
            <textarea
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
        )}
      </div>
    </BottomSheet>
  )
}
