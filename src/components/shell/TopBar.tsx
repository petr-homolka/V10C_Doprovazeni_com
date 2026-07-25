import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/breadcrumb'

/**
 * HLAVIČKA — jen kontext. Nic víc.
 *
 * Přestavěno 2026-07-25 na Petrův podnět. Do té doby tady visel cluster
 * pěti ovládacích prvků (hledání, motiv, nastavení, oznámení, účet) a bylo
 * to špatně ze dvou důvodů:
 *
 *   1. Hledání je PRVNÍ krok práce (zavolá pěstoun, přijde e-mail), ale
 *      jako pátá ikonka vpravo nahoře bylo na konci cesty oka. Teď je
 *      v postranním panelu hned pod značkou.
 *   2. Motiv, nastavení, oznámení a účet se za den použijí jednou nebo
 *      vůbec. Trvale zabíraly nejcennější místo na obrazovce. Teď jsou
 *      dole v postranním panelu, mimo hlavní tah.
 *
 * Zůstal breadcrumb, protože ten odpovídá na otázku „kde jsem" — a to je
 * jediné, co hlavička v Routine dělá.
 *
 * Zmizela taky „plovoucí pilulka": zaoblená bílá karta se stínem. Stín
 * znamená „tohle pluje nad ostatním", a hlavička nepluje — leží na stejném
 * listu jako obsah. Dělí je VLASOVÁ LINKA.
 *
 * Když stránka breadcrumb nemá (např. „Dnes"), je hlavička prázdná, a to je
 * v pořádku. Prázdné místo není chyba, kterou je nutné něčím zaplnit.
 */
export function TopBar({ breadcrumb }: { breadcrumb?: BreadcrumbItem[] }) {
  return (
    <div className="flex h-12 shrink-0 items-center border-b border-border-subtle bg-app px-5">
      <div className="min-w-0 flex-1">{breadcrumb && <Breadcrumb items={breadcrumb} />}</div>
    </div>
  )
}
