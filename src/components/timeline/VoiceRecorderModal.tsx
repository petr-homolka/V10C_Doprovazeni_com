import { useEffect, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { createVoiceTimelineEntry } from '@/services/timelineService'
import { DEFAULT_SHARING_LEVEL, SHARING_LEVEL_LABELS, type SharingLevel } from '@/types/sharing'
import type { SubjectRef } from '@/types/timelineEntry'

export interface AvailableSubject extends SubjectRef {
  label: string
}

function subjectKey(ref: SubjectRef): string {
  return `${ref.kind}:${ref.id}`
}

/**
 * Avatar+mikrofon rychlý hlasový zápis (vyžádáno uživatelem, M3 §7 základ).
 * Otevře se VŽDY už nahrávající (§7.1 "ihned začne nahrávání") — na rozdíl
 * od plného hlasového zápisníku (budoucí M3 timeline detail) tady stav
 * `idle` neexistuje, protože se do modalu vstupuje až KLIKEM na mikrofon.
 *
 * "AI přepis" (§7.1 generating/done větev) je viditelné, ale VYPNUTÉ —
 * žádný AI backend v tomhle buildu (M10 SEAM, poctivost nadevše). Jen
 * "Uložit doslovný zápis" cesta je skutečně funkční, přesně jak M3 doc
 * komentář v timelineEntry.ts popisuje.
 */
export function VoiceRecorderModal({
  familyDocId,
  organizationId,
  createdByUid,
  availableSubjects,
  preselectedKeys,
  onClose,
  onSaved,
}: {
  familyDocId: string
  organizationId: string
  createdByUid: string
  availableSubjects: AvailableSubject[]
  preselectedKeys: string[]
  onClose: () => void
  onSaved?: () => void
}) {
  const recognizer = useSpeechRecognition()
  const [stopped, setStopped] = useState(false)
  const [body, setBody] = useState('')
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => new Set(preselectedKeys))
  const [sharingLevel, setSharingLevel] = useState<SharingLevel>(DEFAULT_SHARING_LEVEL)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (recognizer.isSupported) {
      recognizer.start()
    } else {
      setStopped(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleStop() {
    recognizer.stop()
    setBody(recognizer.transcript)
    setStopped(true)
  }

  function toggleSubject(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSaveVerbatim() {
    if (!body.trim()) {
      setError('Zápis je prázdný.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const subjectRefs: SubjectRef[] = availableSubjects
        .filter((s) => checkedKeys.has(subjectKey(s)))
        .map(({ kind, id }) => ({ kind, id }))
      await createVoiceTimelineEntry({
        familyDocId,
        organizationId,
        createdByUid,
        subjectRefs,
        sharingLevel,
        body: body.trim(),
      })
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
    <Modal onClose={onClose}>
      <h2 className="text-lg font-normal leading-normal text-text-primary">Hlasový zápis</h2>

      <div className="mt-4">
        <p className="text-xs font-medium leading-none text-text-secondary">Týká se</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {availableSubjects.map((subject) => {
            const key = subjectKey(subject)
            const checked = checkedKeys.has(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSubject(key)}
                className={
                  checked
                    ? 'inline-flex h-7 items-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground'
                    : 'inline-flex h-7 items-center rounded-full border border-border-strong px-3 text-xs font-medium text-text-secondary hover:bg-overlay-active'
                }
              >
                {subject.label}
              </button>
            )
          })}
        </div>
      </div>

      {!stopped ? (
        <div className="mt-6 flex flex-col items-center gap-4 py-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-danger-solid text-white">
            <Mic size={28} strokeWidth={2} className="animate-pulse" />
          </div>
          <p className="min-h-[4.5rem] text-center text-sm text-text-secondary">
            {recognizer.transcript || 'Nahrávám… mluvte.'}
          </p>
          {recognizer.error && <p className="text-sm text-danger">{recognizer.error}</p>}
          <Button variant="destructive" onClick={handleStop} className="gap-2">
            <Square size={14} strokeWidth={2} />
            Zastavit
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {!recognizer.isSupported && (
            <p className="text-xs text-text-tertiary">
              Rozpoznávání řeči není v tomhle prohlížeči podporované — zápis napište ručně.
            </p>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Zápis</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full rounded-sm border border-border-medium bg-inset px-3 py-2 text-[16px] text-text-primary focus:border-2 focus:border-accent focus:outline-none"
            />
          </label>

          <div>
            <p className="text-sm font-medium leading-relaxed text-text-primary">Kdo uvidí</p>
            <div className="mt-1.5">
              <SegmentedTabs
                value={sharingLevel}
                onChange={setSharingLevel}
                options={Object.entries(SHARING_LEVEL_LABELS).map(([value, label]) => ({
                  value: value as SharingLevel,
                  label,
                }))}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSaveVerbatim} disabled={saving}>
              {saving ? 'Ukládám…' : 'Uložit doslovný zápis'}
            </Button>
            <Button variant="secondary" disabled title="AI přepis zatím čeká na napojení (M10)">
              AI přepis
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Zrušit
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
