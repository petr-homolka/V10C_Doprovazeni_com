import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Mic, Phone } from 'lucide-react'
import { MobileShell } from '@/components/mobile/MobileShell'
import { VoiceCaptureSheet } from '@/components/mobile/VoiceCaptureSheet'
import { GroupedList, GroupedListRow } from '@/components/mobile/GroupedList'
import { AddressLink } from '@/components/ui/address-link'
import { EntityAgenda } from '@/components/calendar/EntityAgenda'
import { useAuth } from '@/hooks/useAuth'
import { getFamilyByUid, listChildrenForFamily, listFosterPersonsByRefs } from '@/services/familyService'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'

/**
 * Mobilní profil rodiny (M11) — VĚDOMĚ zjednodušený oproti desktopové
 * `FamilyDetailPage` (žádná časová osa/dokumenty/Dohoda editace na
 * mobilu, SEAM) — jen to, co KO v terénu potřebuje na místě: adresa
 * (ťuknutí → Mapy), telefon na pěstouna (ťuknutí → volání), jména dětí,
 * a zkratka rovnou do hlasového zápisu PŘEDVYPLNĚNÉHO touhle rodinou.
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
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    if (!familyUid || !organizationId) return
    getFamilyByUid(familyUid, organizationId).then(async (found) => {
      if (!found) return
      setFamily(found.family)
      setFamilyDocId(found.docId)
      const [fosters, kids] = await Promise.all([
        listFosterPersonsByRefs(found.family.fosterPersonRefs),
        listChildrenForFamily(found.docId, organizationId),
      ])
      setFosterPersons(fosters)
      setChildren(kids)
    })
  }, [familyUid, organizationId])

  const primaryFosterName = fosterPersons[0]
    ? `${fosterPersons[0].fosterPerson.firstName} ${fosterPersons[0].fosterPerson.lastName}`
    : null
  const displayName = family ? resolveFamilyDisplayName(family, primaryFosterName) : 'Rodina'

  return (
    <MobileShell>
      <div className="flex flex-col gap-5 px-5 pb-24 pt-6">
        <button type="button" onClick={() => navigate('/rodiny')} className="flex items-center gap-1.5 text-[15px] text-text-secondary active:opacity-60">
          <ArrowLeft size={16} /> Zpět na Rodiny
        </button>

        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-text-primary">{displayName}</h1>
          {family?.address && (
            <p className="mt-1 text-base">
              <AddressLink address={family.address} />
            </p>
          )}
        </div>

        {fosterPersons.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">Pěstouni</h2>
            <GroupedList>
              {fosterPersons.map(({ docId, fosterPerson }) => (
                <GroupedListRow
                  key={docId}
                  as="div"
                  onClick={() => navigate(`/rodiny/${familyUid}/pestoun/${docId}`)}
                >
                  <span className="min-w-0 flex-1 truncate text-[16px] text-text-primary">
                    {fosterPerson.firstName} {fosterPerson.lastName}
                  </span>
                  {fosterPerson.phone && (
                    <a
                      href={`tel:${fosterPerson.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform active:scale-90"
                      aria-label={`Zavolat ${fosterPerson.firstName} ${fosterPerson.lastName}`}
                    >
                      <Phone size={18} />
                    </a>
                  )}
                  <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
                </GroupedListRow>
              ))}
            </GroupedList>
          </div>
        )}

        {children.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">Děti</h2>
            <GroupedList>
              {children.map(({ docId, child }) => (
                <GroupedListRow key={docId} onClick={() => navigate(`/rodiny/${familyUid}/dite/${docId}`)}>
                  <span className="min-w-0 flex-1 truncate text-[16px] text-text-primary">
                    {child.firstName} {child.lastName}
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
                </GroupedListRow>
              ))}
            </GroupedList>
          </div>
        )}
        {/* Kalendář rodiny — "každá entita má svůj kalendář a v profilu se
         * zobrazuje ve zmenšené podobě, defaultní pohled AGENDA". Platí i na
         * mobilu, ne jen v desktopovém profilu. */}
        {organizationId && familyDocId && (
          <div className="flex flex-col gap-2">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-text-tertiary">Kalendář</h2>
            <EntityAgenda organizationId={organizationId} subjectKind="family" subjectId={familyDocId} />
          </div>
        )}
      </div>

      {familyDocId && (
        <button
          type="button"
          onClick={() => setCapturing(true)}
          className="fixed bottom-24 right-5 flex h-14 items-center gap-2 rounded-full bg-danger-solid px-5 text-white shadow-overlay transition-transform duration-150 active:scale-95"
        >
          <Mic size={20} strokeWidth={2} />
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
