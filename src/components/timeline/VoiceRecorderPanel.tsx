import { useEffect, useState } from 'react'
import { Mic, Square, X } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { createVoiceTimelineEntry } from '@/services/timelineService'
import type { SharingLevel } from '@/types/sharing'
import type { SubjectRef } from '@/types/timelineEntry'

export interface RecordablePerson extends SubjectRef {
  label: string
}

function subjectKey(ref: SubjectRef): string {
  return `${ref.kind}:${ref.id}`
}

/**
 * Avatar+mikrofon rychlý hlasový zápis — pravý vyjížděcí panel (§7.6 vzor,
 * ne modál — potřebuje plnou výšku pro víceminutový diktát). Otevře se
 * VŽDY už nahrávající (§7.1 "ihned začne nahrávání").
 *
 * "Zařadit k" ukazuje jen OSOBY (pěstoun/dítě) stejné rodiny — rodina
 * samotná a Dohoda NEJSOU volitelné položky (nejsou to lidé, ke kterým by
 * dávalo smysl zápis "přiřazovat"), ale pořád se potichu zapíšou do
 * `subjectRefs` přes `implicitSubjects` (rodina vždy, Dohoda jen pokud se
 * nahrávání spustilo z jejího avataru) — beze změny zadání §7.3, jen jiné
 * zobrazení.
 *
 * "AI souhrn" je viditelné, ale VYPNUTÉ — žádný AI backend v tomhle
 * buildu (M10 SEAM). Jen "Uložit text" je skutečně funkční.
 */
export function VoiceRecorderPanel({
  familyDocId,
  organizationId,
  createdByUid,
  implicitSubjects,
  people,
  preselectedPeopleKeys,
  onClose,
  onSaved,
}: {
  familyDocId: string
  organizationId: string
  createdByUid: string
  implicitSubjects: SubjectRef[]
  people: RecordablePerson[]
  preselectedPeopleKeys: string[]
  onClose: () => void
  onSaved?: () => void
}) {
  const recognizer = useSpeechRecognition()
  const [stopped, setStopped] = useState(false)
  const [body, setBody] = useState('')
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => new Set(preselectedPeopleKeys))
  const [isPrivate, setIsPrivate] = useState(false)
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

  function togglePerson(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSave() {
    if (!body.trim()) {
      setError('Zápis je prázdný.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const personRefs: SubjectRef[] = people
        .filter((p) => checkedKeys.has(subjectKey(p)))
        .map(({ kind, id }) => ({ kind, id }))
      const sharingLevel: SharingLevel = isPrivate ? 'private' : 'internal'
      await createVoiceTimelineEntry({
        familyDocId,
        organizationId,
        createdByUid,
        subjectRefs: [...implicitSubjects, ...personRefs],
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
    <Drawer onClose={onClose}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-lg font-normal leading-normal text-text-primary">Hlasový zápis</h2>
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

        {!stopped ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
            <div className="relative flex size-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-danger-solid animate-mic-ring" />
              <span className="absolute inset-0 rounded-full bg-danger-solid/40 animate-mic-ring [animation-delay:0.7s]" />
              <span className="relative flex size-20 items-center justify-center rounded-full bg-danger-solid text-white shadow-overlay animate-mic-breathe">
                <Mic size={32} strokeWidth={2} />
              </span>
            </div>
            <p className="max-w-[320px] text-center text-sm text-text-secondary">
              {recognizer.transcript || 'Nahrávám… mluvte.'}
            </p>
            {recognizer.error && <p className="text-sm text-danger">{recognizer.error}</p>}
            <Button variant="destructive" onClick={handleStop} className="gap-2">
              <Square size={14} strokeWidth={2} />
              Zastavit
            </Button>
          </div>
        ) : (
          <>
            {!recognizer.isSupported && (
              <p className="text-xs text-text-tertiary">
                Rozpoznávání řeči není v tomhle prohlížeči podporované — zápis napište ručně.
              </p>
            )}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Text zápisu…"
              autoFocus
              className={cn(
                'w-full flex-1 resize-none rounded-sm border border-border-medium bg-inset px-4 py-3',
                'text-[16px] leading-relaxed text-text-primary placeholder:text-text-tertiary',
                'focus:border-2 focus:border-accent focus:outline-none',
              )}
            />

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-text-primary">Soukromá poznámka</span>
              <Switch checked={isPrivate} onChange={setIsPrivate} label="Soukromá poznámka" />
            </div>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      {stopped && (
        <div className="flex items-center gap-2 border-t border-border px-5 py-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Ukládám…' : 'Uložit text'}
          </Button>
          <Button variant="secondary" disabled title="AI souhrn zatím čeká na napojení (M10)">
            AI souhrn
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Zrušit
          </Button>
        </div>
      )}
    </Drawer>
  )
}
