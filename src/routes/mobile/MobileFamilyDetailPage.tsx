import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Mic, Phone } from '@/components/ui/icons'
import { MobileShell } from '@/components/mobile/MobileShell'
import { VoiceCaptureSheet } from '@/components/mobile/VoiceCaptureSheet'
import { AddressLink } from '@/components/ui/address-link'
import { EntityAgenda } from '@/components/calendar/EntityAgenda'
import { LimitRow } from '@/components/spis/LimitRow'
import { useAuth } from '@/hooks/useAuth'
import { getFamilyByUid, listChildrenForFamily, listFosterPersonsByRefs } from '@/services/familyService'
import { getActiveAgreement } from '@/services/agreementService'
import { listTimelineEntries } from '@/services/timelineService'
import { listCalendarEventsForSubject } from '@/services/calendarEventService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import {
  buildCareLimits, dayCount, daysAgo, educationHoursInLastYear, lastSeenInPerson, nextVisitDue, shortDate,
} from '@/lib/spisInsights'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { AgreementDoc } from '@/types/agreement'
import type { CalendarEventDoc } from '@/types/calendarEvent'
import type { TimelineEntryDoc } from '@/types/timelineEntry'

/**
 * Mobilní profil rodiny — to, co klíčová osoba potřebuje V TERÉNU: kam jít,
 * komu zavolat, koho tam má vidět, do kdy to musí být, a čím to zapsat.
 *
 * SAZBA JAKO ZÁPIS V APP STORU (Petr, 2026-07-25): každý řádek je pár, kde
 * VLEVO je věc a VPRAVO její hodnota, obojí na hraně stránky. Šedé zaoblené
 * skupiny (`GroupedList`) odsud 2026-07-25 zmizely — na telefonu z nich byly
 * krabice v krabici a název rodiny se v nich topil. Zůstala vlasová linka
 * a dva svislé sloupce, po kterých oko sjede.
 *
 * Proti desktopu se vědomě NEUKAZUJE: dokumenty, chat, respit, editace
 * Dohody. Zůstává adresa (ťuknutí → Mapy), telefon (ťuknutí → volání),
 * lhůty, lidé s datem „naposledy osobně", kalendář a diktafon.
 */
