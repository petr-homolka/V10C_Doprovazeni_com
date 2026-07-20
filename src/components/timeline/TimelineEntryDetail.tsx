import { useState } from 'react'
import { X } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { SHARING_LEVEL_LABELS } from '@/types/sharing'
import type { TimelineEntryDoc } from '@/types/timelineEntry'

/**
 * §7.6 "Detail zápisu — sidebar se dvěma záložkami" — pravý panel (stejný
 * `Drawer` primitiv jako VoiceRecorderPanel). ČISTĚ ke čtení v týhle dávce
 * práce (M3.1) — needituje se odsud, `firestore.rules` má `timeline`
 * update/delete natvrdo `if false` (M2 placeholder), takže editace se
 * stopou v Historii (§7.7) zůstává SEAM, dokud se update pravidlo +
 * append-only `history` podkolekce skutečně nepostaví.
 *
 * "Historie" záložka zatím ukazuje jen `originalTranscript` (pokud zápis
 * prošel AI krokem — v týhle dávce se to nikdy nestane, AI krok je
 * vypnutý SEAM, viz VoiceRecorderPanel) — jakmile editace přibyde, sem
 * přibudou i její položky, stejný append-only vzor jako u dokumentů (§8).
 */
export function TimelineEntryDetail({
  entry,
  authorName,
  subjectLabels,
  onClose,
}: {
  entry: TimelineEntryDoc
  authorName: string
  subjectLabels: string[]
  onClose: () => void
}) {
  const [tab, setTab] = useState<'prehled' | 'historie'>('prehled')

  return (
    <Drawer onClose={onClose}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-lg font-normal leading-normal text-text-primary">Detail zápisu</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zavřít"
          className="flex size-8 items-center justify-center rounded-sm text-text-secondary transition-colors duration-150 hover:bg-overlay-active"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="border-b border-border px-5 py-3">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'prehled', label: 'Přehled' },
            { value: 'historie', label: 'Historie' },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === 'prehled' ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              {authorName} · {new Date(entry.occurredAt).toLocaleString('cs-CZ')}
              {entry.location && ` · GPS ${entry.location.lat.toFixed(4)}, ${entry.location.lng.toFixed(4)}`}
            </p>

            {subjectLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {subjectLabels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex h-6 items-center rounded-full border border-border-strong px-2.5 text-xs font-medium text-text-secondary"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{entry.body}</p>

            <p className="text-xs text-text-tertiary">Kdo uvidí: {SHARING_LEVEL_LABELS[entry.sharingLevel]}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entry.originalTranscript ? (
              <div>
                <p className="text-xs font-medium text-text-secondary">
                  Původní záznam (před AI úpravou)
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">
                  {entry.originalTranscript}
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">Zatím žádná historie.</p>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}
