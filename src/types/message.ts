import type { SharingLevel } from './sharing'

/**
 * families/{familyId}/messages/{id} — Chat (M9). Na rozdíl od `timeline`
 * (VÝHRADNĚ staff zakládá, viz timelineService.ts) je tohle OBOUSMĚRNÉ
 * vlákno — pěstoun i staff zakládají zápisy do STEJNÉ podkolekce, jedno
 * vlákno na rodinu (ne per dítě/pěstoun — "Chat s klíčovou osobou" je
 * rodinná věc, viz MojeDashboardPage placeholder z M4).
 *
 * `audience` — sharing.ts §7.4 dokumentuje pole přesně takhle
 * ("budoucím chatem (`messages.audience`, M9)"), jiné jméno než
 * `timeline.sharingLevel`, ale STEJNÝ typ (`SharingLevel`) — jeden mentální
 * model sdílení napříč funkcemi. V praxi chat používá jen dvě hodnoty:
 * `'foster'` (skutečná zpráva, vidí ji obě strany) a `'internal'` (interní
 * poznámka k vláknu — HelpScout/Intercom "note vs. reply" vzor, pěstoun ji
 * nikdy neuvidí). `'private'`/`'ospod'` v chatu nedávají smysl (dvoustranná
 * konverzace, OSPOD nemá vlastní portál) — typ je sdílený, ale klient i
 * pravidla je pro `messages` nikdy nepoužijí.
 *
 * `authorRole` — pěstoun nemá čtecí právo na `users/{staffUid}` (M4), takže
 * bublina "kdo psal" se vykresluje z týhle denormalizované hodnoty
 * ('staff'/'foster'), ne dotazem na autora — stejný důvod jako
 * `TimelineEntryDetail`'s `authorName="Klíčová osoba"` na `/moje`.
 *
 * `update`/`delete` jsou `if false` (append-only, stejně jako `timeline`).
 */
export interface MessageDoc {
  createdByOrgId: string
  createdByUid: string
  authorRole: 'staff' | 'foster'
  audience: SharingLevel
  body: string
  createdAt: string
}
