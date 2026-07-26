import { listTimelineEntriesForPeriod } from '@/services/timelineService'
import { createDocument } from '@/services/documentService'
import type { TimelineEntryDoc } from '@/types/timelineEntry'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { SubjectRef } from '@/types/timelineEntry'

/**
 * M6 §A.1/§A.2 — "Report NENÍ zvláštní entita." KO vybere období → stáhne
 * časovou osu → sestaví markdown (průběh péče, návštěvy s délkou,
 * vzdělávání vs. limit, shrnutí k doplnění) → založí BĚŽNÝ dokument se
 * `subjectRefs` na děti → jede M5 automat A1 (`documentService.createDocument`,
 * beze změny). KO obsah před odesláním upraví/zkontroluje — proto se sem
 * pouští VŠECHNY nesoukromé zápisy (internal i foster), ne jen `foster`
 * úroveň, žádoucí filtrování dělá lidská revize v `draft`, ne generátor.
 */

const TIMELINE_TYPE_LABELS: Record<TimelineEntryDoc['type'], string> = {
  note: 'Poznámka',
  visit: 'Návštěva',
  voice_entry: 'Hlasový zápis',
  system: 'Systémová událost',
  document: 'Dokument',
}

function formatDurationHours(seconds?: number): string {
  if (!seconds) return ''
  const hours = seconds / 3600
  return ` (${hours.toFixed(1)} h)`
}

export function buildOspodReportMarkdown(
  entries: Array<{ entry: TimelineEntryDoc }>,
  fosterPersons: Array<{ fosterPerson: FosterPersonDoc }>,
  periodFrom: string,
  periodTo: string,
): string {
  const lines: string[] = []
  lines.push(`# Zpráva o průběhu péče (${periodFrom.slice(0, 10)} – ${periodTo.slice(0, 10)})`, '')

  lines.push('## Průběh péče', '')
  const visits = entries.filter((e) => e.entry.type === 'visit')
  if (visits.length === 0) {
    lines.push('V daném období neproběhla žádná zaznamenaná návštěva.', '')
  } else {
    for (const { entry } of visits) {
      lines.push(`- **${new Date(entry.occurredAt).toLocaleDateString('cs-CZ')}**${formatDurationHours(entry.durationSeconds)}: ${entry.body}`)
    }
    lines.push('')
  }

  lines.push('## Ostatní záznamy', '')
  const others = entries.filter((e) => e.entry.type !== 'visit')
  if (others.length === 0) {
    lines.push('Žádné další záznamy.', '')
  } else {
    for (const { entry } of others) {
      lines.push(`- ${new Date(entry.occurredAt).toLocaleDateString('cs-CZ')} · ${TIMELINE_TYPE_LABELS[entry.type]}: ${entry.body}`)
    }
    lines.push('')
  }

  lines.push('## Vzdělávání pěstounů vs. limit', '')
  for (const { fosterPerson } of fosterPersons) {
    const w = fosterPerson.educationOfficial
    if (!w) {
      lines.push(`- ${fosterPerson.firstName} ${fosterPerson.lastName}: okno vzdělávání zatím nezaloženo.`)
    } else {
      lines.push(
        `- ${fosterPerson.firstName} ${fosterPerson.lastName}: ${w.hoursCompletedInWindow} / ${w.hoursRequired} h (okno ${w.windowStart.slice(0, 10)} – ${w.windowEnd.slice(0, 10)})`,
      )
    }
  }
  lines.push('')

  lines.push('## Shrnutí k doplnění', '', '_(doplní klíčová osoba)_', '')
  return lines.join('\n')
}

export interface GenerateOspodReportInput {
  familyDocId: string
  organizationId: string
  orgCode: string
  createdByUid: string
  title: string
  periodFrom: string
  periodTo: string
  childIds: string[]
  fosterPersons: Array<{ fosterPerson: FosterPersonDoc }>
}

export async function generateOspodReport(
  input: GenerateOspodReportInput,
): Promise<{ docId: string }> {
  const entries = await listTimelineEntriesForPeriod(
    input.familyDocId,
    input.organizationId,
    input.periodFrom,
    input.periodTo,
  )
  const body = buildOspodReportMarkdown(entries, input.fosterPersons, input.periodFrom, input.periodTo)
  const subjectRefs: SubjectRef[] = input.childIds.map((id) => ({ kind: 'child', id }))
  const { docId } = await createDocument({
    familyDocId: input.familyDocId,
    organizationId: input.organizationId,
    createdByUid: input.createdByUid,
    title: input.title,
    body,
    subjectRefs,
  })
  return { docId }
}
