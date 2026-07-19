import { Link } from 'react-router-dom'

/**
 * Breadcrumb — přeměřeno 2026-07-19 přímo na živé referenční Settings
 * stránce (getComputedStyle): text-xs (12px) po celé délce, STEJNÁ barva
 * (--text-primary) pro aktivní i neaktivní úsek — text se nedimuje,
 * odlišuje jen přes klikatelnost (odkaz + hover pozadí u neaktivních,
 * prostý text bez podkladu u aktivního posledního úseku). Oddělovač "/" je
 * CSS ::after generated content, ne DOM znak — barva --text-secondary při
 * 50% opacitě, 4px padding po stranách.
 */
export interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Drobečková navigace">
      <ol className="flex items-center text-xs">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li
              key={item.label}
              className={
                isLast
                  ? 'flex items-center gap-2.5 px-2 py-1 text-text-primary'
                  : "flex items-center after:px-1 after:text-text-secondary after:opacity-50 after:content-['/']"
              }
            >
              {isLast || !item.href ? (
                item.label
              ) : (
                <Link
                  to={item.href}
                  className="flex items-center gap-2.5 rounded-sm px-2 py-1 text-text-primary transition-colors duration-150 hover:bg-overlay-active"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
