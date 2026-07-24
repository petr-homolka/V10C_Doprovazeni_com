import type { MouseEvent } from 'react'
import { MapPin } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

/**
 * Adresa jako odkaz do Map Google (UX zpětná vazba 2026-07-21) — `?api=1&
 * query=` otevře vyhledání místa s možností navigace, funguje na desktopu
 * i v mobilní/PWA appce Map. `stopPropagation`, protože adresa často sedí
 * uvnitř klikatelného řádku (seznam Rodin) — klik na adresu má otevřít
 * mapu, ne navigovat na detail. Řádek NESMÍ být `<Link>`/`<a>` (nested
 * anchor je neplatné HTML, živě odhaleno 2026-07-21) — `FamilyListPage`
 * proto naviguje ručně přes `onClick`+`useNavigate`, ne přes `<Link>`.
 */
export function AddressLink({ address, className }: { address: string; className?: string }) {
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e: MouseEvent) => e.stopPropagation()}
      title="Otevřít v Mapách Google"
      className={cn(
        'inline-flex items-center gap-1 text-text-secondary underline-offset-2 transition-colors duration-150 hover:text-text-primary hover:underline',
        className,
      )}
    >
      <MapPin size={13} strokeWidth={1.75} className="shrink-0" />
      {address}
    </a>
  )
}
