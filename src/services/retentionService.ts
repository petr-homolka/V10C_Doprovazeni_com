import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  RETENTION_RULES,
  isPastRetention,
  retentionCutoff,
  type RetentionRule,
} from '@/lib/retentionPolicy'
import { actorFields, recordAudit } from '@/services/auditLogService'
import type { AuditActor } from '@/types/auditLog'
import type { ImportJobDoc } from '@/types/importJob'
import type { FosterProspectDoc } from '@/types/fosterProspect'

/**
 * Výkon retenční politiky (`lib/retentionPolicy.ts` říká CO a JAK DLOUHO,
 * tenhle soubor JAK).
 *
 * TŘI VĚDOMÁ OMEZENÍ, ať je jasné, co tohle je a co ne:
 *
 * 1. NIC SE NEDĚJE SAMO. Projekt nemá Cloud Functions, takže neexistuje
 *    server, který by v noci něco promazal. Úklid spustí člověk ze
 *    Nastavení. Až Functions přibudou, tenhle plánovač se z nich zavolá
 *    beze změny — proto je oddělený od UI.
 * 2. NEJDŘÍV SE UKÁŽE, POTOM MAŽE. `planRetention` jen POČÍTÁ, co by
 *    zmizelo. Mazání je druhý, samostatný krok s vlastním potvrzením.
 * 3. MAŽE SE JEN TO, CO MÁ ROZHODNUTOU LHŮTU. Pravidla ve stavu
 *    `needs_decision` plánovač přeskočí a nahlásí je jako nerozhodnutá.
 *    Chybějící rozhodnutí nikdy neznamená „tak to smažeme".
 */

export interface RetentionPlanItem {
  rule: RetentionRule
  /** Hranice — starší než tohle je za lhůtou. `null` u nerozhodnutých. */
  cutoff: string | null
  /** Kolik záznamů by zmizelo. `null` = pravidlo se nekontrolovalo. */
  count: number | null
  /** Ukázka (max 5 popisků) — aby člověk viděl, o co jde, než potvrdí. */
  sample: string[]
  /** Proč se nekontrolovalo. */
  skipped?: 'needs_decision' | 'no_scanner'
}

export interface RetentionPlan {
  organizationId: string
  plannedAt: string
  items: RetentionPlanItem[]
  /** Součet napříč pravidly, která se skutečně kontrolovala. */
  totalToDelete: number
}

/**
 * Scannery. Každé pravidlo, které se má umět skutečně vykonat, tu musí mít
 * záznam. Pravidlo bez scanneru se v plánu objeví jako `no_scanner` —
 * viditelně, ne tiše přeskočené.
 */
type Scanner = (
  organizationId: string,
  rule: RetentionRule,
  today: Date,
) => Promise<{ refs: Array<ReturnType<typeof doc>>; sample: string[] }>

const SCANNERS: Record<string, Scanner> = {
  /**
   * Nahrané řádky z importů. Kotva je `committedAt` (dokončení), a pokud
   * import nikdy nedoběhl, `createdAt` — nedokončený import z loňska je
   * taky jen ležící kopie osobních údajů.
   */
  import_staging: async (organizationId, rule, today) => {
    const jobsSnap = await getDocs(collection(db, 'organizations', organizationId, 'importJobs'))
    const refs: Array<ReturnType<typeof doc>> = []
    const sample: string[] = []

    for (const jobDoc of jobsSnap.docs) {
      const job = jobDoc.data() as ImportJobDoc
      const anchor = job.committedAt ?? job.createdAt
      if (!isPastRetention(rule, anchor, today)) continue

      const stagingSnap = await getDocs(collection(jobDoc.ref, 'stagingRecords'))
      if (stagingSnap.empty) continue
      for (const record of stagingSnap.docs) refs.push(record.ref)
      if (sample.length < 5) {
        sample.push(`Import z ${anchor.slice(0, 10)} — ${stagingSnap.size} řádků`)
      }
    }
    return { refs, sample }
  },
}

/**
 * Spočítá, co by se smazalo. NIC nemaže. Čtení stojí peníze, takže se
 * prochází jen pravidla s rozhodnutou lhůtou.
 */
