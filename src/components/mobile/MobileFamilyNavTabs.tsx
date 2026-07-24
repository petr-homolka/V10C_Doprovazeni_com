import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/rodiny', label: 'Rodiny' },
  { to: '/pestouni', label: 'Pěstouni' },
  { to: '/deti', label: 'Děti' },
] as const

/**
 * Přepínač Rodiny/Pěstouni/Děti — Petr živě nahlásil (2026-07-23), že
 * "Pěstouni"/"Děti" jsou na mobilu schované pod záložkou "Účet" (dolní
 * lišta má jen 4 pevné sloty, viz `MobileShell.tsx` — vlastní tab pro ně
 * nebyl místo), a jediná cesta k nim byla přes "Zkratky" v Účtu. Místo
 * přidávání dalších slotů do dolní lišty (rozbilo by to 4-sloupcový
 * grid) žijí tyhle tři vzájemně související seznamy (všechny nad daty
 * rodiny) pod JEDNÍM přepínačem nahoře — jedno ťuknutí mezi nimi, bez
 * návratu na Účet. `MobileAccountPage`'s "Zkratky" zůstávají jako
 * druhá, redundantní cesta (neškodí, jen navíc).
 */
export function MobileFamilyNavTabs({ active }: { active: 'rodiny' | 'pestouni' | 'deti' }) {
  return (
    <div className="flex gap-1 rounded-full bg-field p-1">
      {TABS.map((tab) => {
        const key = tab.to.slice(1) as 'rodiny' | 'pestouni' | 'deti'
        const isActive = key === active
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={cn(
              'flex-1 rounded-full py-2 text-center text-base font-semibold transition-colors duration-150',
              isActive ? 'bg-primary text-primary-foreground' : 'text-text-secondary',
            )}
          >
            {tab.label}
          </NavLink>
        )
      })}
    </div>
  )
}
