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
 * Sloupec popisků je pevný (128 px), takže hodnoty začínají na jedné svislici
 * napříč všemi sekcemi profilu. To je celý trik, kterým hierarchii drží
 * i bez rámečků.
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
    <div className="flex items-center gap-4 border-b border-border-subtle py-2 last:border-b-0">
      <dt className="w-32 shrink-0 text-sm text-text-tertiary">{label}</dt>
      <dd className={cn('m-0 min-w-0 flex-1 text-sm text-text-primary', align === 'right' && 'flex justify-end')}>
        {children}
      </dd>
    </div>
  )
}

/** Chybějící hodnota je tichá pomlčka, ne veta „Nezadáno". */
export function PropertyEmpty() {
  return <span className="text-text-faint">—</span>
}
