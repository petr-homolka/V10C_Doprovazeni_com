import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { getFamilyByUid } from '@/services/familyService'
import { getActiveAgreement } from '@/services/agreementService'
import { formatElapsedClock } from '@/lib/utils'
import {
  clearActiveVisit,
  getCurrentLocationBestEffort,
  readActiveVisit,
  startActiveVisit,
  type ActiveVisit,
} from '@/hooks/useActiveVisit'

/**
 * §A3 bod 2 + DESIGN_SYSTEM §8.1 "Časomíra návštěvy" — JEDINÉ místo, kde
 * design "vystoupí" (velký kruhový časovač), celá obrazovka BEZ AppShellu
 * (žádný sidebar/topbar, viz spec "Celá obrazovka, --bg-app pozadí").
 *
 * SEAM: §8.1 předepisuje Source Serif 4 pro velké číslo — appka zatím
 * NEMÁ self-hostovaný serif font vůbec (stejná mezera existuje u H1
 * stránek napříč appkou, ne nová jen tady), takže číslo dočasně používá
 * `font-mono` (tabular-nums, stejný klidný rytmus, jiný řez) — doplnit
 * spolu s plošným zavedením Source Serif 4, ne tady izolovaně.
 *
 * SEAM: DESIGN_SYSTEM §8 je nadepsané "jen mobil / PWA" — appka zatím
 * nemá ŽÁDNÝ oddělený mobilní/desktopový shell (jeden AppShell pro
 * všechna zařízení), takže tahle "signature" obrazovka (a perzistentní
 * banner, §8.2, viz ActiveVisitBanner.tsx) je dnes vědomě dostupná i z
 * desktopu — jinak by KO pracující od stolu tuhle klíčovou funkci vůbec
 * neměl. Skutečné odlišení "tichého" desktopového vs. "hlasitého"
 * mobilního zážitku (pokud se ukáže žádoucí) patří do M11 (PWA polish),
 * ne do týhle dávky.
 *
 * Konec (`handleEnd`) vede PŘÍMO do hlasového zápisníku (§A3 bod 3) —
 * tahle stránka žádný zápis needituje, jen spočítá
 * `startedAt/endedAt/durationSeconds/location` a předá je přes
 * `navigate(..., {state})` zpět na FamilyDetailPage, která otevře
 * VoiceRecorderPanel v `visit` režimu (má už načtené pěstouny/děti pro
 * "Zařadit k", tahle stránka je zbytečně znovu nenačítá).
 */
