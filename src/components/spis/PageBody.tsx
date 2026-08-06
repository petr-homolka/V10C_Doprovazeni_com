import type { ReactNode } from 'react'
import { useScrollTopOnRoute } from '@/hooks/useScrollTopOnRoute'

/**
 * TĚLO STRÁNKY — šedá plocha, na ní bílé karty, jedna šířka pro celou appku.
 *
 * Tohle je ta „jedna třída", o kterou Petr 2026-07-25 žádal: „třídy stylů
 * musí být napříč celou platformou stejné, abychom pak mohli dělat globální
 * změny." Šířka obsahu, odsazení od hran, mezera mezi sekcemi a pozadí
 * stránky jsou v `styles/spis.css` (`.sp__page`, `.sp__sections`) — kdo je
 * chce změnit, mění je TAM a změní se všude, ne na dvaceti stránkách.
 *
 * Roluje se UVNITŘ (ne okno), protože postranní panel i hlavička mají
 * zůstat stát. Proto tu taky sedí `useScrollTopOnRoute`: každá stránka
 * postavená na `PageBody` se otevře nahoře, aniž by si to musela hlídat.
 */
export function PageBody({ children }: { children: ReactNode }) {
  const scroller = useScrollTopOnRoute<HTMLDivElement>()

  return (
    <div className="sp sp__page flex h-full min-w-0 flex-1">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="sp__sections">{children}</div>
      </div>
    </div>
  )
}

/**
 * HLAVIČKA STRÁNKY — název, jedna věta, akce, případně filtry.
 *
 * CESTA E: UŽ NENÍ KARTA. Vercel nechává nadpis stát přímo na ploše
 * stránky a rámuje až obsah pod ním; bílá karta kolem titulku dělala
 * z nadpisu další „objekt" a stránka pak měla dvě stejně silné hrany nad
 * sebou. Filtry pod nadpisem oddělí linka, ne druhý rám.
 *
 * Stejná jako hlavička profilu rodiny, aby seznam a detail vypadaly jako
 * jedna appka. Nadpis je `text-2xl` (26 px) a JEDINÝ na stránce; sekce pod
 * ním mají `text-base`, takže hierarchii dělá velikost, ne tučnost.
 *
 * `actions` patří vpravo nahoru a platí pravidlo z `button.tsx`: jedna
 * primární akce na obrazovku, zbytek tiše.
 */
export function PageHead({
  title,
  description,
  count,
  actions,
  children,
}: {
  title: string
  /** Jedna věta „co tady je". Nepovinná — u samozřejmých stránek škodí. */
  description?: string
  count?: number
  actions?: ReactNode
  /** Filtry, přepínače, souhrnné body — pod nadpisem, v téže kartě. */
  children?: ReactNode
}) {
  return (
    <header className="px-1">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2.5 text-2xl font-medium text-text-primary">
            {title}
            {count !== undefined && <span className="text-lg text-text-faint">{count}</span>}
          </h1>
          {description && <p className="mt-1 text-sm text-text-tertiary">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  )
}
