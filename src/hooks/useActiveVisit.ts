import { useEffect, useState } from 'react'

/**
 * §A3 bod 2: rozjetá návštěva NENÍ ve Firestore, dokud neskončí — jen
 * `startedAt` + jednorázová GPS v `localStorage`, aby přežila reload/zavření
 * tabu a šla obnovit z perzistentního banneru (§8.2) odkudkoli v appce.
 * JEDNA rozjetá návštěva najednou (globální klíč, ne per-rodina) — KO fyzicky
 * může být jen na jedné návštěvě v čase.
 *
 * `window.dispatchEvent(new Event(EVENT))` navíc k `localStorage` samotnému,
 * protože prohlížeč `storage` event nikdy nefunguje v TOMTÉŽ tabu, který
 * zápis provedl (jen v ostatních) — bez vlastní události by banner v
 * aktuálním tabu nezareagoval na start/konec návštěvy hned.
 */
const STORAGE_KEY = 'doprovazeni:activeVisit'
const EVENT = 'doprovazeni:active-visit-changed'

export interface ActiveVisit {
  familyDocId: string
  familyUid: string
  organizationId: string
  startedAt: string
  location: { lat: number; lng: number } | null
}

export function readActiveVisit(): ActiveVisit | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ActiveVisit
  } catch {
    return null
  }
}

export function startActiveVisit(visit: ActiveVisit): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visit))
  window.dispatchEvent(new Event(EVENT))
}

export function clearActiveVisit(): void {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(EVENT))
}

export function useActiveVisit(): ActiveVisit | null {
  const [visit, setVisit] = useState<ActiveVisit | null>(() => readActiveVisit())

  useEffect(() => {
    function refresh() {
      setVisit(readActiveVisit())
    }
    window.addEventListener(EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return visit
}

/** Jednorázová GPS poloha, best-effort — pokud uživatel odmítne oprávnění
 * nebo zařízení GPS nemá, návštěva se přesto spustí (§A3 nezmiňuje GPS jako
 * blokující podmínku, jen jako doplňkový údaj). */
export function getCurrentLocationBestEffort(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 },
    )
  })
}