export async function planRetention(
  organizationId: string,
  today: Date = new Date(),
  rules: RetentionRule[] = RETENTION_RULES,
): Promise<RetentionPlan> {
  const items: RetentionPlanItem[] = []

  for (const rule of rules) {
    const cutoff = retentionCutoff(rule, today)

    if (rule.status === 'needs_decision' || cutoff === null) {
      items.push({ rule, cutoff: null, count: null, sample: [], skipped: 'needs_decision' })
      continue
    }
    const scanner = SCANNERS[rule.key]
    if (!scanner) {
      items.push({ rule, cutoff, count: null, sample: [], skipped: 'no_scanner' })
      continue
    }
    const { refs, sample } = await scanner(organizationId, rule, today)
    items.push({ rule, cutoff, count: refs.length, sample })
  }

  return {
    organizationId,
    plannedAt: today.toISOString(),
    items,
    totalToDelete: items.reduce((sum, item) => sum + (item.count ?? 0), 0),
  }
}

/** Co musí člověk opsat, aby se mazání spustilo. */
export const RETENTION_CONFIRMATION = 'SMAZAT'

export interface RetentionExecutionResult {
  deleted: number
  perRule: Record<string, number>
}

/**
 * Skutečné mazání. Vyžaduje:
 * - `confirmation === RETENTION_CONFIRMATION` (opsané slovo, ne klik),
 * - `actor` (mazání se zapisuje do auditní stopy, jinak by šlo tiše).
 *
 * Plán se ZNOVU vyhodnotí — nemaže se podle čísel, která si uživatel
 * prohlížel před deseti minutami, ale podle aktuálního stavu. Kdyby mezitím
 * přibyl záznam, ještě není za lhůtou a nesmí zmizet.
 */
export async function executeRetention(
  organizationId: string,
  actor: AuditActor,
  confirmation: string,
  today: Date = new Date(),
  rules: RetentionRule[] = RETENTION_RULES,
): Promise<RetentionExecutionResult> {
  if (confirmation !== RETENTION_CONFIRMATION) {
    throw new Error('Mazání nebylo potvrzeno.')
  }

  const perRule: Record<string, number> = {}
  let deleted = 0

  for (const rule of rules) {
    if (rule.status !== 'active') continue
    const scanner = SCANNERS[rule.key]
    if (!scanner) continue

    const { refs } = await scanner(organizationId, rule, today)
    for (const ref of refs) await deleteDoc(ref)
    if (refs.length > 0) {
      perRule[rule.key] = refs.length
      deleted += refs.length
    }
  }

  // Úklid se loguje VŽDY, i když nic nesmazal — „proběhlo a nebylo co"
  // je taky doložitelná informace.
  await recordAudit({
    organizationId,
    action: 'retention_sweep',
    ...actorFields(actor),
    detail:
      deleted === 0
        ? 'Retenční úklid proběhl, nic nebylo za lhůtou.'
        : `Smazáno ${deleted} záznamů: ${Object.entries(perRule)
            .map(([key, count]) => `${key} (${count})`)
            .join(', ')}.`,
  })

  return { deleted, perRule }
}

/**
 * Kolik zájemců by se dotklo rozhodnutí o jejich lhůtě. Není to scanner
 * (pravidlo je nerozhodnuté, takže se nemaže) — je to podklad PRO to
 * rozhodnutí: „takhle velký problém to je".
 */
export async function countStaleProspects(organizationId: string, olderThanMonths: number): Promise<number> {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - olderThanMonths)
  const snap = await getDocs(
    query(collection(db, 'fosterProspects'), where('organizationId', '==', organizationId)),
  )
  return snap.docs.filter((d) => {
    const data = d.data() as FosterProspectDoc
    // Ze zájemce se stala rodina → jeho údaje mají účel dál a nepočítají se.
    if (data.status === 'vznik_dohody') return false
    const last = data.lastContactAt ?? data.dormantSince ?? data.createdAt
    return !!last && last < cutoff.toISOString()
  }).length
}