export default function VisitTimerPage() {
  const { familyUid } = useParams<{ familyUid: string }>()
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const navigate = useNavigate()

  const [visit, setVisit] = useState<ActiveVisit | null>(null)
  const [conflict, setConflict] = useState<ActiveVisit | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  // Živě odhaleno 2026-07-19 recenzí: "Zahodit tamní návštěvu a začít
  // novou tady" (handleDiscardOther) dřív jen mazal `conflict`, ale
  // znovuspuštění celé start-logiky žilo VÝHRADNĚ uvnitř efektu klíčeného
  // na [familyUid, organizationId] — ty se po kliknutí nezmění, takže se
  // efekt nikdy znovu nespustil a obrazovka zůstala navždy na "Spouštím
  // návštěvu…". `startAttempt` je čítač v poli závislostí přesně pro tenhle
  // účel — inkrementuje se, kdykoli se má start-logika zopakovat od nuly.
  const [startAttempt, setStartAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!familyUid || !organizationId) return
      const stored = readActiveVisit()
      if (stored && stored.familyUid === familyUid) {
        setVisit(stored)
        return
      }
      if (stored && stored.familyUid !== familyUid) {
        setConflict(stored)
        return
      }
      const found = await getFamilyByUid(familyUid, organizationId)
      if (!found) {
        if (!cancelled) setError('Tenhle Spis se nepodařilo najít.')
        return
      }
      // Živě odhaleno 2026-07-19 recenzí: jediná dosavadní pojistka proti
      // návštěvě bez aktivní Dohody bylo vypnuté tlačítko "+ Návštěva" na
      // FamilyDetailPage — přímá URL (`/rodiny/:uid/navsteva`) ho obchází a
      // KO by celý (klidně vícehodinový) GPS timer + diktovaný zápis
      // dokončil, jen aby mu ho `createVisitTimelineEntry` na konci zahodilo
      // s permission-denied (`hasActiveAgreementFor`). Kontrola HNED na
      // začátku ušetří přesně tuhle ztrátu práce — samotný zápis pravidla
      // zůstává jediným SKUTEČNÝM prosazením (tohle je jen UX zkratka).
      const activeAgreementForFamily = await getActiveAgreement(found.docId, organizationId).catch(() => null)
      if (!activeAgreementForFamily || activeAgreementForFamily.status !== 'active') {
        if (!cancelled) {
          setError('Tahle rodina nemá s vaší organizací aktivní Dohodu — návštěvu by nešlo uložit.')
        }
        return
      }
      const location = await getCurrentLocationBestEffort()
      if (cancelled) return
      // Dvojité okno (dva taby, dvojklik na "+ Návštěva") — mezi prvním
      // čtením `readActiveVisit()` výš a tímhle místem uplynul čas
      // (2 awaitované síťové volání), takže se stav mezitím mohl změnit.
      // Znovu zkontrolovat těsně před zápisem, ne slepě přepsat.
      const stillStored = readActiveVisit()
      if (stillStored && stillStored.familyUid !== familyUid) {
        setConflict(stillStored)
        return
      }
      if (stillStored && stillStored.familyUid === familyUid) {
        setVisit(stillStored)
        return
      }
      const fresh: ActiveVisit = {
        familyDocId: found.docId,
        familyUid,
        organizationId,
        startedAt: new Date().toISOString(),
        location,
      }
      startActiveVisit(fresh)
      setVisit(fresh)
    }
    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyUid, organizationId, startAttempt])

  useEffect(() => {
    if (!visit) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [visit])

  function handleDiscardOther() {
    clearActiveVisit()
    setConflict(null)
    setStartAttempt((n) => n + 1)
  }

  function handleEnd() {
    if (!visit || !familyUid) return
    const endedAt = new Date().toISOString()
    const durationSeconds = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(visit.startedAt)) / 1000))
    clearActiveVisit()
    navigate(`/rodiny/${familyUid}`, {
      replace: true,
      state: {
        openVisitRecorder: {
          startedAt: visit.startedAt,
          endedAt,
          durationSeconds,
          location: visit.location,
        },
      },
    })
  }

  function handleCancel() {
    clearActiveVisit()
    navigate(`/rodiny/${familyUid}`)
  }

  if (conflict) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app px-6 text-center">
        <p className="max-w-[320px] text-sm text-text-secondary">
          Máte rozjetou návštěvu u jiné rodiny — nejde spustit dvě najednou.
        </p>
        <Button onClick={() => navigate(`/rodiny/${conflict.familyUid}/navsteva`)}>Pokračovat v ní</Button>
        <button
          type="button"
          onClick={handleDiscardOther}
          className="text-sm text-text-tertiary underline-offset-2 hover:text-text-secondary hover:underline"
        >
          Zahodit tamní návštěvu a začít novou tady
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-6">
        <p className="text-sm text-danger">{error}</p>
      </div>
    )
  }

  if (!visit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <p className="text-sm text-text-secondary">Spouštím návštěvu…</p>
      </div>
    )
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(visit.startedAt)) / 1000))

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <div className="flex items-center px-5 py-4">
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm text-text-tertiary underline-offset-2 hover:text-text-secondary hover:underline"
        >
          Zrušit návštěvu
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <div className="relative flex size-64 items-center justify-center rounded-full bg-primary-soft">
          <span className="motion-safe:animate-pulse absolute inset-0 rounded-full border-2 border-primary" />
          <span className="font-mono text-[56px] font-normal tabular-nums leading-none text-text-primary">
            {formatElapsedClock(elapsedSeconds)}
          </span>
        </div>
        <p className="text-sm text-text-tertiary">
          {visit.location ? `GPS ${visit.location.lat.toFixed(4)}, ${visit.location.lng.toFixed(4)}` : 'GPS nedostupná'}
        </p>
      </div>

      <div className="flex justify-center px-6 pb-10">
        <Button onClick={handleEnd} className="h-12 w-full max-w-[360px] rounded-full text-base">
          Ukončit návštěvu
        </Button>
      </div>
    </div>
  )
}
