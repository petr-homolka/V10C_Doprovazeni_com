import { AlertTriangle, Clock } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { ALERT_TIER_LABELS, type AlertTier } from '@/lib/familyAlertStatus'

/**
 * Stavový štítek pro "hoří?" logiku (`familyAlertStatus.ts`) — barva NIKDY
 * sama o sobě (ikona + text vždy vedle, kvůli barvosleposti). `warning`
 * pulzuje (`animate-pulse-alert`, index.css) — "ještě stihneš, ale
 * pospěš"; `crisis` NEpulzuje ("Po termínu" je klidný, statický fakt, ne
 * výzva k okamžité akci). `crisis`/`warning` sdílí barvu s `FamilyCard`'s
 * "Krize" badge (`--crisis`, stejný hex jako `--danger`) — stejný sémantický
 * token pro stejný koncept (návštěva/lhůta po termínu), i když jde o jinou
 * komponentu na jiné obrazovce.
 */
export function AlertTag({ tier, title }: { tier: Exclude<AlertTier, 'ok'>; title?: string }) {
  const Icon = tier === 'waiting' ? Clock : AlertTriangle
  return (
    <span
      title={title}
      className={cn(
        'inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        tier === 'waiting' ? 'bg-warning-bg text-warning' : 'bg-crisis-bg text-crisis',
        tier === 'warning' && 'animate-pulse-alert',
      )}
    >
      <Icon size={12} strokeWidth={2} />
      {ALERT_TIER_LABELS[tier]}
    </span>
  )
}
