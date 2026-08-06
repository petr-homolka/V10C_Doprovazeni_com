import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * SEZNAM VLASTNOSTÍ — „popisek — hodnota" na vlasové lince.
 *
 * Takhle vypadá profil v Routine (jejich obrazovka Contact): žádné karty,
 * žádné podbarvené pruhy, jen řádky `Name — Text`, `Company — Relation`.
 * Do 2026-07-25 měl náš profil rodiny béžovou kartu s Dohodou a béžový pruh
 * s přepínačem, a Petr na ně ukázal právem — plocha kolem informace nese
 * nulovou informaci, ale bere pozornost i místo.
 *
 * Proč je to i funkčně lepší, ne jen tišší: v kartě byly tři údaje slepené
 * do dvou vět („Zprostředkovaná (24 h/12 měsíců)" / „Platí od 27. 9. 2025 ·
 * klíčová osoba: Eva Dvořáková"). Jako řádky jsou to čtyři samostatné
 * vlastnosti, každá s vlastním popiskem — dají se skenovat očima svisle
 * a hlavně se dá u každé zvlášť poznat, že chybí.
 *
 * Sloupec popisků je pevný, takže hodnoty začínají na jedné svislici napříč
 * všemi sekcemi profilu. To je celý trik, kterým hierarchii drží i bez
 * rámečků.
 *
 * Sazba je v `styles/spis.css` (`.sp__prop`), ne tady v třídách, kvůli
 * telefonu: na 720 px a méně se popisek zarovná na LEVOU hranu a hodnota na
 * PRAVOU — „sazba jako zápis v App Storu" (Petr, 2026-07-25). Tím to platí
 * pro všechny profily v appce, ne jen pro rodinu.
 */
export function PropertyList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('m-0', className)}>{children}</dl>
}

export function PropertyRow({
  label,
  children,
  /** Hodnota vpravo (přepínač, tlačítko) — popisek pak zůstane vlevo. */
  align = 'left',
}: {
  label: string
  children: ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <div className="sp__prop border-b border-border-subtle last:border-b-0">
      <dt className="sp__proplabel">{label}</dt>
      <dd className={cn('sp__propvalue m-0', align === 'right' && 'flex justify-end')}>{children}</dd>
    </div>
  )
}

/** Chybějící hodnota je tichá pomlčka, ne veta „Nezadáno". */
export function PropertyEmpty() {
  return <span className="text-text-faint">—</span>
}
