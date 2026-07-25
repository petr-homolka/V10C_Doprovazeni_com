import { useEffect, useRef, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * STRÁNKA SE VŽDYCKY OTEVÍRÁ NAHOŘE (Petr, 2026-07-25).
 *
 * Prohlížeč to sám neudělá: tahle appka neroluje okno, ale VNITŘNÍ
 * kontejner (`overflow-y-auto` v `AppShell`, `MobileShell` nebo přímo ve
 * stránce), a ten si při přechodu na jinou cestu drží předchozí pozici.
 * Kdo si prošel dlouhý profil rodiny až dolů a klikl na dítě, přistál
 * uprostřed jeho stránky.
 *
 * Reaguje se na `pathname`, ne na celou `location`: `?tab=`, `?panel=`
 * nebo `#kotva` jsou pohyb UVNITŘ stránky a ten se rolovat nemá — jinak by
 * otevření pravého panelu odrolovalo obsah pod ním.
 *
 * Vrací ref, který se dá pověsit na rolovací element; nebo ho lze zavolat
 * s vlastním refem, když si ho stránka už drží (`useScrollTopOnRoute(myRef)`).
 */
export function useScrollTopOnRoute<T extends HTMLElement>(external?: RefObject<T | null>): RefObject<T | null> {
  const own = useRef<T>(null)
  const ref = external ?? own
  const { pathname } = useLocation()

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 })
  }, [pathname, ref])

  return ref
}