export default function MobileFamilyDetailPage() {
  const { familyUid } = useParams<{ familyUid: string }>()
  const navigate = useNavigate()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId

  const [family, setFamily] = useState<FamilyDoc | null>(null)
  const [familyDocId, setFamilyDocId] = useState<string | null>(null)
  const [fosterPersons, setFosterPersons] = useState<Array<{ docId: string; fosterPerson: FosterPersonDoc }>>([])
  const [children, setChildren] = useState<Array<{ docId: string; child: ChildDoc }>>([])
  const [agreement, setAgreement] = useState<AgreementDoc | null>(null)
  const [entries, setEntries] = useState<Array<{ docId: string; entry: TimelineEntryDoc }>>([])
  const [events, setEvents] = useState<Array<{ docId: string; event: CalendarEventDoc }>>([])
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    if (!familyUid || !organizationId) return
    getFamilyByUid(familyUid, organizationId).then(async (found) => {
      if (!found) return
      setFamily(found.family)
      setFamilyDocId(found.docId)
      const [fosters, kids, activeAgreement, timeline, familyEvents] = await Promise.all([
        listFosterPersonsByRefs(found.family.fosterPersonRefs),
        listChildrenForFamily(found.docId, organizationId),
        getActiveAgreement(found.docId, organizationId),
        listTimelineEntries(found.docId, organizationId, userDoc?.uid ?? ''),
        listCalendarEventsForSubject(organizationId, 'family', found.docId),
      ])
      setFosterPersons(fosters)
      setChildren(kids)
      setAgreement(activeAgreement)
      setEntries(timeline)
      setEvents(familyEvents)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyUid, organizationId])

  const primaryFosterName = fosterPersons[0]
    ? `${fosterPersons[0].fosterPerson.firstName} ${fosterPersons[0].fosterPerson.lastName}`
    : null
  const displayName = family ? resolveFamilyDisplayName(family, primaryFosterName) : 'Rodina'

  const limits = useMemo(
    () => buildCareLimits({ agreement, entries, educationHours: educationHoursInLastYear(events) }),
    [agreement, entries, events],
  )
  const due = agreement ? nextVisitDue(agreement) : null

  /** Řádek člověka: vlevo jméno (a telefon jako akce), vpravo „naposledy
   * osobně". Právě to je v terénu ta otázka — koho tam mám dneska vidět. */
  function personRow(
    key: string,
    name: string,
    href: string,
    lastSeen: string | null,
    phone?: string | null,
  ) {
    return (
      <button
        key={key}
        type="button"
        onClick={() => navigate(href)}
        className="flex w-full items-center gap-3 border-b border-border-subtle py-3 text-left active:bg-overlay-active"
      >
        <span className="min-w-0 flex-1 truncate text-base text-text-primary">{name}</span>
        {/* Hodnota hned za jménem, akce až za ní: kdyby telefon stál mezi
            nimi, rozsekne dvojici „věc → hodnota" na tři kusy a pravá hrana
            se rozjede. */}
        <span className="shrink-0 text-sm">
          {lastSeen === null ? (
            <span className="text-accent">nikdy osobně</span>
          ) : (
            <span className="text-text-tertiary">
              {shortDate(lastSeen)} · {dayCount(daysAgo(lastSeen))}
            </span>
          )}
        </span>
        {phone && (
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform active:scale-90"
            aria-label={`Zavolat ${name}`}
          >
            <Phone size={17} />
          </a>
        )}
        <ChevronRight size={16} className="shrink-0 text-text-faint" />
      </button>
    )
  }

  return (
    <MobileShell>
      <div className="sp flex flex-col gap-6 px-4 pb-28 pt-5">
        <button
          type="button"
          onClick={() => navigate('/rodiny')}
          className="flex items-center gap-1.5 self-start text-sm text-text-secondary active:opacity-60"
        >
          <ArrowLeft size={16} /> Rodiny
        </button>

        <div>
          <h1 className="text-2xl text-text-primary">{displayName}</h1>
          {family?.address && (
            <p className="mt-1 text-sm">
              <AddressLink address={family.address} />
            </p>
          )}
        </div>

        {/* Jedna věta, kvůli které se profil v terénu otevírá. */}
        {due && (
          <div className={`border-l-2 pl-3 ${due.overdue || due.daysLeft <= 14 ? 'border-accent' : 'border-border-strong'}`}>
            <p className="text-base text-text-primary">
              {due.overdue
                ? `Návštěva je po termínu o ${dayCount(due.daysLeft)}.`
                : due.daysLeft === 0
                  ? 'Termín návštěvy je dnes.'
                  : `Do termínu návštěvy zbývá ${dayCount(due.daysLeft)}.`}
            </p>
            <p className="mt-0.5 text-sm text-text-tertiary">
              Naposledy {shortDate(agreement!.lastVisitAt!)} · interval {dayCount(agreement!.visitIntervalDays)}
            </p>
          </div>
        )}

        {fosterPersons.length > 0 && (
          <div>
            <h2 className="pb-1 text-xs text-text-faint">Pěstouni</h2>
            <div className="border-t border-border-subtle">
              {fosterPersons.map(({ docId, fosterPerson: fp }) =>
                personRow(
                  docId,
                  `${fp.firstName} ${fp.lastName}`,
                  `/rodiny/${familyUid}/pestoun/${docId}`,
                  lastSeenInPerson(entries, { kind: 'fosterPerson', id: docId }),
                  fp.phone,
                ),
              )}
            </div>
          </div>
        )}

        {children.length > 0 && (
          <div>
            <h2 className="pb-1 text-xs text-text-faint">Děti v péči</h2>
            <div className="border-t border-border-subtle">
              {children.map(({ docId, child }) =>
                personRow(
                  docId,
                  `${child.firstName} ${child.lastName}`,
                  `/rodiny/${familyUid}/dite/${docId}`,
                  lastSeenInPerson(entries, { kind: 'child', id: docId }),
                ),
              )}
            </div>
          </div>
        )}

        {limits.length > 0 && (
          <div>
            <h2 className="pb-1 text-xs text-text-faint">Lhůty a limity</h2>
            <div className="border-t border-border-subtle">
              {limits.map((limit) => (
                <LimitRow key={limit.id} limit={limit} />
              ))}
            </div>
          </div>
        )}

        {/* Kalendář rodiny — „každá entita má svůj kalendář a v profilu se
         * zobrazuje ve zmenšené podobě, defaultní pohled AGENDA". Platí i na
         * mobilu, ne jen v desktopovém profilu. */}
        {organizationId && familyDocId && (
          <div>
            <h2 className="pb-1 text-xs text-text-faint">Kalendář</h2>
            <EntityAgenda organizationId={organizationId} subjectKind="family" subjectId={familyDocId} />
          </div>
        )}
      </div>

      {familyDocId && (
        <button
          type="button"
          onClick={() => setCapturing(true)}
          className="fixed bottom-24 right-5 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-primary-foreground shadow-overlay transition-transform duration-150 active:scale-95"
        >
          <Mic size={20} />
          <span className="text-sm font-medium">Nadiktovat zápis</span>
        </button>
      )}

      {capturing && organizationId && userDoc && familyDocId && (
        <VoiceCaptureSheet
          organizationId={organizationId}
          createdByUid={userDoc.uid}
          initialFamilyDocId={familyDocId}
          onClose={() => setCapturing(false)}
          onSaved={() => {}}
        />
      )}
    </MobileShell>
  )
}
