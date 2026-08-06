import type { ReactNode } from 'react'

/**
 * Tag — malá pilulka pro úrovňové/stavové značky (např. "Prémiové", "Nové"),
 * NE pro subjektové štítky (na to slouží Badge, badge.tsx). Přeměřeno
 * 2026-07-19 na živé referenční appce ("Business"/"New" pilulky): 10px text, 18px výška,
 * plná barva textu na 15% alpha pozadí stejné barvy — zatím nepoužito
 * v žádné obrazovce (§5.8 entitlementy nemají UI), token/komponenta
 * připravená pro M9.5.
 */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[18px] items-center rounded-full bg-tier-bg px-1.5 text-2xs font-medium leading-4 text-tier">
      {children}
    </span>
  )
}
