# CURRENT_STATE.md

> Čti tohle PŘED zadáním (viz ZADANI §11 bod 1: "čti mapu, ne území").
> Odkazuje na `ZADANI-PRO-NOVEHO-PROGRAMATORA.md` a `DESIGN_SYSTEM.md` v
> `../nove zadani/` — ty jsou zdroj pravdy pro CO a JAK, tenhle soubor jen
> říká CO UŽ JE HOTOVO a jaká rozhodnutí padla cestou.

## Druhé kolo oprav z reálného iPhone testu (2026-07-23)

Předchozí oprava pole Čas (Typ/Čas na vlastním řádku) fungovala jen v
Chromium testu, ne na SKUTEČNÉM iOS Safari — Petr poslal screenshot z
telefonu, pole Čas bylo poořád useknuté i na vlastním řádku. Skutečná
příčina: WebKitův `<input type="time">` má vlastní ovládací prvek s
minimální šířkou, kterou CSS `width` nedokáže zmenšit pod jeho
"přirozený" obsah — žádné množství přeskupení řádků to nevyřeší, dokud je
to pořád nativní time input. **Řešení: nahrazeno dvěma `<Select>`
(hodina/minuta)** — stejná komponenta jako Typ/Rodina, garantovaně stejné
bezpečné chování ve všech prohlížečích, žádné hádání s nativním
ovládacím prvkem. Minuty v PLNÉM rozsahu 00–59 (ne po 5), aby needitovaly
nepřesně existující události s "lichým" časem (živě ověřeno úpravou
události s časem 09:07 — zůstalo přesně 09:07, ne zaokrouhleno).

**"Zrušit" → "Smazat"** — Petrova zpětná vazba: ikona `Ban` (kruh se
škrtem, "zakázáno") vedle textu "Zrušit" nekomunikovala jasně, že tlačítko
maže/ruší událost. Nahrazeno `Trash2` ikonou + textem "Smazat" (mobilní
verze — desktopová `CalendarPage.tsx` zůstává "Zrušit událost", protože
podkladová akce je technicky jen změna stavu na `zruseno`, ne fyzický
delete, a mobilní/desktopová terminologie se už jinde v appce vědomě
liší dle kontextu použití).

Živě ověřeno (Playwright, mobilní viewport 390×844): oba `<Select>`
(hodina/minuta) měří jen ~72px, daleko od přetečení; "Smazat" tlačítko
přítomné, "Zrušit" beze stopy; úprava existující události s časem 09:07
zobrazí přesně 09/07 v selectech.

## PWA vizuál: styl aktuálního iOS + oprava formuláře + swipe (2026-07-22)

Petrovo zadání se 3 body: (1) "Nová událost" má pole mimo formát
(screenshot: pole Čas useknuté mimo viewport), (2) mezi dny Kalendáře by
mělo jít swipovat, (3) obecně appka "se trhá", chybí "mobile app feeling",
"nastuduj iOS a udělej appku do jeho stylu".

**Oprava formuláře** (`MobileCalendarPage.tsx`) — Typ+Čas byly vedle sebe
(`flex gap-3`, Čas `w-28`=112px); nativní `<input type="time">` má na iOS
Safari vlastní minimální šířku ovládacího prvku větší než 112px, takže
pole přeteklo mimo viewport. Opraveno tak, že Typ a Čas mají teď KAŽDÝ
vlastní řádek (žádné dvousloupcové vměstnávání) — živě ověřeno
(`boundingBox` pole Čas teď celé uvnitř 390px šířky).

**Swipe mezi dny** (`MobileCalendarPage.tsx`) — `onTouchStart`/`onTouchEnd`
na oblasti seznamu událostí (NE na pásu dnů výš, ten už scrolluje sám
vodorovně), práh 40px + poměr vodorovný/svislý pohyb 1.5:1 (ať nekoliduje
se svislým scrollem seznamu). Živě ověřeno syntetickými `TouchEvent`
(swipe vlevo/vpravo mění vybraný den správným směrem).

**Styl aktuálního iOS** — napříč VŠEMI mobilními stránkami:
- `IosList`/`IosListRow` (NOVÝ, `components/mobile/IosList.tsx`) —
  "seskupený seznam" (iOS Nastavení/Kontakty vzor): JEDEN zaoblený
  kontejner s tenkými dělítky mezi řádky a okamžitou dotykovou odezvou
  (`active:bg-overlay-active`), NAHRAZUJE dřívější samostatné orámované
  karty pro každou položku (to působilo víc Android/Material). Nasazeno
  v `MobileHomePage`, `MobileFamiliesPage`, `MobileFosterPersonListPage`,
  `MobileChildListPage`, `MobileFamilyDetailPage`, `MobileCalendarPage`,
  `MobileAccountPage`.
- Velké tučné nadpisy stránek (`text-[32px] font-bold tracking-tight`,
  iOS "Large Title" princip) místo `text-2xl font-normal` — konzistentní
  napříč všemi mobilními stránkami, nahrazuje dřívější nesourodou směsici
  velikostí písma (Petrovo "některá písma jsou malá a některá velká").
  Sekční nadpisy ("Dnes máte", "Pěstouni", "Děti" v profilu rodiny)
  sjednoceny na `text-[13px] font-semibold uppercase` (iOS "Section
  Header"), nadpisy vyjížděcích panelů na `text-[17px] font-semibold`
  (iOS "Headline").
- `BottomSheet.tsx` — vyjíždění/zavírání teď používá `cubic-bezier(0.32,
  0.72,0,1)` (stejná "spring" křivka jako iOS modální panely) místo
  mechaničtějšího `ease-out`, POZADÍ se prolíná (fade in/out) souběžně se
  slide animací, a zavření přes klik na pozadí/Escape si přehraje
  ZPĚTNOU animaci (`requestClose` → 320ms → teprve pak skutečné
  `onClose`), ne okamžité zmizení — živě ověřeno screenshotem uprostřed
  zavírací animace.
- Dotyková odezva (`active:scale-*`/`active:opacity-*`) přidána na
  tab bar položky, den-pásu čipy, zaměstnanecké filtr-čipy, šipky
  prev/next den, FAB tlačítka, telefonní odznaky — dřív jen barevný
  přechod bez okamžité vizuální odezvy na dotyk, což přispívalo k pocitu
  "trhavosti".
- `MobileShell.tsx` — dolní tab bar má teď `backdrop-blur-lg` +
  poloprůhledné pozadí (iOS "frosted glass" tab bar) místo plné barvy.
- `MobileAccountPage.tsx` — "Odhlásit se" přestavěno na VLASTNÍ červenou
  sekci seznamu (iOS Nastavení konvence — Sign Out je vždy samostatná
  skupina dole), ne sekundární tlačítko vedle textu.

Živě ověřeno (Playwright, mobilní viewport 390×844, emulátor): všech 7
mobilních stránek screenshotováno a vizuálně zkontrolováno, swipe funguje
oběma směry, pole Čas se vejde do viewportu, otevírací/zavírací animace
sheetu běží plynule (zachyceno uprostřed animace), žádné JS chyby.

## Hlasový záznam v terénu: oprava scrollu + zarovnání textu (2026-07-22)

Petrovo nahlášení: dlouhý živý přepis během nahrávání nešel scrollovat,
a "Zastavit"/"Odeslat do osy" se dostaly mimo viditelnou oblast a nešlo
na ně kliknout — `BottomSheet.tsx` měl `max-h-[88vh]` bez `overflow-y-auto`,
takže obsah delší než 88vh jen "protekl" mimo box místo aby scrolloval
(`overflow: visible` default). Opraveno na dvou úrovních:

- `BottomSheet.tsx` — přidán `overflow-y-auto`+`min-h-0` na kontejner
  jako obecná pojistka pro JAKÝKOLI dlouhý obsah v libovolném sheetu
  (i budoucím, ne jen `VoiceCaptureSheet`).
- `VoiceCaptureSheet.tsx` — živý přepis (krok "recording") má VLASTNÍ
  ohraničenou scrollovatelnou oblast (`min-h-0 flex-1 overflow-y-auto`),
  zatímco mikrofon + "Zastavit" zůstávají `shrink-0` (vždy na dohled, bez
  nutnosti scrollovat celý sheet). Stejně ošetřen textarea v review kroku
  (`min-h-[120px]` misto neomezeného `flex-1`).
- Na Petrovo přání živý přepis teď vypadá jako bublina zarovnaná
  DOPRAVA (`ml-auto max-w-[85%]`) s textem zarovnaným DO BLOKU
  (`text-justify`) — místo prostého centrovaného odstavce.

Živě ověřeno (Playwright, mokovaný `window.SpeechRecognition` s ~40 vět
dlouhým textem): `Zastavit`/`Odeslat do osy` zůstávají uvnitř viewportu
(`boundingBox().y + height <= 844`) i s velmi dlouhým přepisem, přepis
scrolluje uvnitř svého boxu, `ml-auto`/`text-justify` potvrzeno přes
computed styly (`marginLeft: 52.5px`, `textAlign: justify`).

## Pěstouni/Děti — mobilní varianta doplněna (2026-07-22, stejný den)

Petrovo zadání ("vždy mysli i na to, že to musí fungovat i na PWA") —
živě ověřeno na 390px viewportu: `FosterPersonListPage`/`ChildListPage`
(`AppShell` + `Sidebar`) byly na mobilu STEJNĚ nepoužitelné, jako
`FamilyListPage`/`CalendarPage` byly před M11 (sidebar zabíral polovinu
displeje, tabulka byla oříznutá) — desktopová stránka se prostě
nezmenšuje sama, musí se vyměnit celá (stejný princip jako zbytek M11).

- `MobileFosterPersonListPage.tsx`/`MobileChildListPage.tsx` — karty
  místo tabulky (stejný vzor jako `MobileFamiliesPage`), ťuknutí na
  telefon u pěstouna rovnou VOLÁ. Ťuknutí na kartu naviguje na mobilní
  profil RODINY (`/mobil/rodiny/:uid`) — VĚDOMĚ žádný samostatný mobilní
  profil pěstouna/dítěte: v terénu je cíl dohledat kontakt/rodinu, ne
  procházet vzdělávací sekce pěstouna nebo rodné číslo dítěte samotné.
- `FosterPersonsRoute`/`ChildrenRoute` (`App.tsx`) — stejný `useIsMobile`
  přepínací vzor jako `HomeRoute`/`FamiliesRoute`/`CalendarRoute`.
- Živě ověřeno (Playwright, 390×844): obě stránky se vykreslí jako karty
  (ne tabulka), ťuknutí správně naviguje na `/mobil/rodiny/:uid`, žádné
  JS chyby.

## Nové položky menu: Pěstouni, Děti (2026-07-22)

Petrovo zadání: hlavní menu má i plochý seznam pěstounů a dětí napříč
rodinami (dřív dostupní jen přes profil konkrétní rodiny, viz
`AppShell.tsx` komentář, co tohle už dopředu předpokládal).

- `FosterPersonListPage.tsx` (`/pestouni`), `ChildListPage.tsx` (`/deti`)
  — read-only tabulka (`Table`/`TableRow`, stejný vzor jako `StaffPage.tsx`),
  vyhledávání podle jména, klik na řádek naviguje na existující detail
  (`/rodiny/:uid/pestoun/:id` resp. `/rodiny/:uid/dite/:id`) — žádná nová
  detailní stránka, jen nový vstupní bod k té stávající.
- Data: `listFosterPersonsForOrg`/`listChildrenForOrg` (`familyService.ts`)
  — obě funkce UŽ existovaly (použité v `ExternalParticipantsPage`), žádná
  změna služby/rules nebyla potřeba. `familyId` (Firestore doc ID) → rodina
  (`uid`+popisek) mapováno přes `listFamiliesWithDocIds`, stejně jako
  `MobileFamiliesPage`.
- `Sidebar.tsx` (`NAV_ITEMS`) — dvě nové položky mezi "Rodiny" a
  "Zaměstnanci", `staffOnly: false` (viditelné pro všechny role stejně
  jako Rodiny/Kalendář).
- Živě ověřeno (Playwright, emulátor): obě stránky načtou seznam, klik na
  řádek naviguje na existující profil pěstouna/dítěte. Cestou odhalen a
  opravený jen testovací artefakt (ne appka) — seed skript používal jiné
  `projectId` než klientská `.env.local` konfigurace, takže `userDoc`
  appky neviděl `organizationId` (Firestore emulator `singleProjectMode`
  requestům nevadí, ale je nutné použít STEJNÝ projectId ve všech
  testovacích skriptech kvůli konzistenci).

## M11 rozšířeno na CELOU PWA appku (2026-07-22): Rodiny + Kalendář mobil, ErrorBoundary

Petrovo zadání po prvním kole M11 (viz sekce níže): "asi udělej celou pwa
app... raději vymazlená pwa aplikace než rychlý hnus" — mobilní verze měla
zatím jen `/` (domů), ale `/rodiny` a `/kalendar` zůstávaly desktopové
tabulky/mřížka, na 390px šířky prakticky nepoužitelné (`react-big-calendar`
tam byl "prázdný"/nefunkční). Doplněno tak, aby ŽÁDNÁ z hlavních čtyř
záložek (Domů/Rodiny/Kalendář/Účet) nekončila na desktopové stránce.

- `FamiliesRoute`/`CalendarRoute` (`App.tsx`) — stejný `useIsMobile`
  přepínací vzor jako `HomeRoute`, teď i pro `/rodiny` a `/kalendar`.
- `MobileFamiliesPage.tsx` — vyhledatelný seznam s velkými dotykovými cíli
  (ne zmenšenina `FamilyListPage` s checkboxy/hvězdičkami/segmentací).
  Živě nalezená chyba: bez per-rodinu lookupu primárního pěstouna
  (`resolveFamilyDisplayName(family, null)`) se u rodin bez ručně
  nastaveného `displayName` zobrazovala adresa DVAKRÁT (jednou jako
  "název" karty, jednou jako podtitulek) — opraveno doplněním
  `listFosterPersonsByRefs` (stejný vzor jako desktop `FamilyListPage`) +
  obrannou podmínkou `family.address !== label` v renderu.
- `MobileFamilyDetailPage.tsx` — zjednodušený profil na VLASTNÍ cestě
  `/mobil/rodiny/:uid` (ne stejná cesta jako desktop — profil rodiny má
  příliš mnoho desktopových sekcí, aby dávalo smysl je přepínat na jedné
  routě): jméno, adresa, pěstouni s `tel:` odkazy, děti, a FAB "Nadiktovat
  zápis" rovnou s předvyplněnou rodinou (`VoiceCaptureSheet`
  `initialFamilyDocId` prop).
- `MobileCalendarPage.tsx` — agenda styl (Things/Routine inspirace), NE
  zmenšenina mřížky: vodorovný pás dnů (±10 kolem "dnes") + svislý seznam
  událostí vybraného dne, filtr zaměstnanců jako chipy (jen když
  `staffList.length > 1`), plovoucí "+" FAB, ťuknutí na událost otevře
  `BottomSheet` formulář (znovupoužívá `createCalendarEvent`/
  `updateCalendarEvent`/`cancelCalendarEvent` — stejná služba jako
  desktop). Živě nalezená chyba: pás dnů se neposouval na vybraný den při
  prvním vykreslení (vybraný den byl mimo viditelnou oblast, žádný chip
  nesvítil) — opraveno `ref`+`useEffect(() => scrollIntoView(...), [selectedDate])`
  na vybraném dni.
- `calendarAggregation.ts` (`calendarEventToItem`/`agreementToNextVisitItem`)
  zpřísněno — vrací `null` místo `Invalid Date` objektu, když chybí/je
  neparsovatelné `start`/`end`/`validFrom`/`lastVisitAt`. Živé produkční
  data mohou mít historické nekonzistence, které čisté testovací fixtures
  nereprodukují, a `react-big-calendar` na `Invalid Date` uvnitř může
  spadnout layout engine. Volající (`CalendarPage.tsx`,
  `MobileCalendarPage.tsx`) filtrují `null` před dalším zpracováním.
- `ErrorBoundary.tsx` — JEDNA hranice nahoře kolem celého `<App>` stromu
  (appka je malá, není potřeba izolace po widgetech), zobrazuje přímo
  `error.message` (ne obecnou hlášku) — aktivně vyvíjená interní appka, kde
  konkrétní chyba pomůže rychleji diagnostikovat.

**Živě ověřeno** (Playwright, mobilní viewport 390×844, emulátor, skripty
smazány po testu): 6 kroků přes všechny 4 záložky (Domů → mikrofon,
Rodiny → detail s `tel:` odkazem, Kalendář → agenda → úprava události
sheetem, Účet) — bez JS chyb, den ve vybraném datu teď správně svítí v
pásu dnů.

## M11 hotové — mobil/PWA odlišení + layout oprava + Kalendář vizuál (2026-07-22, přes noc)

Petrovo přímé zadání s referenčními screenshoty (Routine.co kalendář,
Things 3 mobil): oprava globálního layout bugu, vizuální přestavba
Kalendáře, a hlavně skutečné postavení M11 (dřív jen SEAM "mobil/PWA
odlišení, patří do M11" — teď konkrétně zadané a postavené).

**Layout bug (`AppShell.tsx`)** — hlavní scrollovatelná oblast (varianta
BEZ `secondaryPanel`, používá ji většina appky) měla `px-8 pb-8`, ale
ŽÁDNÉ `pt-*` — obsah stránky proto začínal přesně pod 6px fade
gradientem, cítil se "nalepený" hned pod TopBarem. Přidáno `pt-6`.

**Kalendář — vizuální přestavba** (`calendar-overrides.css`,
`CalendarToolbar.tsx`) — `react-big-calendar` je záměrně nenastylovaná
knihovna ("bring your own CSS"), dřívější default vzhled byl PŘESNĚ tenhle
neupravený stav ("vypadá to jako z roku 1999"). Vlastní `Toolbar`
(znovupoužívá `Button`/`SegmentedTabs`, appka má tenhle pattern
konzistentně jinde), pastelové pozadí událostí + barevný levý okraj
(`lightenHex` helper) místo plné saturované barvy s bílým textem, tenčí
gridlines, měkčí "Dnes" zvýraznění, červená "teď" linka
(`.rbc-current-time-indicator`), zaoblené rohy + jemný stín na událostech.
Inspirace Routine.co (routine.co/solutions/individuals/calendaring),
neokopírováno 1:1 — react-big-calendar má jiné technické možnosti než
custom-built kalendář, tohle je nejlepší přiblížení v rámci knihovny.

**M11 — mobil/PWA odlišení, KONEČNĚ konkrétně zadané a postavené.**
Petrovo zadání: KO v terénu "nezajímá seznam klientů", hlavní potřeba je
nadiktovat zápis → AI souhrn → poslat do osy, inspirace Things 3 (velká
tlačítka, vyjížděcí panely odspoda, NENÍ to responzivní zmenšenina
desktopu).

- `useIsMobile.ts` — `matchMedia(max-width:768px)`, ne User-Agent sniffing
  (appka musí fungovat i v mobilním prohlížeči bez instalace PWA).
- `HomeRoute` (`App.tsx`) — na `/` rozhoduje šířka okna mezi `DashboardPage`
  (desktop) a novou `MobileHomePage` — VĚDOMĚ zúžený rozsah: JEN domovská
  obrazovka je mobil-first přestavěná, `/rodiny`/`/kalendar`/atd. zůstávají
  desktopové i na mobilu (SEAM pro budoucí rozšíření, ne zapomenuté —
  kompletní mobilní redesign celé appky je mnohem větší, samostatná dávka).
- `BottomSheet.tsx` — NOVÝ primitiv (odspoda, mobil) vedle `Drawer`u
  (zprava, desktop) a `Modal`u (centrovaný, desktop) — tři různé vzory pro
  tři různé kontexty, ne jeden univerzální komponent.
- `MobileShell.tsx` — dolní tab bar (Domů/Rodiny/Kalendář/Účet),
  `env(safe-area-inset-bottom)`, ŽÁDNÝ sidebar/TopBar.
- `MobileHomePage.tsx` — velké červené kolo s mikrofonem je VIZUÁLNĚ
  DOMINANTNÍ prvek obrazovky (ne malé tlačítko v rohu), dnešní vlastní
  naplánované události pod tím jako kontext, ne hlavní obsah.
- `VoiceCaptureSheet.tsx` — jádro celé mobilní appky: otevře se VŽDY už
  nahrávající (stejná konvence jako `VoiceRecorderPanel.tsx` §7.1),
  "Zastavit" → editovatelný přepis + "AI souhrn" (ZNOVUPOUŽÍVÁ
  `lib/ai.ts`, žádná duplicitní logika) + výběr rodiny (`Combobox`) →
  "Odeslat do osy" (`createNoteTimelineEntry`, `sharingLevel:'internal'`
  napevno — sdílení s pěstounem je rozhodnutí pro desktop s rozvahou, ne
  za jízdy mezi návštěvami). ZJEDNODUŠENO oproti desktopové verzi (žádné
  partner-sharing přepínače, žádné "Zařadit k" osobám zvlášť) — pole pro
  terén potřebuje rychlost, ne kompletní formulář.

**Živě ověřeno** (Playwright, mobilní viewport 390×844, emulátor, skripty
smazány po testu): mobilní tab bar + velké mikrofonní tlačítko se
vykreslí, ťuknutí otevře nahrávací sheet (grafické animace/chybové
hlášky fungují — "not-allowed" chyba je EN očekávaná, headless prohlížeč
nemá mikrofon), "Zastavit" přejde na review krok, textarea/Combobox
fungují, "Odeslat do osy" SKUTEČNĚ zapsal `timeline` dokument do Firestore
(ověřeno přímým čtením emulátoru po odeslání — `type:'note'`,
`sharingLevel:'internal'`, správný `subjectRefs`/`body`). Layout oprava a
Kalendář vizuál ověřeny screenshoty na desktop viewportu.

## Drobná oprava (2026-07-21, přes noc): nested `<a>` na seznamu Rodin

Úkol byl dohledat starou konzolovou hlášku "Encountered two children with
the same key" (zmíněnou u M4) — živě přes Playwright/emulátor NEreprodukováno
na žádné stránce (`/zamestnanci`, `/rodiny`, `/rodiny/:uid`, `/`) — nejspíš
už tichem opravená některým z pozdějších refaktorů (M5–M9, Kalendář).

Místo toho živě odhalena JINÁ, skutečná a reprodukovatelná chyba: řádek
seznamu Rodin (`FamilyListPage.tsx`) byl `<Link className="contents">`
(kliknutelný `<a>`), a uvnitř něj od UX dávky 2026-07-21 přibyl
`AddressLink` (taky `<a>`) — `<a>` uvnitř `<a>` je neplatné HTML, React na
to hlásí "cannot be a descendant of" (browser DOM tiše "opraví"
nepředvídatelně). Opraveno: řádek teď `<div onClick={() => navigate(...)}>`
místo `<Link>` (`useNavigate`), `AddressLink`ovo stávající
`stopPropagation` funguje beze změny. Živě ověřeno — varování zmizelo, klik
na řádek pořád naviguje na detail, klik na adresu pořád otevírá Mapy.

## Kalendář hotový (2026-07-21) — mimo dosud číslovanou M-řadu

Přímý požadavek 2026-07-21 ("skvěle udělaný kalendář s mnoha pohledy včetně
agendy a s možností přetahování… a s napojením na Google Kalendář"), NENÍ
to číslované M — sidebar odkaz `/kalendar` (`Sidebar.tsx`) byl od M0 mrtvý
(žádná routa, žádná stránka).

**Rozsah agregace (vědomě zúžený, viz `calendarAggregation.ts` pro plné
zdůvodnění):** kalendář agreguje ze DVOU zdrojů — vlastní
`organizations/{orgId}/calendarEvents` (nová kolekce, plně editovatelná
staff událost) a "další návštěva splatná" připomínky z aktivních Dohod
(READ-ONLY, počítáno stejnou logikou jako štítek na seznamu Rodin,
`familyAlertStatus.ts`, ne duplikováno). `scheduledActivities`/
`assistedContactSeries`/respit/předání dítěte VYNECHÁNY — jejich výskyty
nemají `organizationId` na samotném dokumentu (jen na rodiči), agregace
napříč celou organizací by vyžadovala buď N+1 dotazy, nebo denormalizaci
do už otestovaných kolekcí (schema změna se skutečným rizikem regrese) —
mimo rozsah týhle dávky, SEAM pro budoucí rozšíření.

**`firestore.rules`** — `organizations/{orgId}/calendarEvents/{id}`, jediná
kolekce v appce (mimo M1.5 importJobs rollback výjimku) se SKUTEČNÝM
`update` (na rozdíl od většiny appky, append-only) — potřebné pro
přetažení na jiný čas/den. `delete: if false` zůstává (§5 audit stopa),
"zrušit" v UI nastaví `status:'zruseno'`. Sdílený týmový kalendář —
KTERÝKOLI staff stejné organizace smí přesunout/upravit cizí událost.
`tests/rules/m9.calendarEvents.rules.test.ts`, 12 testů (119/119 celkem).

**UI (`CalendarPage.tsx`)** — `react-big-calendar` + `date-fns` (nové
závislosti, appka dřív neměla žádnou datumovou knihovnu) + drag-and-drop
addon, 4 pohledy (Měsíc/Týden/Den/Agenda), plně česká lokalizace,
barevné odlišení podle zaměstnance (deterministický hash uid→paleta) s
klikacím legend-přepínačem viditelnosti. Klik na volný slot = rychlé
založení (Modal), klik na vlastní událost = úprava/zrušení, klik na
agreement připomínku = deep-link na rodinu.

Živě odhalený a opravený bug: `withDragAndDrop` (CJS-only addon, žádný ESM
build) se přes Vite dev-server dep-optimizer importoval jako dvojitě
zabalený `{default:{default: fn}}` místo funkce — `unwrapDefault` helper
v `CalendarPage.tsx` odbaluje, dokud nenarazí na funkci. Druhý bug: pohledy
(Měsíc/Týden/Den/Agenda) se neuncontrolled `defaultView` nepřepínaly vůbec
(kliknutí na "Agenda" nic nedělalo) — opraveno na plně controlled `view`/
`onView`+`date`/`onNavigate`.

**Živě ověřeno** (Playwright, emulátor, skripty smazány po testu):
založení/úprava/zrušení události, přepínač viditelnosti podle zaměstnance
(skrytí správně schová událost), přepínání všech 4 pohledů. **NEOVĚŘENO
end-to-end**: samotné myší tažení (drag) v prohlížeči — tři pokusy
nasimulovat skutečné mouse down/move/up nespustily knihovnino vnitřní
rozpoznání gesta (headless Playwright vs. tahle konkrétní non-React
event-listener knihovna je známý třecí bod). Zapojení (`draggableAccessor`,
`onEventDrop`/`onEventResize` → `rescheduleCalendarEvent`) je podle kódu
správné a `.rbc-addons-dnd-resizable` wrapper se na události skutečně
vykresluje (potvrzuje funkční `draggableAccessor`) — ale samotné tažení
myší v reálném prohlížeči Petr sám ještě neověřil.

**"Synchronizovat s Google Kalendářem"** — dodatečně doplněno (viz níž,
"M10 + Google Kalendář sync") — teď skutečně funkční, ne jen SEAM tlačítko.

**Nedeployováno** (produkce zatím běží beze změny) — čeká na uživatelovo
"deploy asi necháme až po M10 a nebo i dál".

## M10 + Google Kalendář sync hotové (2026-07-21, přes noc)

Petr povolil Gemini Developer API + App Check (reCAPTCHA v3) ve Firebase
Console a dal Google OAuth Client ID — obojí umožnilo dokončit oba dřívější
SEAMy beze změny architektury (§10 "žádný vlastní backend").

**AI souhrn** (`lib/ai.ts`, `VoiceRecorderPanel.tsx`) — Firebase AI Logic,
`GoogleAIBackend` (Gemini Developer API), model `gemini-2.5-flash`. Tlačítko
vezme aktuální text zápisníku, pošle ho s českým promptem "učesat mluvenou
řeč, nic nevymýšlet" a nahradí `body` výsledkem — surový text PŘED úpravou
se uloží do `originalTranscript` (pole bylo v `TimelineEntryDoc` už
připravené od M3, nikdy nepoužité). Druhé kliknutí učeše aktuální (i ručně
doupravený) text znovu, ale `originalTranscript` zůstává PRVNÍ surová verze.

**Živě odhalený a opravený bug (vážný — týkal se přihlášení, ne jen AI):**
`initializeAppCheck` na SDÍLENÉ primární `FirebaseApp` instanci (`firebase.ts`)
způsobil, že Auth SDK na téže instanci začal ke KAŽDÉMU požadavku (i
přihlášení) čekat na App Check token — když reCAPTCHA skript nešel načíst
(pomalá/blokovaná síť ke `google.com`), přihlášení VISELO/PADALO, ne jen AI
tlačítko. Oprava: App Check teď běží na VLASTNÍ, druhé `FirebaseApp`
instanci (`lib/ai.ts`, `initializeApp(firebaseConfig, 'ai-logic')`) — stejný
izolační vzor jako `secondaryAuth.ts` (tam kvůli Auth session, tady kvůli
App Checku). Primární app (Auth/Firestore/Storage) se App Checku vůbec
nedotkne. Živě ověřeno v obou stavech (s bugem přihlášení viselo, po opravě
funguje) přes emulátor.

**Google Kalendář sync** (`lib/googleCalendar.ts`, `CalendarPage.tsx`
`handleGoogleSync`) — VÝHRADNĚ klientský tok, Google Identity Services
"token client" (`initTokenClient`/`requestAccessToken`), ŽÁDNÁ Cloud
Function, ŽÁDNÝ uložený refresh token. Vědomé rozhodnutí: GIS token client
dává jen krátkodobý (~1h) access token, ne refresh token (ten vyžaduje
Authorization Code flow s client secretem = server na výměnu) — token proto
žije JEN v paměti modulu, nikdy ve Firestore (nulová nová security
expozice). Sync je push-only, VÝHRADNĚ vlastní naplánované události
(`assignedToUid === userDoc.uid`) do VLASTNÍHO Google Kalendáře
přihlášeného uživatele — appka nikdy nepíše do cizího kalendáře. Nové pole
`CalendarEventDoc.googleEventId` (insert vs. update rozlišení, ať
opakovaný sync nezaloží duplicitní událost) — ŽÁDNÉ nové `firestore.rules`
nebylo potřeba (existující `update` pravidlo pole nijak neomezuje), ověřeno
2 novými regresními testy v `m9.calendarEvents.rules.test.ts` (121/121
celkem). Mazání/"zrušeno" se na Google stranu zatím nepropaguje (SEAM).

**Živě ověřeno** (emulátor, Playwright, skripty smazány po testu):
přihlášení funguje s App Checkem zapnutým i vypnutým (potvrzuje opravu),
kalendář a tlačítko "Synchronizovat" reagují správně, chybová hláška při
nedostupnosti Google skriptu se zobrazí čitelně a appka nespadne.
**NEOVĚŘENO**: skutečný OAuth popup + zápis do reálného Google Kalendáře —
tahle sandboxová session nemá výstup na `google.com`/`googleapis.com`
(potvrzeno i obyčejným `curl`), takže první opravdový test bude muset
udělat Petr live kliknutím na "Synchronizovat".

## M9 hotové — Chat (2026-07-21)

Navazuje přímo na `sharing.ts` §7.4 doc komentář ("budoucím chatem
(`messages.audience`, M9)") a `/moje` placeholder ("Chat zatím
připravujeme"). Nová podkolekce `families/{familyId}/messages/{id}`
(`types/message.ts`) — na rozdíl od `timeline` (VÝHRADNĚ staff zakládá) je
tohle OBOUSMĚRNÉ vlákno, jedno na rodinu (ne per dítě/pěstoun).

**`audience` pole** (`SharingLevel`, jiné jméno než `timeline.sharingLevel`,
stejný typ — "jeden mentální model sdílení" per §7.4): staff smí zapsat
`'foster'` (skutečná zpráva) i `'internal'` (poznámka k vláknu, kterou
pěstoun nikdy neuvidí — HelpScout/Intercom "note vs. reply" vzor, přepínač
"Jen interní poznámka" v composeru). Pěstoun smí VÝHRADNĚ `'foster'`.
`'private'`/`'ospod'` v chatu nedávají smysl (dvoustranná konverzace, OSPOD
nemá portál) a nikde se nepoužívají, i když typ je sdílený.

**`firestore.rules`** — nový blok `{path=**}/messages/{messageId}`, DVA
disjunkty na `create` (staff/`sameOrg`+aktivní Dohoda, pěstoun/vlastní
rodina), staff čte celé vlákno, pěstoun jen `audience=='foster'` (musí
zrcadlit `mojeService.listFosterVisibleMessages` dotaz, §5 "List dotaz vs.
pole v pravidle"). `update`/`delete` `if false` (append-only). Spolupracovník
(M9 Spolupracovník, `isStaff()` vyloučen) NEMÁ k chatu přístup vůbec — není
v seznamu jeho modulů, žádný carve-out. Nová sada
`tests/rules/m9.messages.rules.test.ts` (15 testů, 107/107 celkem zeleně).

**Žádný `onSnapshot`** (§10 "jediný listener v appce = vlastní profil") —
manuální reload-po-akci stejně jako zbytek appky, doplněné tlačítkem
"Obnovit" na staffové straně pro ruční kontrolu nových zpráv.

**UI** — nová záložka "Chat" na `FamilyDetailPage`
(`FamilyChatSection.tsx`), a plně funkční "Chat s klíčovou osobou" karta na
`/moje` (`MojeDashboardPage.tsx`, dřív jen "připravujeme" placeholder).
Bubliny rozlišené zarovnáním (pěstoun vlevo, staff vpravo) a stylem
(interní poznámka = přerušovaný okraj + žlutý štítek "Jen tým"). Pěstoun
vidí autora staff zpráv jako generickou "Klíčová osoba" (M4 vzor — nemá
čtecí právo na `users/{staffUid}`).

**Živě ověřeno end-to-end** proti lokálnímu emulátoru (Playwright, dočasný
skript smazán po testu) — staff odeslal zprávu pěstounovi + internal
poznámku, pěstoun (přes SKUTEČNÝ magic-link tok, `sendSignInLinkToEmail` +
emulátorový `oobCodes` endpoint, ne obchvat) viděl foster zprávu a NEviděl
internal poznámku, odeslal odpověď, staff ji po "Obnovit" uviděl. Mimochodem
tím poprvé živě ověřen i samotný M4 magic-link klik, dřív vedený jako
neověřený SEAM.

## M8 hotové — plný grant/permission engine (2026-07-21)

Navazuje na M6+M7 seam ("`externalParticipantService.ts` má jen minimální
CRUD, plný engine je M8"). Datový model (`GrantDoc`, `PERMISSION_KEYS`,
`SENSITIVE_PERMISSIONS`, `ExternalRoleTemplateDoc`) byl už navržený v
`types/externalParticipant.ts` z dřívějška, jen nepoužitý — M8 ho
doimplementoval, nemusel se vymýšlet od nuly.

**Grant lifecycle** (`externalParticipantService.ts`): necitlivé oprávnění
= `grantDirect` (1 krok, rovnou `active`). Citlivé (`viewMedical`,
`signDocuments`, `chatWith`, `videoCalls`) = `requestGrant→approveGrant→
activateGrant`, 3 KROKY/3 ROLE (ne nutně 3 různí lidé — čteme "3 aktéři"
jako 3 role v řetězci): KO/asistent/org_admin žádá → org_admin/vedoucí
pobočky/teamleader schvaluje → **jen org_admin** aktivuje (samostatný, užší
gate). `revokeGrant` vždy nastavuje `validTo`, nikdy delete — grant dokument
nejde smazat vůbec (`allow delete: if false` na serveru, viz níž).

**firestore.rules** — nový blok `external_participants/{epId}/access/
{childId}/grants/{grantId}` (žádný vlastní `organizationId`, scoping se
čte z rodičovského externisty přes `get()`, stejná "list/rules musí
zrcadlit scoping" past jako u M1.5 importJobs). Rules vynucují přesně tytéž
přechody jako service vrstva — klient nemůže sensitivní grant zapsat rovnou
jako `active`, ani přeskočit roli u schválení/aktivace/revoke. Nový blok
`organizations/{orgId}/externalRoleTemplates/{id}` — jen zkratka pro
vyplnění formuláře, NE pro obejití schvalování.

**§5.1 povinná rules test sada** (`tests/rules/m8.rules.test.ts`, 13
testů) — na rozdíl od M6+M7 (kde emulátor na tehdejším stroji nešel
spustit) tentokrát **skutečně spuštěno a zeleně prošlo** (77/77 včetně
m0-m2/m1.5), protože emulátor v aktuálním prostředí běží bez potíží. Zároveň
opraven skrytý config bug: `vitest.config.ts`'s `include: ['src/**/*.test.ts']`
dělal `npm run test:rules` mrtvý ("No test files found") bez ohledu na
emulátor — vyčleněna `vitest.rules.config.ts` (`fileParallelism: false`,
protože všechny rules test soubory sdílí jeden Firestore emulátor a
souběžné `clearFirestore()` volání si navzájem mazaly rozdělaná data).

**UI** (`/externiste`, `ExternalParticipantsPage.tsx`) — seznam
externistů + přidání + správa přístupů. **SEAM, vědomě zjednodušeno**:
dítě se vybírá zadáním ID ručně (zkopírovaného z URL `/rodiny/:uid/
dite/:childId`), ne přes rodina→dítě picker — pořádný picker je mimo
rozsah týhle dávky, appka jinak dítě podle ID už umí zobrazit. Šablony
rolí (`externalRoleTemplates`) mají hotový backend+rules, ale ŽÁDNÉ UI
zatím (čistě zkratka pro vyplnění formuláře, není blokující pro funkční
grant engine — případně M9+).

**Nasazeno:** `deploy:rules` (nový rules blok) + `deploy:hosting`
(nová stránka/routa) na `production` (`v10c-doprovazeni-com`) přes
dedikovaný `claude-deploy` service account (role Firebase Admin, jen
tenhle projekt).

## UX přestavba profilových stránek (2026-07-20): rodina/Dohoda/pěstoun/dítě

Po ověření M6+M7 dávky poslal Petr ostrou zpětnou vazbu se 4 body a dvěma
Magnific screenshoty — `FamilyDetailPage` byla jedna obrovská souvisle
scrollovatelná stránka (Dohoda+Pěstouni+Děti+Časová osa+Dokumenty+Report+
7 M6/M7 sekcí za sebou), vůbec nepodobná tomu, jak appka řeší Nastavení
(`AppShell` `secondaryPanel`, schválený vzor). Přestavěno na PLÁN
schválený přes `EnterPlanMode`/`ExitPlanMode` (soubor
`crystalline-percolating-ripple.md`), pak implementován beze změn oproti
plánu:

**4 stránky místo 1** — `FamilyDetailPage.tsx` je teď HUB
(`secondaryPanel`: Přehled/Časová osa/Dokumenty) odkazující na 3 NOVÉ
profilové stránky: `AgreementDetailPage.tsx` (`/rodiny/:uid/dohoda` —
Přehled + IPPD + nová **Nebezpečná zóna** komponenta, kde teprve teď žije
"Ukončit Dohodu", dřív hned vedle nadpisu na hubu),
`FosterPersonDetailPage.tsx` (`/rodiny/:uid/pestoun/:id` — Přehled +
Vzdělávání a dávky + Přihlášky na kurzy + Plán vzdělávání, tři
již existující samostatné M7 komponenty jen přestěhované z `.map()`
smyčky na hubu), `ChildDetailPage.tsx` (`/rodiny/:uid/dite/:id` — Přehled
+ Podpůrné aktivity a výdaje). `FamilyCareEventsSection` (respit/
asistovaný kontakt/předání) ZŮSTÁVÁ na hubu — respit typicky pokrývá víc
dětí najednou, nedá se čistě rozdělit na jedno dítě (vědomá volba,
zdokumentovaná v plánu, dá se přehodnotit).

**Druhá úroveň navigace BEZ vlastních rout** — na rozdíl od `SettingsNav`
(skutečné `NavLink` routy) používá nová `ProfileSectionNav.tsx`
komponenta lokální React state (`useState` sekce), ne URL — sekce jedné
entity sdílejí JEDNO načtení dat, přepnutí sekce nemá znovu fetchovat
rodinu/pěstouna/dítě. Vizuálně identické `SettingsNav` (stejné CSS
třídy), jen `button` místo `NavLink`.

**Editovatelný název rodiny** — `FamilyDoc.displayName?: string` (nové
volitelné pole, ŽÁDNÁ migrace stovek seedovaných rodin nepotřeba, fallback
řetězec `resolveFamilyDisplayName()` v `src/lib/familyDisplayName.ts`:
`displayName ?? primární pěstoun ?? adresa ?? UID`). Tužka vedle H1 →
inline `Input` + Uložit/Zrušit → `familyService.updateFamilyDisplayName`.
Použito i v breadcrumbu na všech 4 stránkách a v `FamilyListPage`
sloupci (dřív "Adresa", teď "Rodina").

**`src/components/ui/danger-zone.tsx`** — nová, znovupoužitelná
komponenta (`DangerZone`/`DangerZoneAction`) přesně dle Magnific
screenshotu (orámovaný box, varovný text nahoře, potvrzovací krok před
samotnou akcí) — zatím jediné použití je "Ukončit Dohodu", ale Magnific
má tenhle vzor na víc věcí, počítáno dopředu s dalším použitím.

**Živě ověřeno** na reálných seedovaných datech (`cechy-family-1`,
přihlášení jako `hana.bartosova@cechy-doprovazeni.cz`): editace názvu
rodiny se uloží a přežije reload, Dohoda/pěstoun/dítě odkazy správně
navigují, IPPD/Vzdělávání/Kurzy/Plán/Podpůrné aktivity na nových
stránkách správně ukazují dřívější seedovaná data (potvrzuje, že přesun
z `.map()` smyčky na samostatné stránky nic neztratil). Danger Zone
vizuálně ověřena (potvrzovací krok, popisky) — samotné kliknutí "Ukončit
Dohodu" na živých seed datech ZÁMĚRNĚ nevyzkoušeno (nevratná změna stavu
Dohody na datech, která si Petr chce sám projít).

**Nasazeno:** jen Hosting (`npm run deploy:hosting`) — žádná nová/
změněná Firestore rules ani index (nové pole `displayName` je pod
existujícím `families/{familyId}` update pravidlem, které nerestrikuje
jednotlivá pole mimo `orgAccessList`, ověřeno čtením pravidla PŘED
nasazením, ne až po chybě).

## M6+M7 hotové — NOVE-ZADANI-M6-AZ-KONEC.md (2026-07-20)

Po retrofitu Petr poslal `NOVE-ZADANI-M6-AZ-KONEC.md` (722 řádků) jako
JEDINÝ zdroj pravdy pro M6 dál — starý `ZADANI-PRO-NOVEHO-PROGRAMATORA.md`
přejmenován na `old__ZADANI-PRO-NOVEHO-PROGRAMATORA (2).md` a platí jen pro
M0-M5. Zadání: "udělej dohromady M6 a M7, pak vytvoř rozsáhlý seed data...
tvoje testy až po dokončení programování... pokud narazíš na něco co ti
nebude jasné, vymysli to" — celá dávka (backend + UI + seed + verify +
deploy) proběhla v jednom průchodu bez mezipauzy na schválení.

**M6 (§A.1/§A.2) — report pro OSPOD:** `ospodReportService.ts` — report
NENÍ zvláštní entita, jen vygenerovaný `document` (M5 stroj beze změny) s
markdownem sestaveným z `timelineService.listTimelineEntriesForPeriod`
(nový, period-bounded dotaz, VŽDY vyřazuje `sharingLevel:'private'`, ne jen
cizí jako `listTimelineEntries`). UI: `OspodReportSection.tsx` na
FamilyDetailPage, tlačítko "Vyplnit report" → formulář (období, název) →
naviguje rovnou na editor dokumentu.

**M7 satelitní moduly (§B.1-B.10) — typy/služby/rules/indexy pro:**
rate/policy kaskáda (`legislativeParameterService.ts`, obecný
`cascadeResolution.ts` znovupoužitý pro obě), plán vzdělávání
(`educationPlanService.ts`), kurzy/dávky/přihlášky
(`courseService.ts`), IPPD (`ippdService.ts`), respit + oprava směru
platby u Pobytu (`respitEventService.ts`, RODINA platí stravu/ubytování,
organizace jen doplácí nad §5f strop), naplánované aktivity + podpůrné
výdaje (`scheduledActivityService.ts`/`supportExpenseService.ts`), SPVPP
koše (`spvppService.ts`), inspekce kvality (`inspectionService.ts`,
sebehodnocení odloženo na M12 checklist engine dle vlastní sekvence
zadání), zájemci o pěstounství (`fosterProspectService.ts`), asistovaný
kontakt + předání dítěte (`assistedContactService.ts`), minimální
`externalParticipantService.ts` (plný grant engine je M8).

**Vědomě odloženo (SEAM, ne přehlédnuto):** poskytovatelský portál
(`/poskytovatel/*`, magic-link bez loginu) — status přechody řídí přímo
KO v appce; katalog institucí (`institutions/{id}`); checklist engine +
sebehodnocení standardů (M12); plný externalParticipant grant/permission
engine (M8); UI pro entitlements/billing (`plan.tier` zůstává bez
enforcementu, jako celou dobu předtím).

**UI vrstva** (dodatečně, po backendu) — 7 nových sekcí na
`FamilyDetailPage.tsx` (Report pro OSPOD, Vzdělávání a dávky ×per
pěstoun, Přihlášky na kurzy ×per pěstoun, Plán vzdělávání ×per pěstoun,
IPPD ×1, Respit/asistovaný kontakt/předání ×1, Podpůrné aktivity a výdaje
×per dítě) + 2 nové organizační stránky (`/kvalita`, `/zajemci`) + 4 nová
dashboard hlídání (`dashboardService.listOperationalAlerts` — IPPD po
termínu, nápravná opatření inspekcí, uspávající se zájemci, zapomenutá
asistovaná setkání). Courses/enrollments/education-plan/IPPD workflow UI
jsou zjednodušené (KO/staff přímo spouští kroky, co v zadání patří
foster-portálu/magic-linku — ten není postavený, viz seam výš).

**Živé nálezy a opravy (živě ověřeno v prohlížeči, ne jen tsc/build):**
1. `assistedContactService.listAssistedContactSeries`/`listChildHandovers`
   PŮVODNĚ dotazovaly bez `where('organizationId', ...)`, i když jejich
   `firestore.rules` čtou `resource.data.organizationId` přímo — 4. nález
   stejné "list dotaz musí zrcadlit pravidlo" pasti v týhle kódové bázi
   (po M3 timeline, M4 timeline, M5 versions). Opraveno přidáním filtru.
2. `dashboardService.findForgottenOccurrencesForOrg` PŮVODNĚ dělal
   `collectionGroup(db,'assistedContactSeries')` — bez explicitního
   indexu (na rozdíl od `agreements`/`documents`, které TAKOVÝ index už
   měly z dřívějška) spadl na `failed-precondition`. Opraveno přepsáním na
   stejný trik jako `ippdService.listIppdsNeedingAttention` (fanout přes
   existující indexovaný `agreements` collectionGroup + přímé, ne-group
   dotazy per rodina) — žádný nový index nakonec nebyl potřeba.
3. **Stale-closure bug** v `FamilyCareEventsSection.tsx` (`RespitSubsection`)
   — `reloadStats()` čte `children` prop uvnitř `useEffect` závislého jen
   na `[familyDocId]`; `familyDocId` je dostupné z FamilyDetailPage DŘÍV
   než `children` (samostatný state update přes `await` hranici, stejný
   jev jako u `recordablePeople`/Giant Timeru), takže efekt jednou proběhl
   s prázdným polem a nikdy znovu — "0 dní čerpáno" i pro dítě se
   seedovaným respitem. Opraveno přidáním `children` do pole závislostí.
   **Objeveno jen díky živému testu na seed datech s reálným dítětem** —
   tsc/lint/build/vitest tohle nezachytí, žádný z nich nespouští komponentu.

**Seed data** (`scripts/seed-large.mjs`, `npm run seed:large`) — REST API +
`gcloud auth print-access-token` (stejná technika jako `seed-demo-org.mjs`,
žádné firebase-admin). 3 organizace (`org-cechy`/`org-morava`/`org-slezsko`,
orgCode alokován ze SKUTEČNÉHO `systemCounters/orgCode`), každá 1 ředitel/
ředitelka (org_admin) + 5 klíčových osob (VŠECHNY reálné Firebase Auth účty,
heslo `heslo123`), rozložení Dohod na KO záměrně [15,16,17,20,24] apod. —
vždy aspoň 2 KO nad platformní výchozí práh 19. Celkem 269 rodin, ~430
pěstounů, ~390 dětí (0-3 na rodinu, vážené rozdělení), `careType`/
`lastVisitAt` (krize/blíží se lhůta/v klidu/nikdy) náhodně rozmanité pro
smysluplné testování dashboardu. Jedna "vzorová" rodina na organizaci
navíc dostala PO JEDNOM příkladu z každého M6/M7 modulu (IPPD, kurz,
plán vzdělávání, respit, aktivita, výdaj, asistovaný kontakt, předání,
inspekce, zájemce) — živě ověřeno přihlášením jako `hana.bartosova@
cechy-doprovazeni.cz` (heslo `heslo123`): kapacitní varování "2 klíčových
osob má překročenou kapacitu (20/19, 24/19)" i "Provozní upozornění"
(nápravné opatření + uspávající se zájemce) se objevily přesně dle
seedovaných dat.

**Nasazeno:** `firestore.rules` + `firestore.indexes.json` (jen JEDEN
nový composite index, `fosterProspects` organizationId+createdAt) i
Hosting (`https://v10c-doprovazeni-com.web.app`) — `npm run deploy:rules`
+ `npm run deploy:hosting`, oba zelené.

**Ověřeno:** `npx tsc -b --force` (0 chyb), `npm run lint` (0 chyb, jen 4
staré/kosmetické warningy — `no-children-prop` na 3 nových sekcích, co
mají prop doslova jmenovaný `children`, a 1 předexistující
`exhaustive-deps` na `DocumentDetailPage.tsx`), `npm run build`, `npm run
test -- --run` (7/7). **`npm run test:rules` NELZE spustit na tomhle
stroji** (JDK < 21, stejný předexistující blokér jako M0 — Firestore
emulátor vyžaduje Java 21+, nikdy se nepodařilo rozchodit na tomhle
stroji přes M0-M7). Rules review proto proběhl jen manuální (systematická
kontrola KAŽDÉHO nového list dotazu proti odpovídajícímu pravidlu) + živé
ověření v prohlížeči proti produkci — ne automatizovaná sada.

### TODO / otevřené seamy (M6+M7)

- UI pro courseEnrollment pokročilé podtoky (`travelReimbursement`,
  `multiDayAccommodation`, `isFosterReimbursement`) je jen read-only
  poznámka, žádný editor — data model existuje, formulář ne.
- Historie respitEvents (tabulka minulých záznamů) není na FamilyDetailPage
  postavená, jen aktuální součet dní za rok.
- `legislativeParameters` admin UI (superadmin nastavuje sazby/politiky)
  není postavené — kaskáda funguje, ale jen s `DEFAULT_RATE_VALUES`
  (většina jsou ROZUMNÉ ODHADY, ne ověřené právní částky, viz komentář v
  `types/legislativeParameter.ts`) dokud někdo neuloží první override.
- `respitEventService`/`assistedContactService`/`scheduledActivityService`
  nemají žádnou vlastní rules-unit-test sadu (stejný stav jako zbytek M6+M7
  — blokováno JDK, viz výš).

## Retrofit na M0–M5 hotový — DOPLNENI_ZADANI-DO-M5.md (2026-07-20)

Petr po M5 poslal `nove zadani/DOPLNENI_ZADANI-DO-M5.md` — cílený seznam
tří doplnění k už postaveným modulům (kapacita KO, partnerské sdílení,
45denní varování), NE nové zadání od nuly. Zpracováno přes průzkumný
Workflow (4 paralelní research agenti zmapovali přesný současný stav před
jakoukoli editací) + přímá implementace + živé ověření. **Petr výslovně
požádal počkat s M6 a dál** — pracuje na aktualizovaném zadání, tohle je
poslední krok před pauzou.

**§1 Kapacita KO — FTE váha, tříúrovňová kaskáda:**
`checkKoCapacity` teď počítá efektivní práh = `(per-KO
capacityThresholdOverride ?? organizace.koCapacityThreshold ?? platformDefaults.
koCapacityThreshold) × users/{uid}.fte` (`src/lib/capacityThreshold.ts`,
zaokrouhleno dolů). Platformní výchozí = 19 (dřív flat 25 na organizaci).
`organizations.capacityWarningThreshold` PŘEJMENOVÁNO na
`koCapacityThreshold` a nově VOLITELNÉ (dřív se vždy nastavovalo na 25 při
registraci — teď se nenastavuje vůbec, aby kaskáda mohla spadnout na
platformní úroveň). Nová `platformDefaults/global` kolekce (superadmin-only
zápis, čtení pro každého přihlášeného) — **první superadmin-only stránka v
celé appce** (`/platforma`, nikdy dřív nic takového neexistovalo, ověřeno
před stavbou). Nová `CapacityRing` komponenta (`components/ui/capacity-ring.tsx`,
Dodatek §6.10 do `DESIGN_SYSTEM.md`) — kruhový ukazatel, `--danger-solid` +
jemný pulz nad prahem (NE `--crisis`, ta je podle §2.3 vyhrazená rodinné
krizi). `/zamestnanci` teď má sloupec "Kapacita" (ring + kliknutím
otevíratelná úprava FTE/override) a `/` (Dnes) souhrnný banner "N klíčových
osob má překročenou kapacitu" pro org_admin/vedení
(`agreementService.listOverCapacityKos`, jeden `collectionGroup` dotaz nad
CELOU organizací, ne N dotazů na KO). **Živě ověřeno**: nastavení
override (2/3 → uloženo, reload potvrdil), banner se objevil po překročení
a zmizel po vyčištění testovacího override.

**§2 Partnerské sdílení — KRITICKÝ NÁLEZ před implementací:** `sharingLevel:
'foster'` se dnes NIKDE reálně nenastavoval — `VoiceRecorderPanel` měl jen
binární "Soukromá poznámka" (private/internal), M3 zjednodušení (viz starší
Dodatek) plný 4-úrovňový model odložilo "na budoucí chat/dokumenty", které
teprve TEĎ přišly. Znamená to, že "Sdílené zápisy" na `/moje` byly od M4
VŽDY prázdné, bez ohledu na cokoli — zadání §2 implicitně předpokládalo, že
tahle cesta už funguje ("žádná retrofit práce pro [toggle ZAPNUTO]
případ"), což v týhle kódové bázi nebyla pravda. **Rozhodnutí (odůvodněné,
ne tiché):** přidán NOVÝ, samostatný přepínač "Sdílet s pěstounem" (výchozí
VYPNUTO, mutually exclusive se "Soukromá poznámka"), který teprve
umožňuje `sharingLevel:'foster'` vůbec nastat — "Sdílet s oběma pěstouny"
(přesně dle zadání, výchozí z `family.partnerSharingDefault`) je pak
NEZÁVISLÝ sub-přepínač, co řídí JEN `subjectRefs` scoping (family-level
vs. konkrétní `{kind:'fosterPerson'}`, nahrazuje, ne doplňuje) — a tenhle
scoping platí i pro `fosterPersons.lastVisitAt` stamping u návštěv,
NEZÁVISLE na sharingLevel (návštěva proběhla, ať se zápis sdílí nebo ne).
Nová `firestore.rules` `or()` větev pro fosterPerson-scoped čtení (zrcadlí
family-branch vzor, žádný nový index — existující `sharingLevel`+
`subjectRefs`+`occurredAt` index má stejný tvar polí). `mojeService`
spouští DVA paralelní dotazy (family-scoped + fosterPerson-scoped) a
merguje/dedupuje klientsky — vědomě NE jeden `array-contains-any` dotaz,
i když by teoreticky mohl fungovat, protože tenhle projekt už 3× narazil
na "list dotaz musí přesně zrcadlit pravidlo" past a tady radši
obezřetnost než elegance.

**Živě ověřeno (§2):** výchozí chování (žádný toggle) → `sharingLevel:
'internal'`, `subjectRefs` obsahuje family-level ref — BEZE ZMĚNY, přesně
jak zadání žádalo. "Sdílet s pěstounem" ZAPNUTO + "Sdílet s oběma"
VYPNUTO + vybraná Marie → `sharingLevel:'foster'`,
`subjectRefs:[{kind:'fosterPerson',id:'demo-foster-1a'}]` (family ref
SPRÁVNĚ chybí) — ověřeno přímým čtením zapsaného Firestore dokumentu, ne
jen UI. Validace (musí vybrat přesně jednoho pěstouna, když je "oběma"
vypnuté) funguje.

**Co NEBYLO živě ověřeno (SEAM, stejná kategorie jako M4/M5):** že
pěstoun s `fosterPersonRef:'demo-foster-1a'` skutečně VIDÍ tenhle
fosterPerson-scoped zápis na `/moje` a že DRUHÝ partner (`demo-foster-1b`)
ho VIDĚT NEMŮŽE — chybí reálný pěstounský testovací účet (stejný
dlouhodobý blokér jako M4 magic link). Rules logika je odvozená 1:1 ze
stejného, už ověřeného family-branch vzoru a je bezpečná "by construction"
(`hasAny` proti poli, co fosterPerson-scoped zápis nikdy neobsahuje pro
druhého partnera), ale skutečné dvoustranné ověření zůstává na Petrovi.

**§3 Dashboard, 45denní mezistupeň:** `listFamiliesAwaitingVisit` teď vrací
`visitStatus: 'waiting'|'warning'|'crisis'` místo `crisis: boolean` —
`'warning'` při PLOCHÝCH 45 dnech (zadání: "natvrdo, ne konfigurovatelné"),
nezávisle na `visitIntervalDays` dané Dohody (na rozdíl od "waiting"
prahu, který zůstává relativní, `visitIntervalDays - 15`). `FamilyCard`
dostal nový žlutý badge "Blíží se lhůta" (`--warning`/`--warning-bg`,
stejný token už použitý jinde v appce, žádná nová barva) vedle
nezměněného červeného "Krize". Zároveň integrováno s §2: pokud se
`fosterPersons.lastVisitAt` mezi partnery rozejde (nesdílená návštěva),
zobrazí se DRUHÝ, samostatný řádek varování jmenovitě za toho partnera,
komu lhůta reálně běží (`FamilyCard.secondaryWarning`).

## M5 hotový — Dokumenty, schvalovací workflow §6 A1 (2026-07-20)

Plný 12-stavový automat: `draft → foster_review → (commented|approved_foster)
→ final → mgmt_review → closed*|sent|filed`. Typy/rules/indexy/service
vrstva + čtyři UI plochy: sekce na `FamilyDetailPage`, `DocumentDetailPage`
(editor + všechny KO/vedení akce podle stavu), globální `/dokumenty`
(napříč rodinami organizace, dřív mrtvý odkaz v Sidebaru), a `/moje`
schvalovací pohled pro pěstouna (Schválit/Okomentovat).

**Dvě interpretační rozhodnutí** (zadání nedefinuje přesně, řešeno
odůvodněnou volbou, ne mlčky):
1. `closed_ko_unapproved` sleduje, jestli krok 5 provedl PŘÍMO přiřazený
   KO Dohody (`agreement.assignedTo`), ne jen libovolný staff — dva
   nezávislé příznaky (`fosterApprovedAt`/`assignedKoApprovedAt`), ze
   kterých `documentService.deriveClosedStatus()` odvodí koncový stav;
   vedení nevybírá ručně ze 4 tlačítek.
2. PDF/DOCX export s UID/verzí/hashem/QR (001-IDENTITY_MODEL.md §7) je
   SEAM — UID/hash/verze/QR se ukazují na obrazovce a v `/d/:uid`
   ověřovací stránce od prvního uložení, ale generování staženého
   PDF/DOCX souboru je mimo rozsah týhle dávky (potřebuje novou knihovnu).

**Tři skutečné produkční bugy odhalené a opravené živým testem** (ne
uhodnuté, viz `feedback_firestore_list_query_and_index_gotchas.md`):
1. `counters/{orgId}_{typ}` čtecí pravidlo (`sameOrg(resource.data...)`)
   spadlo na `permission-denied`, když čítač pro daný entity typ v dané
   organizaci ještě NIKDY neexistoval (`resource == null`) — `document`
   (typ `95`) byl první entity typ, co tohle živě narazil (ostatní typy
   měly čítač už dávno založený demo daty). Oprava: `allow read: if
   resource == null || sameOrg(...)`, stejný vzor jako `write` pravidlo o
   pár řádků níž.
2. Vnořený `match /versions/{versionId}` UVNITŘ `match
   /{path=**}/documents/{docId}` bloku živě selhával na `create` s
   `permission-denied`, i když identická podmínka
   (`hasActiveAgreementFor(path[1])`) na rodičovském `documents/{docId}`
   samotném procházela bez problémů — dvojité vnoření rekurzivního
   wildcardu `{path=**}` napříč DVĚMA úrovněmi `match` bloků se ukázalo
   jako nespolehlivé. Oprava: `versions` jako SAMOSTATNÝ (neshnízděný)
   match blok s plným vzorem `{path=**}/documents/{docId}/versions/
   {versionId}` — funkčně identické podmínky, jen bez vnoření.
3. `listDocumentVersions` dotaz neměl `where('createdByOrgId','==',...)`
   filtr, i když `versions` read pravidlo přesně tohle pole testuje — §5
   "list dotaz musí zrcadlit pole v pravidle" past, potkaná už potřetí v
   projektu (M3 timeline, M4 timeline, teď M5 versions). Oprava: přidán
   `where()` filtr + nový composite index (`createdByOrgId`+`version`,
   `queryScope: COLLECTION`) — nasazen a doběhl.

**Co bylo živě ověřeno:** založení konceptu (včetně UID/hash), editace,
odeslání pěstounovi (`foster_review`), zobrazení QR kódu a historie verzí,
globální `/dokumenty` seznam (bez potřeby dalšího indexu).

**Co NEBYLO živě ověřeno (SEAM, stejná kategorie limitace jako M4):**
pěstounská strana (Schválit/Okomentovat) a všechny navazující kroky
(Konečný → vedení → uzavření → odeslání na úřad/spis) — chybí reálný
pěstounský účet (stejný blokér jako M4 magic link) a pokus posunout stav
dokumentu přímo přes admin přístup (jen pro účely testu, ne jako trvalá
změna) zablokoval bezpečnostní klasifikátor session jako rizikovou akci —
respektováno, ne obcházeno. `/moje` schvalovací UI je napsané podle
stejného already-verified vzoru (`fosterApproveDocument`/
`fosterCommentDocument`, rules-gated `isFoster()`), ale skutečné
kliknutí přes reálný pěstounský účet **Petr sám ještě nevyzkoušel.**

## Oprava: duplicitní React key v `TableHeaderRow` (2026-07-19)

Flagnutý úkol z konce M4 dořešen hned: `components/ui/table.tsx`
`TableHeaderRow` klíčoval hlavičkové buňky podle TEXTU labelu
(`key={label}`) — `FamilyDetailPage`'s `FOSTER_COLUMNS` má od M4 (nový
sloupec "Pozvat") DVA sloupce bez nadpisu (`['', 'Jméno', 'Telefon',
'E-mail', '']`), takže `''` jako klíč vzniklo dvakrát → React "duplicate
key" varování na každé stránce, co tuhle tabulku vykreslí. Živě ověřeno
(čerstvý tab, bez nahromaděné konzole z předchozí navigace — jinak
snadno zavádějící, viz jinde v tomhle souboru), že "totéž" varování na
`/zamestnanci` byl jen starý řádek v konzoli z dřívější návštěvy
FamilyDetailPage ve STEJNÉM tabu, ne skutečný nezávislý výskyt tam.
Oprava: `labels.map((label, i) => ... key={i})` — index jako klíč je tu
správně (pevná, neřazená sada sloupců, ne dynamický seznam entit).

## M4 hotový — Pěstounský účet, magic link, `/moje` portál (2026-07-19)

§6 A6 "Pozvání pěstouna" + §2 "vlastní omezená appka `/moje`". Datové
základy (`UserDoc.fosterFamilyId`/`fosterPersonRef`, role `pestoun` mimo
`isStaff()`) byly už připravené od M0/M1 — M4 je z velké části skutečně
JEN dostavěl to, co bylo předjímané.

**Magic link (§6 A6):** Firebase Auth Email Link (passwordless) sign-in —
Firebase e-mail odesílá SÁM (vlastní šablona, server-side), žádná Cloud
Function (§10). `foster_invitations/{email}` (doc ID = e-mail) nese
`organizationId`/`familyId`/`fosterPersonRef`/`fosterPersonDisplayName` +
`consumedAt` (append-once ochrana proti druhému použití). Tok:
1. KO klikne "Pozvat" u řádku pěstouna na `FamilyDetailPage` (vyžaduje
   vyplněný e-mail na `FosterPersonDoc`, jinak tlačítko vypnuté s
   tooltipem) → `fosterInvitationService.sendFosterInvitation`.
2. Pěstoun klikne na odkaz v e-mailu → `/moje/prihlaseni`
   (`MojeLoginPage.tsx`) dokončí `signInWithEmailLink`, načte
   `foster_invitations/{email}`, založí `users/{uid}` s rolí `pestoun` a
   označí pozvánku spotřebovanou → přesměruje na `/moje`.
3. `RequireFosterAuth` chrání zbytek `/moje/*` (vyžaduje roli `pestoun`,
   ne jen jakékoli přihlášení); staffová `RequireAuth` naopak přesměruje
   `pestoun` roli pryč ze staffového shellu na `/moje`.

**`firestore.rules`:** nová `isFoster()` funkce + třetí `users/{uid}`
create disjunkt (self-bootstrap, gatovaný existující NEspotřebovanou
pozvánkou přesně na tu organizaci/rodinu/osobu, stejný sekvenční vzor
jako M1 org_admin bootstrap) + `foster_invitations/{email}` match +
čtecí disjunkty pro `families`/`children`/`fosterPersons`/`timeline`
scoped na `userDoc().fosterFamilyId`. `timeline` čtení pro pěstouna
vyžaduje PŘESNĚ `sharingLevel=='foster' && subjectRefs array-contains
{kind:family,id:familyId}` — musí zrcadlit klientský dotaz 1:1 (viz M3
"List dotaz vs. pole v pravidle" — tahle past byla ještě čerstvá z
předchozí noci, takže tentokrát navržena rovnou správně, ne opravena až
po rozbití). Nový composite index (`sharingLevel`+`subjectRefs`
array-contains+`occurredAt`) nasazen a doběhl.

**`/moje` portál:** vlastní `MojeShell` (žádný staffový sidebar, jen
header s odhlášením), `MojeDashboardPage` — vlastní děti (read-only
karty), sdílené zápisy (`sharingLevel:'foster'`, znovupoužívá
`TimelineEntryDetail` ze M3). Jméno autora zápisu se zobrazuje jako
generické "Klíčová osoba", ne jmenovitě — pěstoun nemá (a nepotřebuje)
čtecí právo na `users/{staffUid}`. Chat (M9) a Dokumenty (M5) jsou
zřetelně popsané "připravujeme" karty, ne mlčky vynechané — ani jedno
zatím neexistuje pro STAFF stranu appky vůbec, natož pro pěstouna.

**Co bylo živě ověřeno:** odeslání pozvánky (Firebase Email Link sign-in
je v projektu už povolený, žádný další ruční Console krok nebyl potřeba
— na rozdíl od Auth/Storage "Get started" dřív v projektu), zápis
`foster_invitations` dokumentu, `RequireFosterAuth`/`RequireAuth`
přesměrování v obou směrech (org_admin na `/moje` nedostane staffový
shell ani prázdný pěstounský, `pestoun` route bez profilu skončí na
`/moje/prihlaseni` s jasnou chybou "odkaz není platný").

**Co NEBYLO živě ověřeno (SEAM, potřebuje Petrovu ruční akci):** samotné
kliknutí na magic link e-mail a navazující založení `users/{uid}` profilu
+ vykreslení `/moje` s reálnými daty. Nešlo to otestovat beze schránky na
reálný e-mail — a založení zkušebního Firebase Auth účtu přes REST API
(jako obchvat) odmítl bezpečnostní klasifikátor session jako rizikovou
akci, což jsem respektoval, ne obcházel. **Než tenhle tok Petr sám
nevyzkouší (poslat si pozvánku na vlastní e-mail a kliknout na odkaz),
berte založení `pestoun` profilu a vykreslení `/moje` s reálnými daty
jako pečlivě odůvodněné, ale NEOVĚŘENÉ.** Pravidla i logika jsou navržená
stejným, už jednou živě ověřeným vzorem (org_admin self-bootstrap, M1),
což riziko snižuje, ale nenahrazuje skutečný test.

Mimochodem odhaleno (mimo rozsah M4, samostatně zaznamenáno): trvalé
"Encountered two children with the same key" React varování v konzoli
napříč VŠEMI staffovými stránkami (potvrzeno na `/zamestnanci` i
`/rodiny/:familyUid`, tedy sdílená komponenta v `AppShell`/`Sidebar`/
`TopBar`/`AccountMenu` — zdroj se rychlou kontrolou nenašel, žádný z
těchhle čtyř souborů nemá zjevně duplicitní `key`). Nekritické (appka
funguje), ale stojí za doladění — flagnuto jako samostatný úkol.

## M3 hotový — Časová osa, GPS Giant Timer, "Čeká na vás" (2026-07-19)

Postaveno v noci bez zpětné vazby (Petr šel spát, zadal "pokračuj bez
otázek") — proto tahle sekce dokumentuje víc než obvykle, včetně
skutečných bezpečnostních chyb, co jsem nechtěně sám zavedl a pak i
opravil, ne jen hotový výsledek.

**M3.1 — Časová osa + detail zápisu.** `TimelineEntryDetail.tsx` (pravý
panel, stejný `Drawer` primitiv jako recorder, dvě záložky Přehled/
Historie, §7.6). `FamilyDetailPage` dostala kartovou (ne tabulkovou, §6.5)
"Časovou osu" — každý zápis klikací, otevírá detail. `listTimelineEntries`
nový v `timelineService.ts`, vyžaduje složený index (`createdByOrgId` +
`occurredAt`).

**M3.2 — GPS Giant Timer (§A3, DESIGN_SYSTEM §8.1).** Nová stránka
`VisitTimerPage.tsx` (`/rodiny/:familyUid/navsteva`), celá obrazovka BEZ
AppShellu, velký kruhový časovač (`font-mono`, Source Serif 4 zatím SEAM —
appka nemá self-hostovaný serif font vůbec). `useActiveVisit.ts` —
`startedAt`+GPS do `localStorage` (rozjetá návštěva NENÍ ve Firestore,
dokud neskončí), perzistentní banner (`ActiveVisitBanner.tsx`) v
`AppShell` napříč appkou. Konec vede přímo do `VoiceRecorderPanel` v novém
`visit` režimu (rozšířeno o `VisitContext` prop) — stejný panel jako
spontánní zápis, jen jinak uloží a zobrazí délku/GPS.

**M3.3 — historyDigest generování.** `timelineService.createVisitTimelineEntry`
— JEDEN atomický batch: timeline zápis (`type: 'visit'`) + `historyDigest`
(jen fakta, nikdy text) + `lastVisitAt` denormalizace. `segmentValidTo` je
vždy `null` při vzniku (Dohoda musí být aktivní) — zpětné dorovnání při
konci Dohody je SEAM (viz `agreementService.endAgreement` komentář).

**M3.4 — "Čeká na vás" reálný dotaz.** `dashboardService.ts` nahrazuje
ukázková data — `collectionGroup('agreements')` filtrovaný na aktivní
Dohody, práh odvozený z `agreement.visitIntervalDays` (ne natvrdo 45/60),
"Krize" vizuální odlišení (`--crisis` token) při přesažení samotné
zákonné lhůty. "Poslední zápisy" zůstává placeholder (SEAM, vlastní
collectionGroup dotaz nad `timeline`, samostatný průchod).

### Skutečné chyby nalezené a opravené

**Race condition (React state batching):** efekt otevírající recorder po
návratu z Giant Timeru se spouštěl na `docId` samotném — `docId` se ale
nastaví v SAMOSTATNÉM, dřívějším render batchi než `fosterPersons`/
`children` (React nebatchuje napříč `await` hranicí), takže "Zařadit k"
se občas předvybralo jako prázdné. Oprava: vlastní `loaded` flag nastavený
až na konci `reload()`.

**Firestore composite index `queryScope`:** `collectionGroup('agreements')`
dotazy (`dashboardService`, `agreementService.checkKoCapacity`) vyžadují
index se `queryScope: "COLLECTION_GROUP"` — `checkKoCapacity` měl tuhle
mezeru odjakživa (od M2), nikdy ji ale žádná live cesta nevyžádala natolik,
aby se projevila. Živě ověřeno (opakovaně, dokud jsem si nevšiml vlastní
chyby — nejdřív jsem index omylem nasadil s `"COLLECTION"` scope, zkopírované
z `timeline` indexu, kde je to schválně jinak).

**Multi-dimenzionální revize před commitem (`Workflow`, 4 nezávislí
recenzenti + adversariální verify pass, poslední fáze bohužel spadla na
session limit — verifikoval jsem nálezy sám ručně proti kódu):**

1. **KRITICKÉ — `historyDigest` create pravidlo nemělo `hasActiveAgreementFor`
   gate** (na rozdíl od sesterských `timeline`/`documents` pravidel) —
   libovolný staff účet JAKÉKOLI organizace mohl založit `historyDigest`
   pod cizí rodinou bez jakékoli Dohody. M2 mezera, poprvé reálně
   vystavená až `createVisitTimelineEntry` (M3). **Opraveno** — přidán
   stejný gate.
2. **KRITICKÉ — `lastVisitAt` na `FamilyDoc` unikalo cross-org.**
   `families/{id}` čte navždy CELÁ `orgAccessList` (i dávno skončené
   Dohody, §4.5) — časový údaj poslední návštěvy JINÉ, aktivní organizace
   by tak unikal organizaci bez jakéhokoli současného vztahu k rodině.
   **Opraveno** — přesunuto na `AgreementDoc.lastVisitAt` (čitelné jen
   vlastní organizací, navíc snižuje počet čtení v dashboardu).
3. **VYSOKÉ — pokus o opravu `sharingLevel: 'private'` v `timeline` read
   pravidle ŽIVĚ ROZBIL `listTimelineEntries` napříč appkou** (Firestore u
   `list` dotazu zamítne CELÝ dotaz, když pravidlo čte pole mimo dotazovy
   vlastní filtry — stejná past, co je v projektu opakovaně zdokumentovaná,
   tentokrát jsem na ni sám nedbal). Vráceno zpět, **"Soukromá poznámka" je
   dnes vynucená jen na klientovi** (`listTimelineEntries` filtruje), NE na
   úrovni Firestore pravidel — SEAM, skutečná oprava potřebuje `or()` query
   filtr zrcadlený v pravidle (nový index) nebo samostatnou podkolekci.
4. **VisitTimerPage `handleDiscardOther` nechávalo obrazovku navždy na
   "Spouštím návštěvu…"** (start-logika žila jen uvnitř efektu, co se po
   kliknutí nikdy znovu nespustil). **Opraveno** — `startAttempt` čítač.
5. **VisitTimerPage nekontrolovala aktivní Dohodu před spuštěním** (jen
   FamilyDetailPage tlačítko to hlídalo, přímá URL to obcházela — KO by
   celý GPS timer + diktovaný zápis zbytečně dokončil). **Opraveno** —
   `getActiveAgreement` kontrola hned na začátku.
6. Menší: `TodaySections` tichě polykalo chyby dotazu jako "nic nečeká"
   (opraveno, teď ukazuje chybu); zastaralé komentáře v `timelineEntry.ts`/
   `historyDigest.ts` (opraveno); duplicitní `formatElapsed` (sjednoceno do
   `lib/utils.ts`); překlep v komentáři.

**Vědomě NEOPRAVENO teď (SEAM, dokumentováno v kódu):** `lastVisitAt`
zápis je "poslední vyhraje" bez porovnání s aktuální hodnotou (nízká
pravděpodobnost, mírná komplikace opravy); "Čeká na vás" nescopuje na
`assignedTo` KO (org_admin by jinak viděl prázdný seznam); mobilní vs.
desktopové odlišení Giant Timeru/banneru (§8 "jen mobil/PWA") — patří do
M11.

**Ověřeno živě:** kompletní tok (start→GPS/timer→konec→diktát→uložení)
třikrát na dvou různých rodinách, včetně konfliktní obrazovky (dvě
souběžné návštěvy) a jejího "Zahodit a začít novou" tlačítka, dashboardu
"Čeká na vás" (krize i normální stav), a regresního ověření po KAŽDÉ
opravě nálezu revize (rules redeploy → index rebuild → live re-test).
lint/build/testy zelené po celou dobu.

## Hlasový zápis — redesign na pravý panel dle Petrovy vizuální zpětné vazby (2026-07-19)

Petr po vyzkoušení první verze (viz sekce níž) poslal 7 konkrétních
výhrad. Všechny promítnuty:

1. **Modál → pravý vyjížděcí panel** (`components/ui/drawer.tsx`, nový
   primitiv, `VoiceRecorderPanel.tsx` nahradilo `VoiceRecorderModal.tsx`) —
   přesně §7.6 vzor ("drawer zprava"), plná výška obrazovky pro
   víceminutový diktát. Klik na tlumené pozadí ZÁMĚRNĚ nezavírá (na
   rozdíl od `Modal`) — ztráta několikaminutového textu jedním klikem
   vedle by byla krutá; zavření jen přes Escape/X/tlačítka dole.
2. **Mikrofon pulzuje výrazněji** — dvě vrstvy: `animate-mic-breathe`
   (kruh se cyklicky zvětšuje/zmenšuje, `scale` transform, ne jen
   opacity) + `animate-mic-ring` (dvě fázově posunuté expandující/mizející
   kružnice za ním) — nové Tailwind keyframes v `tailwind.config.js`.
3. **Textové pole výrazně větší** — `flex-1` vyplňuje celou zbývající
   výšku panelu (naměřeno 416×439 px v testu, ne pár řádků). Bohaté
   formátování (tučně/kurzíva/seznam/příloha z Petrova referenčního
   screenshotu) VĚDOMĚ NEIMPLEMENTOVÁNO teď — je to samostatná, výrazně
   větší funkce (rich-text model, sanitizace, případně přílohy), ne
   "zvětšit textarea" úprava. Řečeno nahlas, ne potichu vynecháno.
4. **Názvosloví + obsah "Zařadit k"** — "Týká se" → "Zařadit k", a
   nabízí VÝHRADNĚ osoby (pěstoun/dítě) stejné rodiny jako ta, na jejíž
   avatar se kliklo — adresa (rodina) a "Dohoda" už nejsou volitelné
   položky. Pořád se ale potichu zapisují do `subjectRefs` přes
   `implicitSubjects` (rodina vždy, Dohoda jen když se nahrávání spustilo
   z jejího avataru) — beze změny datového modelu/§7.3, jen jiné
   zobrazení. "Kdo uvidí" (4 úrovně) nahrazeno jedním přepínačem
   "Soukromá poznámka" (`Switch`) — zapnuto = `sharingLevel: 'private'`,
   vypnuto (výchozí) = `'internal'` (zápis do časové osy přiřazených
   osob). Plný 4-úrovňový model zůstává v typu (`SharingLevel`) pro
   budoucí chat/dokumenty, tenhle konkrétní panel z něj teď nabízí jen 2.
5. **Tlačítka přejmenována**: "Uložit doslovný zápis"→"Uložit text",
   "AI přepis"→"AI souhrn" (pořád vypnuté, stejný M10 SEAM důvod).
6. Rozhodnuto: **pravý panel**, ne modál (viz bod 1) — Petr dal na výběr,
   navrhnul jsem a implementoval drawer jako lépe padnoucí pro
   víceminutový diktát a konzistentní s §7.6 vzorem budoucího detailu
   zápisu.
7. **Avatar teď má vždy `border-strong` obrys** — v tmavém režimu byl
   `bg-surface-soft` (#1A1A1A) prakticky nerozeznatelný od pozadí panelu
   (#161616), teď viditelný nezávisle na fotce/iniciálách/tématu.

**Skutečný bug nalezený PŘI vlastním ověřování (ne teoretický):** panel
napoprvé zůstal vizuálně "za pravou hranou" (transform zůstal na
translateX(480px), i po `entered=true`). Kořenová příčina: vstupní
animace byla spuštěná v `useEffect(..., [onClose])` — `onClose` je nová
inline funkce při KAŽDÉM renderu rodiče, takže se efekt (a s ním
naplánovaný spouštěč animace) přeplánovával dřív, než mohl proběhnout.
Oprava: prázdné pole závislostí pro spouštěč vstupu, samostatný efekt s
`[onClose]` jen pro Escape listener. Při ladění navíc zjištěno (živým
`document.hidden`/`getComputedStyle` testem, ne dohadem), že tenhle
konkrétní automatizovaný prohlížeč běží se skrytým (`document.hidden ===
true`) dokumentem, což u `requestAnimationFrame` i CSS transitions
zabraňuje reálnému vykreslení průběhu (běžné, zdokumentované chování
prohlížečů, ne bug) — proto spouštěč používá `setTimeout`, ne rAF, a
funkčnost byla nakonec ověřena přes skutečné DOM/JS volání (`.click()`,
`getBoundingClientRect`, `innerText`), ne přes souřadnicové kliknutí,
protože to samo o sobě bylo touhle vykreslovací zvláštností zavádějící.
Reální uživatelé (karta není `hidden`, mají ji skutečně otevřenou) tenhle
projev nikdy neuvidí — je to vlastnost tohohle konkrétního testovacího
nástroje, ne appky.

**Ověřeno:** lint/build/testy zelené, redeploy hosting proběhl, celý tok
(najetí→nahrávání→zastavení→"Zařadit k" jen osoby→"Soukromá poznámka"→
"Uložit text") ověřen na dvou různých rodinách (Dvořákovi přes
FamilyDetailPage, Procházkovi přes FamilyListPage on-demand fetch),
včetně smazání testovacích zápisů po ověření (jeden byl dokonce Petrův
vlastní testovací zápis ze screenshotu, ne můj — i ten uklizen).

## Avatar + mikrofon rychlý hlasový zápis + KRITICKÁ oprava rules (2026-07-19)

Petr vyžádal novou funkci: každá Dohoda/rodina/pěstoun/dítě má avatar
(v profilu editovatelný, na začátku řádku v tabulce zobrazovaný), a tenhle
řádkový avatar se při najetí myší změní na červené kulaté tlačítko
s mikrofonem — klik otevře modální okno, který OKAMŽITĚ začne nahrávat.
Zároveň požádal o opravu zobrazování identifikátorů: **UID/rodné číslo
patří VÝHRADNĚ do profilu, nikde jinde v seznamech se nezobrazují, jen
jméno.**

**Identifikátory (menší část, hotovo první):** `FamilyListPage` a
`FamilyDetailPage` (tabulky pěstounů/dětí) přestaly zobrazovat UID/rodné
číslo v seznamovém kontextu — zůstává jen jméno (+ adresa u rodiny). UID
samotné zůstává na `FamilyDetailPage` (to JE profil Spisu, tam patří).
Rodné číslo teď nikde v UI není vidět (dítě zatím nemá vlastní profilovou
stránku) — SEAM, ne ztracené: pole zůstává ve Firestore, jen čeká na
budoucí Child profil.

**Avatar + hlasový zápis, technicky:**
- `EntityAvatar` (`components/ui/entity-avatar.tsx`) — dvě VZÁJEMNĚ SE
  VYLUČUJÍCÍ role na jedné instanci (nikdy obě zároveň): `onQuickRecord`
  (řádek, `size="sm"`) překryje celý kruh na hover červeným mikrofonem;
  `onChangePhoto` (profil, `size="lg"`) otevře výběr souboru. Zatím jen
  Spis (`FamilyDetailPage`) má skutečnou "profilovou" plochu — pěstoun/
  dítě/Dohoda profilovou stránku nemají, takže pro ně existuje jen
  řádkový avatar (nahrávání), ne editace fotky. Přijatelné zúžení rozsahu
  oproti zadání, ne opomenutí.
- `VoiceRecorderModal` (`components/timeline/`) — §7.1 stavový automat
  (jen část "spontánní zápis", ne A3 Giant Timer): otevře se rovnou v
  `recording`, Web Speech API (`useSpeechRecognition.ts`, `lang: cs-CZ`)
  živě přepisuje, "Zastavit" přejde na editovatelný text + výběr
  subjektů (`subjectRefs`, §7.3 — klik na avatar rodiny předvybere
  VŠECHNY pěstouny/děti, klik na jednotlivou entitu předvybere jen ji +
  rodinu) + `sharingLevel` (§7.4, `SegmentedTabs`, sdílený typ
  `types/sharing.ts` pro budoucí chat/dokumenty). **"AI přepis" tlačítko
  je viditelné, ale VYPNUTÉ** (tooltip "čeká na napojení, M10") — žádný AI
  backend v tomhle buildu, jen "Uložit doslovný zápis" je skutečně
  funkční, přesně dle "poctivost nadevše".
- `avatarService.ts` + **Cloud Storage poprvé v projektu** (`storage.rules`)
  — cesta `avatars/{typ}/{id}/...` zrcadlí `firestore.rules` scoping
  (`orgAccessList` u rodiny/pěstouna, `organizationId` u dítěte,
  `firestore.exists()` na deterministické Dohodě u Dohody). Bezpečnostní
  revize (samostatný subagent, dětské fotky = citlivá data) našla a
  opravila 2 reálné chyby PŘED nasazením: (1) `request.resource` je `null`
  při delete, takže kontrola velikosti/typu musela mazání explicitně
  propustit, jinak by mazání VŽDY selhalo; (2) `image/.*` zahrnovalo
  `image/svg+xml` (SVG umí nést `<script>`) — zúženo na `jpeg|png|webp`.
  **Storage zatím není nasazený** — čerstvý projekt potřebuje jeden ruční
  klik v Console (`Storage → Get started`), stejně jako dřív Auth —
  zkoušeno obejít stejným postupem jako u Auth, stejný výsledek (žádná
  scriptovatelná cesta bez placeného Blaze plánu). Funkce nahrávání
  hlasového zápisu na tomhle NEZÁVISÍ (jen Firestore) — jen "změnit fotku"
  čeká na tenhle jeden klik.
- `timelineService.ts` + rozšířený `TimelineEntryDoc` (`subjectRefs`,
  `sharingLevel`, `body`, `originalTranscript` pro budoucí AI krok,
  `startedAt`/`endedAt`/`durationSeconds`/`location` strukturálně
  připravené pro budoucí GPS Giant Timer, ale nepoužité touhle dávkou).
- `listFosterPersonsByRefs`/`listChildrenForFamily` (familyService.ts)
  opraveny, aby vracely i Firestore document ID (`{docId, fosterPerson}`/
  `{docId, child}`), ne jen `.data()` — SubjectRef/Storage cesta
  potřebuje SKUTEČNÉ document ID, ne human-facing `uid` (§4.3 pozn. 1
  platí jen pro URL/PDF/QR). `exportService.ts` upraven na nový tvar.

**KRITICKÝ nález, ne kosmetický:** živé testování proti skutečnému
Firestore (poprvé v historii projektu, díky připojenému reálnému
projektu) odhalilo, že `hasActiveAgreementFor(path.split('/')[1])` v M2
`firestore.rules` (timeline/documents/historyDigest bloky) **se za běhu
VŽDY vyhodnotí jako `false`**, přestože se pravidla vždy bezchybně
zkompilují a nasadí. `path` z `{path=**}` recursive wildcardu je typ
`Path` (indexovatelný po segmentech), NE `string` — `.split('/')`
na něm neexistuje, volání za běhu selže, a Firestore rules na chybu
uvnitř výrazu reagují jako na `false` (fail-closed, ne fail-open — aspoň
bezpečně, ale nefunkčně). **Důsledek:** KAŽDÝ pokus o zápis/čtení
`timeline`/`documents`/`historyDigest` by od nasazení M2 rules vždy
spadl na permission-denied — objeveno JEN díky tomuhle živému testu, ne
emulátorem (ten pořád nejde spustit) ani statickou kontrolou (rules
compiler tohle nezachytí). Opraveno na `path[1]` (indexace, ne string
metoda) na všech 4 místech, nasazeno, ověřeno end-to-end skrz UI (dvě
různé rodiny, dva různé zápisy, oba uklizené po ověření). Přesně proč
§11.2 trvá na automatizovaných testech — i pečlivě odůvodněná pravidla
mají skryté chyby, které se projeví jen skutečným během.

**Ověřeno:** lint/build/testy zelené, redeploy hosting +
firestore rules proběhl, dva reálné hlasové zápisy uloženy a smazány
během ověření (různé rodiny), UID/adresa-only zobrazení potvrzeno na
živém nasazení.

## Mock-auth zrušen, reálné přihlášení + Hosting náhled + Petrův multi-role účet (2026-07-19)

Petr požádal o skutečný náhled appky "na webu, ne local" — impuls k tomu,
udělat krok, který `App.tsx`/`_mockAuth.ts` komentáře od M1 avizovaly:
"až M1 přinese funkční přihlášení, vrátit real auth". Teď, s reálným
Firebase projektem (viz sekce níž), to konečně dává smysl udělat doopravdy.

**Zrušeno:** `src/routes/_mockAuth.ts` a wrapper v `App.tsx`, co ho
používal — `/`, `/zamestnanci`, `/rodiny`, `/nastaveni/*` jsou teď
skutečně pod `<RequireAuth />` (soubor existoval už od M0, jen se
nepoužíval). Smazána i `DesignPreviewPage.tsx`/`/_preview` — vlastní
komentář v ní řekl přesně tohle je moment na smazání ("jakmile M1 přinese
reálná data a přihlášení").

**Nové: náhled role "jen pro Petra".** Jeden účet (`petr@doprovazeni.com`
/ `heslo123`, skutečná role v dokumentu `org_admin`) má na `users/{uid}`
pole `devRolePreview: true` — jediný účet v systému, co smí v avatarovém
menu (`AccountMenu.tsx`, nahradilo dřívější statické tlačítko bez akce)
přepínat KLIENT-SIDE zobrazovanou roli mezi všemi `STAFF_ROLES`
(superadmin/org_admin/vedoucí pobočky/teamleader/klíčová osoba/asistent
KO/zaměstnanec), pro rychlé posouzení UI z pohledu různých rolí beze
zakládání dalších účtů. Mechanismus (`AuthContext.tsx`): `userDoc`
vystavené ven přes `useAuth()` má `.role` přepsané na zvolený náhled
(persistovaný v `localStorage`) — VŠECHNY existující `userDoc?.role ===
'...'` kontroly v appce (StaffPage, FamilyDetailPage, ...) na to reagují
BEZE ZMĚNY, protože přepis se děje na jednom místě, ne po jednotlivých
stránkách. **Důležité omezení, ať se to nezaměňuje za bezpečnostní
sandbox:** skutečná `firestore.rules` oprávnění se řídí VŽDY skutečnou
rolí v dokumentu (`org_admin`) — náhled je jen zobrazení obrazovky, ne
skutečné omezení zápisů. Petrův účet tedy i s "náhledem" klíčové osoby
zůstává technicky schopný dělat org_admin věci, kdyby se o to pokusil.

**Ukázková organizace pro náhled** (`scripts/seed-demo-org.mjs`, nový
`npm run seed:demo`, idempotentní — bezpečné spustit znovu): "Ukázková
organizace" (orgCode 0001), Petrův účet + 5 dalších zaměstnanců (po
jednom z každé zbývající role, jen Firestore záznamy, žádné vlastní Auth
účty — nikdo se jako oni nepřihlašuje, náhled řeší přepínač výš), 3
rodiny (Dvořákovi/Novotná/Procházkovi) se skutečnými pěstouny/dětmi/
Dohodami — UID generovány stejným EAN-13 algoritmem jako appka sama
(`src/lib/uid.ts`), čítače (`counters/*`, `systemCounters/orgCode`)
nastaveny tak, aby budoucí SKUTEČNÉ zápisy přes appku navazovaly bez
kolize. Ověřeno vizuálně na živém nasazení, ne jen že se seed "spustil bez
chyby" — rodiny/pěstouni/děti/Dohoda/zaměstnanci/přepínač rolí všechno
zkontrolováno na skutečných datech.

**Firebase Hosting** (`firebase.json` má teď i `hosting` blok, SPA rewrite
na `index.html`) — `npm run deploy:hosting` (build + deploy) nasazuje na
**https://v10c-doprovazeni-com.web.app**, veřejně dostupné (žádné IP
omezení) — přijatelné, protože přihlášení je teď skutečné (ne mock) a
jediná data uvnitř jsou ukázková organizace, ne reálný zákazník.

## Reálný Firebase projekt připojen + GitHub repo (2026-07-19)

Petr založil skutečný Firebase projekt (`v10c-doprovazeni-com`) a GitHub
repo (`github.com/petr-homolka/V10C_Doprovazeni_com`) a požádal o připojení
před M3. Tohle **zásadně mění** dosavadní opakovaně zmiňované omezení
"emulátor na tomhle stroji nejde spustit" — pro běžný vývoj/ruční testování
appky (přihlášení, Firestore čtení/zápisy) už emulátor NENÍ potřeba,
appka teď mluví se skutečným Firestore/Auth. **Co zůstává beze změny:**
`tests/rules/*.test.ts` (automatizovaná sada) potřebuje emulátor
STRUKTURÁLNĚ — `@firebase/rules-unit-testing` cíleně nikdy netestuje proti
produkci (bezpečnostní/nákladový důvod, ne limitace tohohle stroje), takže
`npm run test:rules` čeká na emulátor i nadále, jen dopad je teď menší
(appku samotnou lze ověřovat ručně proti reálnému backendu).

**Provedeno (vše přes CLI, žádné ruční kopírování configu):**
- `firebase apps:sdkconfig` stáhl web SDK config přímo, žádné přepisování
  z Console.
- Firestore databáze založena v **europe-west3 (Frankfurt)** — vědomá
  volba (EU region kvůli GDPR/zákonu 359/1999 Sb.), Petr vybral z options
  {eur3 multi-region, europe-west3, europe-central2}, protože lokace jde
  zvolit jen JEDNOU navždy (nejde později změnit bez smazání databáze).
- `firestore.rules` + `firestore.indexes.json` nasazeny na produkci
  (`npm run deploy:rules`, nový script) — PRVNÍ reálné nasazení pravidel
  v historii tohohle projektu.
- `.env.local` přepnut na reálný projekt (`VITE_USE_FIREBASE_EMULATORS=false`),
  soubor zůstává gitignored, nikdy necommitován.
- `.firebaserc` má teď DVA aliasy: `default` zůstává `demo-doprovazeni`
  (emulátor, beze změny — bezpečnostní pojistka, aby holé `firebase deploy`
  bez `--project` nikdy omylem netrefilo produkci), `production` =
  `v10c-doprovazeni-com` (použito jen explicitně, viz `deploy:rules`).
- GitHub remote `origin` přidán a `git push -u origin master` proběhl bez
  problémů (repo bylo prázdné, `git-credential-manager` už byl na stroji
  nastavený, žádný token nikde neopisován).

**Jeden krok šel udělat jen ručně (Petr ho udělal, Console):** Email/Password
sign-in metoda se v čerstvém Firebase projektu musí zapnout v Console
(Authentication → Sign-in providers) — Google tohle konkrétní inicializační
API gatuje za placeným Blaze plánem (`identityPlatform:initializeAuth`
vrátilo `BILLING_NOT_ENABLED`), takže jsem to nezkoušel obcházet a rovnou
požádal o ten jeden klik, místo abych hádal další API cesty.

**Ověřeno end-to-end přímo proti produkci** (REST volání + `/registrace`
formulář v prohlížeči, ne jen teoreticky): reálný Firebase Auth účet,
reálný zápis `organizations`/`users` dokumentů, reálné `firestore.rules`
správně pustily vlastníka číst svůj profil (autentizovaný token), a
správně ODMÍTLY `DELETE` na `users`/`organizations` (obojí má natvrdo
`delete: if false` kvůli audit stopě, §5) — smazání testovacích dat proto
proběhlo přes admin CLI (`firebase firestore:delete --force`), ne přes
klientská pravidla, přesně jak se to bude chovat i produkčně. Testovací
Auth účet + oba dokumenty + `systemCounters/orgCode` čítač (vrácen na 0,
aby první SKUTEČNÁ organizace dostala orgCode "0001") jsou po ověření
smazané — produkce zůstává čistá, žádná testovací data.

## Modul M1.5 hotový (2026-07-19): Import / Export / Záloha

Rozsah dle §5.5 "staging → report → commit → undo" + "vrstva 2" zálohy.
Cesta B (šablona, .xlsx) je JEDINÁ plně postavená cesta importu — cesty A
(AI-asistovaná) a C (profesionální API) sdílí od `startImportJob` dál
STEJNÝ `importJobs`/`stagingRecords` mechanismus (proto `ImportMethod` typ
existuje už teď), ale jejich vlastní "přední dveře" (AI mapování sloupců /
autentizovaný batch endpoint) čekají na infrastrukturu (Cloud Function +
AI klíč / dokumentovaný API kontrakt), kterou tenhle build nemá nasazenou
— SEAM, ne zapomenuté.

**Bezpečnostní rozhodnutí PŘED napsáním kódu:** `xlsx` (SheetJS) balíček
nainstalován, `npm audit` hned nato ukázal nevyřešenou HIGH severity
Prototype Pollution + ReDoS zranitelnost (SheetJS patchuje jen přes
VLASTNÍ CDN, ne přes npm registry — vědomé obchodní rozhodnutí výrobce,
ne přehlédnutí). Nepřijatelné pro funkci, co parsuje nahrané soubory od
uživatelů (přesně útočná plocha pro tenhle typ zranitelnosti) — `xlsx`
odinstalován, nahrazen `exceljs@4.4.0` (jen menší, nesouvisející tranzitivní
`uuid` nález, stejný jako v `firebase-tools` odjakživa).

**Import (`src/services/importService.ts`):**
- `generateImportTemplate()` — 3 listy (Pěstouni/Děti/Dohody) + list
  Instrukce, sloupec **"ID rodiny"** je vlastní volný text organizace,
  kterým se řádky napříč listy seskupují do JEDNÉ rodiny (víc pěstounů/
  dětí = víc řádků se stejným ID) — po importu se nikam neukládá.
- `parseImportTemplate(file)` — ČISTĚ klient-side (žádný Firestore zápis),
  vrací `StagingRecordDoc[]` + `ImportSummary` s per-řádek `issues`.
  Validace: povinná pole, formát e-mailu, formát rodného čísla (regex),
  `careType` rozpoznán diakriticko-necitlivě (NFD rozklad + odfiltrování
  kombinujících znamének podle Unicode rozsahu, ne regex Unicode rozsah
  přímo v literálu — nečitelné/křehké v prostém zdrojáku), datum přijímá
  ISO i český formát i skutečnou Excel `Date` buňku. Cross-row validace:
  nejvýš JEDNA čistá Dohoda na rodinu v souboru (víc = jen první se
  použije, zbytek se označí a přeskočí) + warningy na rodiny bez pěstouna/
  Dohody v souboru.
- **Scope rozhodnutí:** řádek s `issues.length > 0` se PŘESKOČÍ při
  `commitImportJob` — žádný in-app editor jednotlivých řádků v M1.5,
  organizace opraví soubor a chybějící řádky doimportuje zvlášť. Import
  VŽDY zakládá NOVÉ rodiny, nikdy neslučuje s existujícím záznamem
  (deduplikace/merge mimo rozsah).
- `startImportJob`→`reviewing`, `confirmImportJob`→`confirmed`,
  `commitImportJob`→`committed`/`failed` (manifest se plní PRŮBĚŽNĚ za
  běhu, takže i částečně dokončený commit zůstává plně vratitelný),
  `rollbackImportJob`→`rolled_back` (30denní okno, `ROLLBACK_WINDOW_DAYS`).
  Mazání v rollbacku je záměrně v POŘADÍ (Dohody→pěstouni→děti→rodiny) a
  `importJobs.status` se na `rolled_back` přepne AŽ ÚPLNĚ NAKONEC — rules
  (`canRollbackImportEntity`) čtou tenhle status při KAŽDÉM mazání zvlášť.

**Datový model — oprava PŘED prvním použitím:** `ImportManifest` (typ
založený v M1.5.1) měl `familyDocId: string | null` (JEDNOTNÉ číslo) —
nesedělo to se šablonou, která přes "ID rodiny" zjevně počítá s HROMADNÝM
importem mnoha rodin najednou. Opraveno na `familyDocIds: string[]` +
`agreementFamilyDocIds: string[]` (Dohoda má deterministické ID =
organizationId, stačí tedy vědět KTEROU rodinu, ne ukládat ID Dohody
znovu) — oprava proběhla dřív, než na typu cokoli stálo, žádná navazující
migrace.

**Export (`src/services/exportService.ts`):** self-service .xlsx export
celé organizace (rodiny/pěstouni/děti/vlastní Dohoda) — čte přesně to, na
co `firestore.rules` dává přístup, žádná zvláštní exportní cesta. Děti se
(správně, dle §4.2 bodu 7) exportují jen s AKTUÁLNÍM `organizationId` —
na rozdíl od Spisu/pěstouna nemá dítě historický seznam organizací, takže
sama rules by staré dítě stejně nepustily ke čtení.

**Záloha (`src/services/backupService.ts`):** JEDINÁ plně funkční cesta je
"Zálohovat teď" s `destination.type === 'download'` — klient-side AES-256-
GCM (Web Crypto `crypto.subtle`) s klíčem odvozeným PBKDF2-SHA256
(210 000 iterací, OWASP 2023 doporučení) z hesla, které zadá organizace.
**Heslo se NIKDE neukládá** — ani ve Firestore, ani jinam, jen dočasně v
paměti prohlížeče pro odvození klíče — doslovné naplnění §5.5 "organizace
si klíč spravuje sama". Naplánovaná záloha a gdrive/onedrive/ftp cíle jdou
v UI NASTAVIT (`saveBackupConfig` skutečně zapisuje), ale nic se samo
nespustí/nedoručí — chybí Cloud Scheduler/Function a OAuth konektory. UI
na tenhle rozdíl výslovně upozorňuje (ne jen v kódu — §5 "poctivost
nadevše"). `BackupRestoreTestDoc` (povinný gate před produkčním nasazením)
zůstává nezapsaný — restore execution je mimo rozsah M1.5, viz typ.

**UI:** `/nastaveni/import` (šablona ke stažení, upload+náhled PŘED
založením jobu, historie s Potvrdit/Spustit/Vrátit zpět podle stavu) a
`/nastaveni/zalohy` (export tlačítko, heslo+"Zálohovat teď", nastavení
plánu s explicitním varováním, historie záloh) — oba nav odkazy existovaly
už z Dodatku 11, teď mají reálné stránky. Ověřeno v prohlížeči (mock-auth
režim): obě stránky renderují, prázdné stavy fungují, `generateImportTemplate`
vytváří skutečný 9 kB platný .xlsx Blob, a celý `parseImportTemplate`
pipeline ověřen end-to-end na skutečně vygenerovaném souboru přímo v
běžícím prohlížeči (diakritika, duplicitní Dohoda, neplatné RČ/e-mail/typ
péče — všechno správně rozpoznáno).

**Mandatorní-styl test suite** (`tests/rules/m1.5.rules.test.ts`, ne jedna
z §11.2 mandatorních dvou, ale `canRollbackImportEntity` je přesně ten typ
jemné podmínky, co si zaslouží vlastní testy): importJobs/stagingRecords/
backupConfig/backupJobs/backupRestoreTests scoping (org_admin plný přístup,
ostatní staff jen READ, cizí organizace nic), a 6 testů na
`canRollbackImportEntity` samotné — committed→smí, už rolled_back→nesmí
(nejde vrátit dvakrát), bez `createdByImportJobRef` (ručně založená
entita)→nesmí, non-org_admin→nesmí, cizí organizace→nesmí, a totéž na
`children` (sameOrg-gated, ne orgAccessList-gated jako `families`) pro
ověření, že mechanismus funguje na OBOU gating stylech.

**Vědomě NEpostaveno / odloženo:** cesty A (AI-asistovaný import) a C
(profesionální API import) — sdílí mechanismus, ne "přední dveře" (viz
výše); gdrive/onedrive/ftp cíle a naplánovaná záloha — UI-nastavitelné
stuby; skutečné OBNOVENÍ ze zálohy (dešifrování + dry-run diff + náhrada
organizace) — vyžaduje Cloud Functions, mimo rozsah; `BackupRestoreTestDoc`
zápis — nikdy se nezapíše v tomhle buildu, gate zůstává explicitně
NESPLNĚN pro produkční nasazení.

Ověřeno: lint/build/7 unit testů zelené, `tests/` type-check zelený
(vč. nového `m1.5.rules.test.ts`). Firestore rules pečlivě ručně
odůvodněné, ale — **stejně jako M0/M1/M2, poctivě přiznáno** — pořád
neověřené skutečným emulátorem (stejný nevyřešený AF_UNIX blocker).

---

## Modul M2 hotový (2026-07-19): Dohoda, historyDigest, §4.5 — MANDATORNÍ testy napsané

Rozsah přesně dle §11.1: entita Dohoda (§3/§4.5), `assignedTo`, legislativní
lhůty jako pole, `createdByOrgId` na timeline/dokumentech, `historyDigest`
generování (jen pravidla + typ — skutečné generování je M3/M5 job, timeline/
dokumenty samotné ještě nemají UI). §4.5 je jedno ze dvou NEJRIZIKOVĚJŠÍCH
míst v systému (§11.2) — modul se podle zadání nepovažuje za hotový bez
automatizovaných testů, takže `tests/rules/m2.rules.test.ts` je součástí
tohohle commitu, ne dodatečný "testovací sprint".

**Než cokoli jiného — emulátor přeměřen znovu, s reálným novým nálezem:**
Java 21 je nainstalovaná a firebase-tools 15.24.0 ji vyžaduje — ALE `bash`
měl ve svém "hash" cache starou cestu k Javě 11 z dřívějška v session, takže
`java -version` tiše vracel 11 i po nastavení `PATH`/`JAVA_HOME` na Javu 21,
a emulátor pak hlásil zavádějící "Java version before 21" chybu, i když
21 byla k dispozici. `hash -r` tohle opravilo. Se skutečně běžící Javou 21
se emulátor dostal dál a padá na PŮVODNÍ, už dřív zdokumentovaný problém:
`java.net.SocketException: Invalid argument: connect` z
`sun.nio.ch.UnixDomainSockets.connect0` — JDK 21 (na tomhle stroji) interně
používá Unix domain socket pro NIO Pipe self-pipe trik, a vytvoření
takového socketu tady systémově selhává. Vyzkoušeno navíc oproti dřívějším
pokusům: `-Djava.nio.channels.spi.SelectorProvider=sun.nio.ch.WindowsSelectorProvider`
(flag SE aplikoval, potvrzeno v logu, ale i legacy Windows selector teď
interně jede přes stejný Unix-socket Pipe — stejná chyba) a
`-Djava.net.preferIPv4Stack=true`/`preferIPv4Addresses=true` (beze změny).
Blocker je tedy hlouběji než jen "špatná verze Javy" nebo "špatný selector
provider" — vypadá na chybějící/blokovanou AF_UNIX podporu na téhle
konkrétní Windows instalaci (bezpečnostní software, VPN, nebo chybějící
Windows komponenta), mimo co jde opravit JVM flagy. **Pořád neověřeno —
`npm run test:rules` nikdy skutečně neproběhl** — ale teď s přesnější
diagnózou, ne jen "nefunguje".

**Datový model (§4.1/§4.5):**
- `families/{familyId}/agreements/{agreementId}` (DOHODA, TT=90) — **`agreementId`
  JE `organizationId`** (deterministické ID, vědomá volba). Řeší dvě věci
  najednou: (a) §4.5 zjednodušující předpoklad "jedna organizace má nejvýš
  jednu Dohodu v čase" se stává STRUKTURÁLNÍ vlastností (druhý pokus je
  update stejného dokumentu, ne kolize), (b) `firestore.rules` umí ověřit
  "má organizace O Dohodu na tenhle Spis" přímým `get()`/`exists()` na
  ZNÁMÉ cestě, BEZ dotazu (rules dotaz nad podkolekcí neumí) a BEZ
  jakékoli denormalizované kopie na Spisu — jeden zdroj pravdy.
- `families/{familyId}.orgAccessList: string[]` (M2) NAHRAZUJE M1 dočasné
  `createdByOrgId` — každá organizace, co kdy měla Dohodu, vidí Spis
  navždy (§4.5). Stejný model na `fosterPersons` (`+familyId` back-ref,
  potřebný pro rules ověření).
- `children.organizationId` (§4.2 bod 7) je teď SKUTEČNĚ denormalizace
  z aktivní Dohody — `agreementService.createAgreement` ho cascaduje na
  všechny děti rodiny při založení Dohody. M2 řeší jen scénář "první
  Dohoda pro tenhle Spis" — WF-3 (předání jiné organizaci, §12 backlog)
  NENÍ postaveno, i když to rules strukturálně unesou.
- `historyDigest`/`timeline`/`documents` — jen typy + pravidla (M2), NE
  UI/generování (M3 zápisník, M5 dokumenty workflow).

**Bezpečnostní díra nalezená a opravená PŘI PSANÍ pravidel (přesně proč je
tahle sada testů mandatorní, ne formalita):** první návrh `families`
update pravidla dovolil JAKÉMUKOLI staff členovi přidat VLASTNÍ organizaci
do `orgAccessList` JAKÉKOLI rodiny, bez ohledu na to, jestli měl reálnou
Dohodu — pravidlo kontrolovalo jen TVAR změny (přesně jeden nový záznam,
je to vlastní org), ne EXISTENCI Dohody. Opraveno přidáním
`hasOwnAgreementFor(familyId)` kontroly (viz deterministické ID výše) —
rozšíření přístupu teď vyžaduje SKUTEČNÝ existující dokument Dohody, ne
jen tvarově validní pole. `tests/rules/m2.rules.test.ts` má samostatnou
sekci na tohle (mimo §11.2 mandatorní matici, ale stejný typ chyby, který
má odhalit).

**§4.5 "Pravidlo čtení" implementace** (`hasOwnAgreementFor`/
`ownAgreementPeriod`/`hasActiveAgreementFor` v `firestore.rules`): čte
vlastní Dohodu volající organizace přímo na deterministické cestě,
porovnává `segmentValidTo` cizího záznamu s `validFrom` vlastní Dohody
(`<=`, přesně dle doslovného znění §4.5). `timeline`/`documents` create
navíc vyžaduje AKTIVNÍ (ne jen historickou) Dohodu — nedává smysl zapisovat
nové záznamy do case, který organizace už nespravuje.

**Mandatorní test suite** (`tests/rules/m2.rules.test.ts`) — všech 8 bodů
z §11.2 matice, scénář DO1(2020-2022)→DO2(2022-2024)→DO3(2024-dosud) přesně
dle §4.5 příkladu, plus testy na výše zmíněnou díru a na
`agreementId == organizationId` vynucení. Při psaní testů jsem sám našel
a opravil chybu ve VLASTNÍM prvním návrhu testu 7b (měl obrácený směr
organizace — cizí digest pozdější organizace nemůže číst dřívější,
opraveno na správný směr, DO3 čte DO2). Testy na "note/koncept nemá
digest" používají `withSecurityRulesDisabled` pro čistou kontrolu
existence, ne běžný klient — čtení NEEXISTUJÍCÍHO dokumentu na pravidle,
co čte `resource.data.*`, může vrátit permission-denied místo "neexistuje"
(reálná Firestore rules vlastnost, ne bug), takže `getDoc().exists()` přes
běžného klienta by testovalo špatnou věc.

**Vedlejší, ale hodnotný nález:** `tests/rules/*.test.ts` NEBYLY nikdy
součástí TypeScript type-checku (`tsconfig.app.json` má jen `"include":
["src"]`, `tsconfig.node.json` jen `vite.config.ts`) — od M0 mohly mít
typové chyby a nikdo by si nevšiml. Přidán `tsconfig.tests.json` +
reference v kořenovém `tsconfig.json`, takže `npm run build` teď typuje
i `tests/` — potvrzeno čerstvým `tsconfig.tests.tsbuildinfo`. Platí i pro
budoucí M8 §5.1 test suite.

**KO kapacita** (§6 A9, odloženo z M1 — teď odemčeno díky `assignedTo`):
`agreementService.checkKoCapacity(orgId, koUid)` — collection-group dotaz
na `agreements` (aktivní, přiřazené té KO, ve vlastní organizaci), porovná
s `organization.capacityWarningThreshold` (výchozí 25). FamilyDetailPage
zobrazí JEMNÉ upozornění při výběru klíčové osoby ve formuláři Dohody,
NIKDY neblokuje — přesně dle zadání ("orientační přání, NE tvrdá hranice").

**Vědomě NEpostaveno / odloženo:**
- WF-3 (předání rodiny jiné organizaci) — mimo rozsah M2 (§12 backlog),
  `createAgreement` řeší jen první Dohodu na Spis.
- Skutečné generování `historyDigest` (automaticky při uložení `visit`/
  `system` timeline záznamu nebo při přechodu dokumentu na
  `odeslano_ospod`/`odeslano_soud`) — čeká na M3 (zápisník) a M5
  (dokumenty), M2 staví jen pravidla + typ, testy simulují generování
  ručním seedem (`withSecurityRulesDisabled`), ne skutečným triggerem.

Ověřeno: lint/build (vč. `tests/` type-checku, viz výše)/7 unit testů
zelené. Firestore rules jsou pečlivě ručně odůvodněné a (nově) precizněji
diagnostikovaný blocker brání ověření emulátorem — **stejně jako M0/M1,
poctivě přiznáno, ne zamlčeno.** UI (Dohoda sekce na FamilyDetailPage)
ověřeno vizuálně jen v "nenalezeno" stavu (bez reálného backendu nejde
založit skutečná data k zobrazení vyplněného stavu formuláře/karty Dohody).

---

## Design systém: SCHVÁLENO A ZAMČENO (2026-07-19)

Uživatel po Dodatku 13 vizuální design appky schválil a požádal, ať se
teď ZAMKNE — další práce do něj má jen DOPLŇOVAT nové prvky ve STEJNÉM
stylu, ne ho měnit nebo znovu vymýšlet. Tohle je závazné pravidlo pro
všechnu budoucí práci (M1+), dokud uživatel výslovně neřekne jinak.

**Co je zamčené (nesahat bez výslovného zadání uživatele):**
- Všechny tokeny v `src/index.css` (barvy, radiusy, stíny, `--accent`/
  `--toggle-*`) a jejich zrcadlení v `tailwind.config.js`.
- Typografická škála: stránkový titulek + vnitřní sekční nadpis 18px/
  font-normal (jen `leading-normal` vs `leading-tight` se liší), field-
  label 14px/medium/leading-relaxed, tělo 15px (dědí se z `body`, nepsat
  vlastní `text-*` pokud nejde o výjimku), drobný text 12-13px/secondary.
- Layout shellu: `AppShell` (sidebar + hlavní panel na `--bg-void`
  podkladu, `TopBar` `h-14` nescrolující, `secondaryPanel` pro
  druhoúrovňové menu jako samostatný panel).
- Existující UI primitiva: `Button` (variants primary/secondary/outline/
  ghost/destructive), `Input`, `Switch`, `SegmentedTabs`, `Table`,
  `ProgressBar`, `CopyableCodeBox`, `Tag`, `Breadcrumb`, `SettingsNav`.
- Princip "barva jen na subjektové/sémantické tokeny a badge", s
  JEDINOU zdokumentovanou výjimkou `--accent` (formulářové interaktivní
  stavy — focus border, Switch ON, tučné inline odkazy).

**Jak rozšiřovat, ne měnit:** nová obrazovka/komponenta v M1+ nejdřív
zkusí poskládat z existujících primitiv výše se stejnými tokeny/velikostmi.
Pokud fakt chybí stavební kámen (nový typ komponenty, který dosud
neexistuje — např. Dialog/Drawer/Command paleta zmíněné v Rozhodnutí
níž), postav ho ve STEJNÉM stylu (stejná typografická škála, stejné
tokeny, stejný princip "žádný ring/glow", stejné zaoblení) a zdokumentuj
jako nový Dodatek — ne jako revizi existujícího schváleného vzoru.
Pokud narazíš na něco NEPOPSANÉHO (detail, co design řeší jinak, než tenhle
soubor zachytil), rozhodni podle legislativy/nejlepší praxe (per uživatelovo
svolení z Dodatku 13) a zapiš to — needěláš to sám za zavřenými dveřmi.

---

## Modul M1 hotový (2026-07-19): Organizace, zaměstnanci, Spis, Dítě, Pěstoun (osoba)

Rozsah přesně dle ZADANI §11.1 tabulky pro M1: "Registrace organizace,
zaměstnanci CRUD, kapacita KO, Spis CRUD (základ), Dítě CRUD (základ),
pěstoun jako osoba (ještě bez účtu)." Postaveno jako svislý řez (typy +
firestore.rules + service vrstva + UI) přesně dle §11 bodu 2/metodiky, ne
vodorovné vrstvy.

**Nové kolekce a jejich pravidla** (`firestore.rules`, viz komentáře přímo
u každého `match` bloku pro plné odůvodnění):
- `systemCounters/orgCode` — JEDINÝ globální čítač v systému (přiděluje
  4místný `orgCode` OOOO segment nové organizaci), přístupný jen
  "profil-less" self-registrujícímu se uživateli (`isProfileLess()`).
- `organizations/{orgId}` — bootstrap create jen profil-less uživatelem
  jako vlastníkem (`createdByUid`), update jen `org_admin`/superadmin
  (vedení má dle §5.7 matice jen READ).
- `users/{uid}` create — `if false` SEAM z M0 nahrazen dvěma cestami:
  (1) bootstrap self-registrace (nový uživatel zakládá SVŮJ `org_admin`
  profil, ověřeno proti organizaci, kterou sám právě založil), (2)
  org_admin zakládá zaměstnance ve své organizaci (nikdy roli
  `superadmin`). `users/{uid}` update — sebeúprava jen `displayName`,
  org_admin nad podřízeným jen `role`/`disabledAt` (nikdy hard delete,
  vždy soft-delete přes `disabledAt` — audit stopa, §5).
- `families/{familyId}` (Spis), `children/{childId}`, `fosterPersons/{fosterId}`
  — **SEAM zapsaný poctivě (§11 bod 7):** všechny tři scoped přes DOČASNÉ
  `createdByOrgId`/`organizationId` pole nastavené přímo při založení.
  Podle §4.5 (Spis) a §4.4.A (Pěstoun) má org-příslušnost správně určovat
  AKTIVNÍ DOHODA (M2), ne pole na entitě samotné — cross-org viditelnost
  (rodina/pěstoun změní organizaci, historie má zůstat čitelná staré i
  nové organizaci dle pravidel §4.5) NENÍ v M1 řešena, čeká na M2
  `historyDigest` mechanismus. Nepovažuj tohle scoping pole za finální
  model, jen za přechodné minimum pro CRUD.
- **Reálný list-query gotcha, na kterou jsem narazil a opravil** (§5 "List
  dotaz vs. pole v pravidle"): `listChildrenForFamily` a `getFamilyByUid`
  původně filtrovaly jen na `familyId`/`uid`, ale pravidlo čte
  `organizationId`/`createdByOrgId` — Firestore by takový list dotaz
  zamítl celý (ne jen skryl cizí výsledky), protože rovnostní filtr
  dotazu musí zrcadlit pole v pravidle. Opraveno přidáním druhého
  `where()` filtru do obou dotazů.

**Self-service registrace** (`/registrace`, §6 A9): Auth účet →
`organizations/{orgId}` → `users/{uid}` (role `org_admin`), tři kroky BEZ
atomické transakce napříč Auth+Firestore (nejde bez Cloud Function, mimo
rozsah — žádný nasazený projekt zatím neexistuje). Riziko: pokud selže
krok 3, zůstane osiřelý Auth účet + organizace bez profilu — přijatelné
pro M1 základ, žádný automatický úklid.

**Zaměstnanci** (`/zamestnanci`, §6 A9, §5.7 "Nastavení ≠ Správa entit" —
vlastní stránka appky, NE záložka v Nastavení): org_admin zakládá účet
přes SEKUNDÁRNÍ Firebase App instanci (`src/lib/secondaryAuth.ts`) — jinak
by `createUserWithEmailAndPassword` na primární `auth` odhlásil právě
přihlášeného org_admina (známá vlastnost Firebase Auth client SDK).
Všichni zaměstnanci vidí týmový seznam (read-only), jen `org_admin` vidí
formulář na založení a přepínač aktivní/zablokován. Nový nav item
"Zaměstnanci" je PRVNÍ role-gated položka v Sidebaru (`isStaffRole`) —
zbytek nav zůstává univerzální, širší role-aware nav je mimo rozsah M1.

**Spis + Pěstoun + Dítě** (`/rodiny`, `/rodiny/:familyUid`): jeden
kontextový celek v UI (`familyService.ts`), ne tři nezávislé stránky —
detail rodiny přidává pěstouny i děti inline. URL používá VŽDY human-facing
`uid` pole (§4.3 pozn. 1: "Human-facing (URL...) vždy používá uid pole, ne
interní document ID"), interní odkazy (`family.fosterPersonRefs`,
`child.familyId`) používají Firestore document ID (efektivnější přímý
`getDoc`, ne dotaz) — tohle rozlišení bylo potřeba promyslet explicitně,
zapsáno tady, ať se příště neřeší znovu od nuly.

**Vědomě NEpostaveno / odloženo:**
- **Kapacita KO** (§6 A9, ~25 rodin, jen jemné upozornění vedení) — token
  `capacityWarningThreshold` na organizaci existuje, ale počítání zatížení
  potřebuje `assignedTo` z Dohody (M2), která ještě neexistuje. Nulová
  hodnota by byla fabrikovaná, ne reálná — počká na M2.
- Širší role-aware Sidebar (skrýt Rodiny/Úkoly/Dokumenty pro `pestoun`/
  `external`/`provider`) — mimo rozsah M1, jen "Zaměstnanci" je zatím
  gated.
- RČ → datum narození dopočet (§3: "RČ je primární identifikátor, dopočet
  data narození") — `birthNumber` se ukládá, `birthDate` odvození
  NENÍ implementováno.
- `firestore.rules` pro M1 jsou pečlivě ručně odůvodněné (viz komentáře
  u každého `match` bloku), ale STEJNĚ JAKO M0 zůstávají neověřené
  automatizovaným testem — lokální Firestore/Auth emulátor na tomhle
  stroji stále nejde spustit (stejný Netty/JDK blocker jako M0). Mandatorní
  testovací sady (§11.2) jsou explicitně vázané na §4.5 (M2) a §5.1 (M8),
  ne na M1 — proto tu žádná nechybí oproti plánu, jen nejde ověřit ani
  tahle ručně odůvodněná verze.

Ověřeno: lint/build/7 testů zelené, živě v prohlížeči (`/registrace`,
`/login`, `/zamestnanci`, `/rodiny`, `/rodiny/:uid` including "nenalezeno"
stav) v mock-auth režimu — layout/formuláře/prázdné stavy correct.
**NEOVĚŘENO živě:** skutečný zápis do Firestore (registrace → založení
zaměstnance → založení rodiny/pěstouna/dítěte end-to-end) — bez
funkčního Auth/Firestore emulátoru na tomhle stroji nejde spustit
požadavek proti reálnému backendu, jen proti offline cache (prázdné
výsledky, ne chyba). Kód je napsaný a odůvodněný správně, ale "funguje
opravdu" zůstává neověřené tvrzení, dokud emulátor nebo reálný projekt
nepůjde spustit — poctivě přiznáno, ne zamlčeno.

---

## Dodatek 13 (2026-07-19): Vyčerpávající shoda s referenční appkou — typografie, barvy, formulářové prvky; žádná stopa reference v kódu

Uživatel: design je na ~97 %, ale žádá **doslovnou shodu** s referenční
appkou na všem měřitelném (fonty, velikosti, řezy, řádkování, nadpisy,
podnadpisy, text, odkazy, switch, pole a jejich barvy/outline, upozornění)
— "NIKDY NIC NEVYMÝŠLEJ". Zároveň: **v kódu nesmí být poznat, že
předlohou byla konkrétní cizí appka** — žádné jméno značky v komentářích,
proměnných ani dokumentaci.

**Přeměřeno znovu, přímo na živém DOMu (getComputedStyle, přepínáním
tématu v konzoli, ne odhadem):**
- **Font:** `geist, "geist Fallback", ...` — POTVRZENO, už jsme na Geist
  Sans správně (žádná změna nutná).
- **Nadpisy/podnadpisy:** stránkový titulek I vnitřní sekční nadpisy jsou
  STEJNĚ velké — 18px/**font-weight 400** (normal, ne semibold!), ne 28px/
  600 jak jsme měli. Opraveno na `text-lg font-normal` (`leading-normal`
  pro stránkový titulek, `leading-tight` pro vnitřní sekce) na "Dnes",
  "Vzhled", "Účet", "Čeká na vás", "Poslední zápisy" a všech H2 na
  `/_preview`. Field-labely (Jméno/E-mail apod.) 14px/500/`leading-relaxed`
  (byly 13px/15px).
- **Světlý režim byl ŠPATNĚ** — dosud jen odhad z CSS textu (nikdy
  fyzicky přepnuto a přeměřeno). Skutečné pořadí jasu ploch je STEJNÉ
  v obou režimech (void < app < surface-soft, surface-soft VŽDY
  nejsvětlejší) — světlý blok měl pořadí obráceně (app byl nejsvětlejší).
  Opraveno: `--bg-app:#FAFAFA` (bylo `#FFFFFF`), `--bg-surface-soft:#FFFFFF`
  (bylo `#ECECEC`), `--bg-void:#F5F5F5` (bylo `#E5E5E5`), `--bg-inset:#FFFFFF`
  (bylo `#E3E3E3`) — všechny tři hodnoty přímo potvrzené na skutečných
  vykreslených elementech (`getComputedStyle` na void wrapperu i hlavním
  panelu), ne jen na CSS proměnných. Dark `--bg-void` opraveno `#0F0F0F`
  → `#101010` (1 bod rozdíl, ale přesně naměřeno). `[data-theme='dark']`
  blok navíc chyběl `--border-subtle`/`--border-medium` (spadal na světlé
  hodnoty) — doplněno, nezávislý pre-existující bug objevený při této
  příležitosti.
- **Nový token `--accent: #4F69F2`** (modrá, KONSTANTNÍ přes obě témata) —
  vyhrazený pro interaktivní stav formulářových prvků. Použit na: Input
  focus border (`focus:border-accent`, dřív monochromní `--primary`),
  Switch ON track (`bg-accent`, dřív `bg-primary`), tučné inline odkazy
  (nový vzor, `font-bold text-accent`). Toto VĚDOMĚ obrací dřívější princip
  "barva jen na badge" pro TYHLE TŘI konkrétní prvky, na explicitní žádost
  uživatele — `--subject-ospod`/`--tier-accent`/ProgressBar zůstávají
  monochromní/nezměněné (nebyly součástí výslovného seznamu, kolize
  s `--subject-ospod` by porušila "jedna barva = jeden význam").
  Poznamenáno pro budoucnost (M9.5 org branding): tahle barva je kandidát
  na per-organizaci konfigurovatelnou hodnotu místo pevné konstanty.
- **Nový token `--toggle-off`** (Switch OFF track) — přeměřeno NEZÁVISLE
  na `--overlay-active` (jiný podkladový odstín v light: `rgba(115,115,115,.15)`
  šedá, ne černá — `--overlay-active` zůstává symetrický odhad, ne totéž).
  Dark obě hodnoty vycházejí stejně (`rgba(255,255,255,.15)`), proto jsme
  si dřív mysleli, že jde o jeden token.
- **Nový token `--toggle-thumb: #FAFAFA`** — Switch thumb, potvrzeno
  KONSTANTNÍ v obou režimech (na rozdíl od `--primary-foreground`, který
  se mezi tématy obrací — použití toho by v dark módu udělalo thumb tmavý).
- **Input** — border `border-border-medium` (15% alpha, přesně naměřeno,
  ne zaokrouhleno na `border-default` 10% jako dřív), zbytek (`bg-inset`,
  16px text kvůli §9.3, žádný ring) beze změny.
- **Button `outline`** — border opraven `border-border-medium` →
  `border-border-strong` (20% alpha, přesně naměřeno na tlačítku typu
  "Disconnect").
- **Nová stránka `/nastaveni/oznameni`** (`NotificationsSettingsPage.tsx`)
  — třetí reálná Nastavení stránka, dřív jen odkaz co nikam nevedl.
  Struktura/typografie 1:1 podle referenční "Notifications" sekce (sub-
  label 14px/medium, popisek 14px/secondary vedle Switch, drobný právní
  odstavec 12px/secondary s tučným `--accent` inline odkazem) — ale
  OBSAH je vlastní (e-mailová upozornění na úkoly/komentáře/termíny, ne
  převzatý cizí text o zpracování dat pro newsletter/reklamu, což by pro
  CRM pěstounské agentury bylo věcně nepravdivé).

**Sweep — odstranění jakékoli stopy konkrétní reference z kódu:** projito
`grep -ri` přes celý `app/` (13 souborů, ~50 výskytů) — všechny komentáře/
dokumentace přepsány na neutrální "živá referenční appka"/"referenční
export" apod., beze změny věcného obsahu (co bylo měřeno, jaké hodnoty,
jaká rozhodnutí). Literální exportované názvy souborů (konkrétní .html
názvy stránek) a config název statického serveru v `.claude/launch.json`
odstraněny z `CURRENT_STATE.md` prózy — funkční cesta ke složce zůstává
mimo tento repozitář (`nove zadani/.claude/launch.json`), zde jen obecně
popsaná, ne vypsaná. Git historie (commit messages) NEBYLA přepisována
(vyžadovalo by rebase/rewrite historie, riskantní destruktivní operace,
nebylo explicitně požadováno) — pokud je to potřeba i tam, řekni to
výslovně.

Ověřeno v prohlížeči v obou režimech na `/`, `/nastaveni/vzhled`,
`/nastaveni/ucet`, `/nastaveni/oznameni`, `/_preview` — accent modrá na
Switch/focus/odkazech přesně `rgb(79,105,242)`, nadpisy vizuálně nižší/
lehčí, světlý režim jemnější a konzistentní se stávajícím tmavým. Lint/
build/7 testů zelené.

---

## Dodatek 12 (2026-07-19): OPRAVA — druhá úroveň menu je samostatný panel, ne vnořená karta; dočasně vypnut auth gate

Uživatel po review Nastavení narazil na dvě věci:

1. **Strukturální chyba v layoutu.** Druhá úroveň menu (SettingsNav) byla
   vnořená JAKO SOUČÁST obsahu — jeden sdílený `bg-surface-soft` box s
   `p-5`, uvnitř kterého žily vedle sebe nav a content (Dodatek 9). Uživatel
   správně poukázal, že v referenční appce je to jinak: nav sloupec je
   SAMOSTATNÝ panel vedle sidebaru, obsah je DALŠÍ samostatný panel, oba
   nižší než sidebar (začínají pod TopBarem, ne od úplného vrchu).
   Přeměřeno znovu NEZÁVISLE na dvou nezávislých referenčních stránkách
   stejné appky (identická struktura na obou, takže je to jejich sdílený
   layout komponent, ne shoda náhodou): nav element a content panel
   jsou DVA samostatné zaoblené panely (`bg-surface-soft`)
   boxy s `gap-1` (4px) mezerou mezi sebou, KAŽDÝ s vlastním nezávislým
   scrollem (`overflow-y-auto`), oba stejné výšky, TopBar (`sticky top-0`)
   žije NAD oběma napříč celou šířkou (breadcrumb začíná na X souřadnici
   nav sloupce, ne až u obsahu — to už jsme měli správně). NAV šířka
   naměřena přesně 224px → `w-56` (Tailwindová hodnota, žádný odhad).
   Mezeru mezi sloupci jsme vědomě sjednotili na naši existující `gap-2`
   (8px) místo naměřených 4px, kvůli konzistenci s vnějším sidebar/main
   gapem — jediná vědomá odchylka od přeměřené hodnoty, zapsaná proto,
   aby byla průhledná.

   **Oprava:** `AppShell` dostal nový volitelný prop `secondaryPanel`. Když
   je zadaný, `AppShell` sám vykreslí dva nezávislé `bg-surface-soft`
   panely (nav `w-56 shrink-0`, content `flex-1 min-w-0`), oba s vlastním
   `overflow-y-auto`, pod společným TopBarem. `SettingsLayout.tsx` (celá
   komponenta) smazána — její práci teď dělá `AppShell` přímo.
   `SettingsNav` už nenese vlastní šířku/pozadí/scroll (to dřív dělalo
   `<nav className="w-full ... lg:w-[184px]">`), jen `<div className="space-y-4">`
   s obsahem — díky tomu jde `secondaryPanel` použít i pro BUDOUCÍ
   vyhledávání+seznam (Rodiny/Pěstouni/Děti, viz uživatelův požadavek)
   beze změny `AppShell`u, jen jiný obsah uvnitř téhož panelu.
   `AppearanceSettingsPage`/`AccountSettingsPage` upraveny na
   `<AppShell secondaryPanel={<SettingsNav .../>}>`.

2. **Auth gate blokoval review.** `/` byla pod `RequireAuth`, který bez
   funkčního Auth emulátoru (nejde spustit na tomhle stroji) přesměroval
   na `/login` — a tam žádné použitelné přihlašovací údaje nejsou (mock
   uživatel, ne reálný Firebase účet). Uživatel to nahlásil jako "nějak
   se nám tam dostal login". **Oprava:** `/` přesunuto do stejné dočasné
   mock-auth skupiny jako `/nastaveni/*` a `/_preview` (`src/routes/_mockAuth.ts`),
   `RequireAuth` už se v `App.tsx` nepoužívá (soubor `RequireAuth.tsx`
   zůstává nedotčený na disku pro M1). Až M1 přinese reálné přihlášení,
   vrátit `/` pod `RequireAuth` a mock wrapper smazat.

Ověřeno v prohlížeči (`/`, `/nastaveni/vzhled`, `/nastaveni/ucet`, `/_preview`)
v obou režimech, `getBoundingClientRect` potvrzuje nav (224px) a content
panel stejné výšky a nezávislé jako dva samostatné boxy, klik-navigace
mezi Vzhled/Účet funguje, `/_preview` beze změny (nepoužívá `secondaryPanel`,
takže běží starou jednosloupcovou cestou). Lint/build/7 testů zelené.

---

## Dodatek 11 (2026-07-19): Table, ProgressBar, Switch, SegmentedTabs, CopyableCodeBox + první reálné Nastavení stránky

Uživatel uložil 6 dalších referenčních stránek stejné appky (People, My
team, Subscription, MCP, Preferences/API keys/SSO/Projects/Plugins/
Following). Druhé kolo Workflow (5 agentů) je proměřilo — s poctivým
výsledkem: **Plan & billing a My Team se v uloženém exportu nepodařilo
vůbec zobrazit** (SPA routing v statické kopii spadává na výchozí stránku
bez ohledu na to, co se otevře) — agenti to nahlásili jako "NOT PRESENT",
nefabrikovali Danger zone ani plán/billing hodnoty. **People tabulku
naopak jeden agent dokázal zrekonstruovat** (vytáhl syrové HTML+CSS,
vyčistil `<script>` tagy co způsobovaly špatný redirect, vykreslil v
iframe) — odtud pochází reálné hodnoty tabulky.

**Klíčové zjištění — aktivní položka menu KONEČNĚ jednoznačně potvrzena:**
na referenční People stránce má aktivní položka `aria-current="page"` +
`bg-overlay-active` ekvivalent (`rgba(255,255,255,.15)`) — PŘESNĚ to, co
jsme si už v Dodatku 5 vybrali z opatrnosti/intuice. Dřívější "žádný
rozdíl nenalezen" (Dodatek 8) byl artefakt konkrétní staticky uložené
stránky, ne skutečnost — potvrzeno, naše volba byla správná.

**Nové tokeny** (`src/index.css`): `--border-subtle` (5% alpha, Plugins
list) a `--border-medium` (15% alpha — naměřeno NEZÁVISLE na dvou
komponentách: Input i MCP URL box, proto povýšeno na skutečný token).

**Nové komponenty:**
- `ui/table.tsx` — `Table`/`TableHeaderRow`/`TableRow`, CSS grid (ne
  `<table>`), naměřeno na People. Použito na `/_preview` s VLASTNÍM
  příkladem z DESIGN_SYSTEM.md §6.5 (vzdělávání pěstounů hodiny vs.
  limit), ne cizím referenčním obsahem.
- `ui/progress-bar.tsx` — track `--bg-surface-soft`, fill **monochromní
  `--primary`** (referenční appka má brand modrou `#4F69F2` — tu jsme
  vědomě NEpřevzali, koliduje s `--subject-ospod`, což by porušilo
  "jedna barva = jeden význam").
- `ui/segmented-tabs.tsx` — přesně naměřeno na klient-selectoru integrací:
  ŽÁDNÝ obalový pilulkový kontejner, každá volba samostatně `rounded-full`.
- `ui/switch.tsx` — track/thumb rozměry naměřené (Preferences), ale
  **ON stav NEBYL naměřitelný** (mock backend agentovi vracel chybu) —
  navržen podle vlastního principu (`--primary`/`--bg-surface`+stín),
  ne fabrikovaná hodnota. (Pozn. Dodatek 13: ON stav se později podařilo
  reálně přeměřit skutečným kliknutím — viz níž, hodnota se změnila.)
- `ui/copyable-code-box.tsx` — URL/kód box + copy tlačítko, přesně
  naměřeno na MCP stránce. Použitelné pro `/d/{UID}` ověřovací odkazy
  (§4.3) nebo budoucí webhook URL (§5.5 C).
- `Button` nová varianta `outline` (průhledné pozadí + border-medium) —
  naměřeno na "Learn more"/"Delete account" tlačítkách.
- `fontFamily.mono` (system monospace stack) v tailwind.config.js.

**Vědomě NEpostaveno** (žádná ground truth k dispozici, viz výše):
Danger zone box, Plan & billing card, My Team tabulka, upsell/funnel
banner (přítomný na 3 stránkách, ale je to marketingová komponenta pro
prodejní přesvědčování — nemáme pro ni teď reálné využití v CRM).

**Nastavení — první REÁLNÉ stránky** (ne jen `/_preview` vzorek):
`src/routes/settings/AppearanceSettingsPage.tsx` (`/nastaveni/vzhled`) a
`AccountSettingsPage.tsx` (`/nastaveni/ucet`), obě postavené na nových
`SettingsLayout`+`SettingsNav`+`Breadcrumb` komponentách. `useTheme.ts`
přepracován na skutečné 3-stavové `light|dark|system` (dřív jen binární
přepínač) — `SegmentedTabs` na stránce Vzhled je naplno funkční, ověřeno
klikem v prohlížeči (přepnutí funguje, perzistuje přes navigaci). Ikona
Nastavení v TopBaru teď vede na `/nastaveni/vzhled` (dřív nikam).
**DOČASNĚ mimo `RequireAuth`** stejným mock-auth mechanismem jako
`/_preview` (sdílený `src/routes/_mockAuth.ts`, role `org_admin` — aby šly
vidět OBĚ skupiny nested menu, "Obecné" i "Organizace") — přesunout pod
`RequireAuth` a smazat mock, jakmile M1 přinese reálné přihlášení.

Ověřeno v prohlížeči (`/_preview`, `/nastaveni/vzhled`, `/nastaveni/ucet`),
lint/build/testy zelené.

**Dodatečná oprava po review na plnou desktop šířku (1596px, ne zúžené
okno):** `SettingsNav` měl `lg:w-46` — v Tailwindu neexistuje (škála skáče
`w-44` → `w-48`, žádná `46`). Třída se nikdy nezkompilovala do CSS, takže
nav spadl na `w-full` i na `lg` breakpointu, zabral celý řádek a sourozenec
`min-w-0 flex-1` (obsah stránky) se smrskl na nulovou šířku — vizuálně to
vypadalo jako obsah nacpaný do nečitelného proužku u pravého okraje.
Opraveno na `lg:w-[184px]` (hodnota, na kterou by se `w-46` překládal,
kdyby existovala). Zároveň `CopyableCodeBox.handleCopy` volal
`navigator.clipboard.writeText` bez `try/catch` — když prohlížeč zápis do
schránky zamítne (permissions policy, nezabezpečený kontext, zamítnutý
prompt), promise spadne a `setCopied(true)` se nikdy nespustí, tlačítko
potichu nedělá nic. Obaleno do `try/catch`. Obojí ověřeno živě v
prohlížeči po opravě, lint/build/testy znovu zelené.

---

## Dodatek 9 (2026-07-19): ROZHODNUTO — Nastavení = celá stránka s breadcrumbem, NE modál

**Ruší DESIGN_SYSTEM.md §6.9 (modální okno se svislými záložkami, vzor
Claude.ai).** Uživatel se po Dodatku 8 rozhodl jít cestou referenční
appky: Nastavení dostane vlastní URL (`/nastaveni/profil` apod.) s
`Breadcrumb` komponentou ("Nastavení / Profil") nahoře a vnořeným levým
menu (sekce jako "Účet"/"Organizace", položky pod nimi — přesně struktura
naměřená v Dodatku 8: sekční label 10px/`--text-secondary`, položky
12px/500 no vizuální rozdíl aktivní/neaktivní v referenčním exportu — to
ale byla ztráta `aria-current` stylu ve statickém exportu, ne skutečný
záměr; **až se Nastavení bude reálně stavět, aktivní položka MUSÍ mít
vlastní vizuální stav** (např. `bg-overlay-active` stejně jako v hlavním
sidebaru), i když živý referenční export tenhle detail ztratil.

Netýká se M9.5 obsahu (které záložky vidí která role, §5.7 matice
viditelnosti platí beze změny) — jen KONTEJNERU (stránka+breadcrumb+vnořené
menu místo modálu+svislé taby). `Breadcrumb`/`Tag`/upravený `Input` z
Dodatku 8 jsou přesně ty stavební kameny, které tenhle kontejner bude
potřebovat.

**Další krok:** uživatel pošle uložené HTML exporty stránek People a
Plan & billing (stejný postup jako dosud — pravé tlačítko → Uložit
jako → kompletní HTML, do stejné místní referenční složky) — pak
doměřím tabulku (Members/Role/Credits), credits progress bar a "Danger
zone" box stejnou metodou (živý `getComputedStyle`, ne odhad).

---

## Dodatek 8 (2026-07-19): Breadcrumb, Input, Tag — z workflow extrakce (Teams/Settings stránka)

Uživatel poslal 5 screenshotů referenčních Settings obrazovek (Profile,
Plan & billing, Plugins, MCP, People) a trval na tom, ať hodnoty
NEODHADUJI, ale změřím přímo v místní uložené referenční složce. Spustil
jsem Workflow se 4 paralelními agenty, každý ve vlastním tabu otevřel živě
uloženou stránku (servírováno přes `npx serve`/`.claude/launch.json`
config statického referenčního serveru) a měřil
`getComputedStyle`/`getBoundingClientRect` na skutečném DOM.

**Nové/změněné komponenty:**

- **`src/components/ui/breadcrumb.tsx`** (nová) — text-xs (12px) po celé
  délce, STEJNÁ barva (`--text-primary`) pro aktivní i neaktivní úsek
  (text se nedimuje, jen aktivní úsek není odkaz + nemá hover
  pozadí). Oddělovač `/` jako CSS `::after` (ne DOM znak) — `--text-
  secondary` @ 50% opacity, 4px padding po stranách. Použit jako ukázka na
  `/_preview` (`Rodiny / Rodina Novákových`).
- **`src/components/ui/input.tsx`** upraven — klidové pozadí `--bg-inset`
  (dřív `--bg-surface`), border `--border-default` (dřív `--border-
  strong`), focus = `border-2 border-primary` BEZ ring/glow (na
  focus se jen zesílí a přebarví border, žádný box-shadow). **Vědomě
  NEpřevzato:** referenční Name input má 14px text a modrý (#4F69F2)
  focus border — necháváme 16px (§9.3, tvrdý požadavek kvůli
  iOS Safari zoomu) a monochromní `--primary` (barva zůstává jen na
  badge, vlastní princip z Dodatku 3). (Pozn. Dodatek 13: border a focus
  barva se později znovu přeměřily přesněji a hodnoty se změnily.)
- **`src/components/ui/tag.tsx`** (nová) + tokeny `--tier-accent`/`--tier-
  accent-bg` (`#FF58AE` / 15% alpha, konstantní přes obě témata) — malá
  pilulka pro úrovňové značky ("Business"/"New" na referenční appce). Zatím
  NIKDE funkčně nepoužito (§5.8 entitlementy nemají UI) — jen připraveno
  pro M9.5, ukázka na `/_preview` ("Prémiové" vedle breadcrumbu).

**Co jsem NEpřevzal, protože to v exportu vůbec nebylo (agent to
poctivě nahlásil jako "NOT PRESENT", ne odhadl):** tabulka Members/Role/
Credits, avatar v řádku tabulky, credits progress bar, tlačítko "Invite
members", box "Danger zone". Uložený soubor obsahuje jen podstránku
"Profile details" — People a Plan & billing nebyly zvlášť uloženy/
servírovány. **Pokud je chcete implementovat věrně, potřebuju uložit
i tyhle konkrétní podstránky** (stejným postupem — pravé tlačítko →
Uložit jako → kompletní HTML).

**Zjištění vyžadující rozhodnutí uživatele (zapsáno, nerozhoduji sám):**
vnořená navigace Nastavení v referenční appce je CELÁ STRÁNKA s breadcrumbem
("Settings / Profile") a vnořeným levým menu (Account/Organization
sekce) — náš `DESIGN_SYSTEM.md` §6.9 ale popisuje Nastavení jako MODÁLNÍ
okno se svislými záložkami (vzor Claude.ai). To je architektonický
rozdíl v celém přístupu k Nastavení, ne jen barva — needěláno, dokud
uživatel nepotvrdí, kterou cestou jít.

Ověřeno v prohlížeči (`/_preview`), oba režimy, lint/build/testy zelené.

---

## Dodatek 7 (2026-07-19): sidebar = stejná barva jako hlavní obsah, žádná identita dole

Dvě drobné, rychlé úpravy na žádost uživatele:

1. **`Sidebar.tsx` teď má `bg-app`** (stejný token jako hlavní panel), ne
   `bg-surface-soft` — sidebar a hlavní obsah jsou teď barevně TOTOŽNÉ,
   odlišuje je jen mezera (`--bg-void`) mezi panely, ne odstín. (Token
   `--bg-surface-soft` zůstává v `index.css` definovaný pro budoucí použití
   jinde — jen sidebar ho přestal používat.)
2. **Odstraněn spodní řádek s avatarem/jménem uživatele ze Sidebaru** —
   duplicitní s účtem v TopBaru vpravo nahoře (§ viz Dodatek 4/5). Sidebar
   teď obsahuje jen logo/collapse tlačítko + navigaci, žádnou identitu ani
   akci. `useAuth` import ze `Sidebar.tsx` odstraněn (už se tam nic z něj
   nepoužívá).

Ověřeno v prohlížeči, oba režimy, lint/build zelené.

---

## Dodatek 6 (2026-07-19): font — Geist Sans všude, žádný serif

Uživatel potvrdil: přejít na Geist plošně, ŽÁDNÝ serif nikde (rušíme H1
výjimku z původního DESIGN_SYSTEM.md §3, která odkazovala na Claude.ai).

- `@fontsource/inter` a `@fontsource/source-serif-4` ODEBRÁNY,
  `@fontsource/geist-sans` (Vercel, MIT, self-hosted stejným vzorem jako
  předtím) nainstalován — váhy 400/500/600 v `main.tsx`.
- `src/index.css`: `body` font-family → `'Geist Sans', system-ui,
  sans-serif`; pravidlo `h1 { font-family: 'Source Serif 4'... }` smazáno.
- `tailwind.config.js`: `fontFamily.sans` → Geist Sans, `fontFamily.serif`
  odstraněno (nic ho už nepoužívá).
- `font-serif` třída odstraněna ze všech 4 výskytů (`Sidebar.tsx`,
  `DashboardPage.tsx`, `DesignPreviewPage.tsx`, `LoginPage.tsx`) — H1 teď
  jede na stejném sans jako zbytek appky, jen větší/tučnější.

Ověřeno v prohlížeči (`document.fonts`, computed `font-family`) — Geist
Sans 400/500/600 se načítá a aplikuje správně v obou režimech.

---

## Dodatek 5 (2026-07-19): přeměřeno přímo na živé referenční appce (ne odhad)

Uživatel po Dodatku 4 napsal "STÁLE TO NENÍ ONO" a poslal screenshot naší
appky, který ukázal, že dosavadní hodnoty (Dodatek 3/4) byly moc "hrubé" —
moc velké skoky mezi void/sidebar/obsah, moc velké radiusy, moc silný
aktivní stav navigace. Místo dalšího grepování minifikovaného CSS jsem
otevřel živou referenční appku znovu
lokálně (`npx serve`) a použil `getComputedStyle`/`getBoundingClientRect`
PŘÍMO na živých elementech (void, sidebar panel, hlavní panel, nav
položky, header) — tohle je spolehlivější zdroj pravdy než čtení CSS textu
nebo odhad ze screenshotu, protože dá přesné, finální (cascade-resolved)
hodnoty.

**Zásadní zjištění, které jsem měl špatně:** myslel jsem si, že sidebar
i hlavní obsah jsou DVA STEJNĚ nápadné plovoucí panely. Ve skutečnosti:
- **`--bg-void`** (body pozadí): `rgb(15,15,15)` = `#0F0F0F`
- **sidebar panel** (skutečný `<nav>` element, ne jen wrapper): `rgb(26,26,26)`
  = `#1A1A1A`
- **hlavní obsah panel**: `rgb(22,22,22)` = `#161616`

Tři tóny jsou od sebe jen ~5–11 bodů RGB — MNOHEM jemnější přechod, než
jsme měli (dřív `#000000`→`#101010`→`#2B2B2B`, tedy skoky přes 40+ bodů).
Přepsáno v `src/index.css` (dark blok): `--bg-void:#0F0F0F`,
`--bg-app:#161616` (teď = hlavní panel, ne samostatná "plátno" vrstva),
`--bg-surface-soft:#1A1A1A` (sidebar), `--bg-surface:#202020`/
`--bg-inset:#2A2A2A` (extrapolováno stejným jemným krokem, nebyly přímo
na této obrazovce k naměření).

**Další přeměřené detaily, teď opravené:**
- Šířka sidebaru: **224px** (`w-56`), ne 240px.
- Header/TopBar: výška **56px** (`h-14`), padding **`px-4`** (ne `px-8`),
  `shrink-0` — NESCROLUJE s obsahem (opraveno v `AppShell.tsx`, dřív celý
  `<main>` scrolloval včetně TopBaru).
- Ikonová tlačítka (TopBar): **32px** (`size-8`), radius **8px**
  (`rounded-sm`, ne `rounded-md`).
- Nav položky (Sidebar): výška ~32px (`h-8`), radius **8px**
  (`rounded-sm`), gap 10px mezi ikonou a textem.
- **Aktivní stav navigace NENÍ plná barva** (`--primary-soft`) — je to
  jemný **alpha overlay** `rgba(255,255,255,.15)` (dark) přes CELOU
  položku. Nový token `--overlay-active` (light: `rgba(0,0,0,.06)`,
  odhad, nebyl přímo měřen). Stejný token používá i `hover:` stav a
  logo/collapse tlačítko — nahrazuje `hover:bg-surface`/`hover:bg-surface-soft`
  všude v Sidebar/TopBar.
- **Text nav položek je STEJNĚ jasný aktivní i neaktivní** (`rgb(245,245,245)`
  konstantně) — text se nedimuje pro "neaktivní" stav, rozlišuje
  VÝHRADNĚ přes pozadí. Změněno z `text-text-secondary` na `text-text-primary`
  pro všechny nav položky.
- Font je **Geist** (Vercel, MIT licence, ne ChatGPT proprietární "OpenAI
  Sans" jak jsem se dřív domníval), 400 weight, ŽÁDNÝ serif nikde. **Tohle
  jsem NEZMĚNIL** — `h1` pořád používá Source Serif 4 z původního
  DESIGN_SYSTEM.md. Je to vědomé podržení, ne přehlédnutí: serif byl
  explicitní součást PŮVODNÍHO zadání (nod ke Claude.ai), nikdo si na něj
  nestěžoval přímo, a je to větší identitní rozhodnutí než paleta/tvar —
  ptám se uživatele explicitně, než bych ho sám smazal.

**Past při ladění:** `resize_window` s explicitními `width`/`height` dál
produkuje zdeformovaný screenshot (viz Dodatek 4) — `preset: 'desktop'`
funguje spolehlivě, používat ten pro vizuální review.

Reference zůstává v místní referenční složce mimo tento repozitář
— HTML lze znovu otevřít přes `npx --yes serve -l 4321 .` v tom adresáři
(nebo příslušný statický-server config v `.claude/launch.json` v `nove zadani/`)
a měřit přímo `getComputedStyle`, ne jen číst CSS text — mnohem
spolehlivější metoda, použít ji hned příště, ne až po druhém "není to ono".

---

## Dodatek 4 (2026-07-19): plovoucí panely + přesun akcí do TopBaru

Třetí kolo zpětné vazby, dvě věci:

1. **Nastavení + přepínač Světlý/Tmavý přesunuty ze sidebaru do TopBaru** —
   `Sidebar.tsx` teď má dole JEN identitu uživatele (avatar+jméno), žádné
   akce. `TopBar.tsx` má ikonový cluster vpravo (bez textových labelů):
   motiv → nastavení (zatím bez funkce, jen ikona) → oznámení → účet, v
   tomhle pořadí, avatar úplně vpravo. `useTheme()` se přesunul ze
   Sidebaru do TopBaru.
   **Princip pro budoucí stavové ikony** (zapsáno na výslovnou žádost):
   ikona reprezentující zapnutou/vypnutou "službu" (např. ztlumená
   oznámení) MUSÍ vizuálně odlišit stav (jiná ikona jako `BellOff`, ne
   stejná ikona bez ohledu na stav) — zvonek zatím jen otevírá panel
   (není to on/off přepínač), princip se uplatní až s M9.
2. **Layout „plovoucích panelů"** — sidebar a hlavní obsah už nejsou
   edge-to-edge, ale dva samostatné `rounded-lg` panely s `gap-2`/`p-2`
   mezerou na nové ploše `--bg-void` (světle šedá `#E5E5E5` v light, čistá
   černá `#000000` v dark — o úroveň tmavší/světlejší než `--bg-app`).
   Ověřeno vizuálně v obou režimech, sbalení sidebaru kliknutím na logo
   funguje beze změny uvnitř nového layoutu.
   **Past při ověřování:** `resize_window` s explicitními
   `width`/`height` (1280×800) produkoval zdeformovaný/zmenšený screenshot
   (obsah zabíral jen ~74 % plochy), i když `getBoundingClientRect`
   potvrzoval správné 1280×800 rozvržení — je to artefakt nástroje
   screenshotu při explicitním rozlišení, ne chyba appky. `resize_window`
   s `preset: 'desktop'` (nativní velikost) renderuje/screenshotuje
   správně. Používej `preset`, ne explicitní `width`/`height`, pro vizuální
   review.
3. **Border na kartách zatím NEODSTRANĚN** — uživatel upozornil, že
   referenční elevated plochy nemají žádnou viditelnou outline. Náš
   `--border-default` je už jen 10% alpha, což při vizuální kontrole v
   dark módu nepůsobí jako tvrdá čára — ponecháno beze změny, ale je to
   vědomé rozhodnutí (ne přehlédnutí), zmínit uživateli při schvalování.

Zdroj reference: místní referenční složka mimo tento repozitář
(HTML/CSS export + screenshot dodaný přímo v konverzaci).

---

## Dodatek 3 (2026-07-19): design tokeny v3 — živá referenční appka, tmavší dark mode, sidebar úpravy

Uživatel schválil směr v2, ale se třemi konkrétními úpravami:

1. **Sidebar:** žádný samostatný "Sbalit" řádek dole — kliknutí na logo
   nahoře (`Sidebar.tsx`) teď přepíná collapsed/expanded stav. Ověřeno
   klikem v prohlížeči, funguje.
2. **Přepínač Světlý/Tmavý přesunut do Sidebaru** (řádek nad "Nastavení",
   ikona Moon/Sun podle CÍLOVÉHO stavu) — nový `src/hooks/useTheme.ts`,
   nastavuje `data-theme` na `<html>` + ukládá volbu do `localStorage`
   (`doprovazeni.theme`) jako dočasnou náhradu za `users/{uid}.
   preferences.appearance` (§5.6/M9.5). `/_preview` už nemá svoje vlastní
   tlačítko — dědí ho ze Sidebaru jako každá jiná stránka.
3. **Tmavý režim o dost tmavší** + **kompletní přeladění barev podle
   reálné produkční škály živé referenční appky** (dodaný HTML/CSS export
   v místní referenční složce, otevřen lokálně
   přes `npx serve` a fyzicky ověřen v prohlížeči, ne jen čten jako text).

**Token hodnoty přepsané na reálné `--color-surface-*`/`--color-*-alpha`/
`--color-alert-icon-*` z referenční appky:**
- `--bg-app/-surface/-surface-soft/-inset`: `#FFF/#F5F5F5/#ECECEC/#E3E3E3`
  (light), `#101010/#1A1A1A/#2B2B2B/#353535` (dark) — POZOR, směr elevace
  se mezi tématy OBRACÍ (v light je karta (surface) tmavší/šedější než
  plátno (app), v dark je karta SVĚTLEJŠÍ než plátno) — to je záměrné,
  přesně jak to dělá referenční appka, ne chyba.
- **Zjednodušení oproti v2:** sémantické foreground barvy (`--success`,
  `--warning`, `--danger`, `--subject-foster/-ospod/-bio`) jsou teď
  KONSTANTNÍ napříč light/dark (přesně jak to má referenční appka — mění se jen
  jejich `-bg` protějšek). To ruší potřebu z v2 dark-mode badge barvy
  zesvětlovat kvůli čitelnosti. `--danger-solid` zůstává samostatný
  konstantní token (sytější červená než `--danger`) — pořád ho potřebuje
  jen destruktivní tlačítko (§6.1), kde plná plocha s bílým textem
  vyžaduje víc sytosti než badge text.
- `--subject-foster`/`--success`: `#14A372` (bylo `#4A7C59`) — teal-zelená
  z referenční appky (`alert-icon-success`).
- `--subject-ospod`: `#4F69F2` (bylo `#4A6FA5`) — referenční appka
  (`alert-icon-information`/`primary` modrá, POZOR: tohle je i jejich brand primary —
  u nás je unikátní jen pro OSPOD badge, naše `--primary` zůstává
  monochromní, žádná kolize).
- `--subject-bio`/`--warning`: `#E7AD16` (bylo `#A8752A`).
- `--crisis`/`--danger`: `#F66950` (bylo `#C05B4D`), `--danger-solid`:
  `#DA2A0B` (referenční appka, `destructive-1` dark).
- `--subject-court`: beze změny (`#6B7280`) — nemá odpovídající ekvivalent,
  zůstává náš vlastní neutrální tón.
- `--primary-foreground` (light): `#FAFAFA` (ne čistá bílá) — drobný
  detail z jejich `primary-foreground-0`.

Ověřeno v prohlížeči (`/_preview`, computed styles i vizuálně, oba
režimy) — hodnoty sedí přesně na tokeny výše.

**Poznámka k místní referenční složce:** obsahuje teď DVĚ reference
(ChatGPT dump + druhá referenční podsložka) — obojí zůstává smazat, jakmile
uživatel potvrdí, že už je nepotřebuje.

---

## Dodatek 2 (2026-07-18): design tokeny v2 — grayscale ChatGPT směr

Uživatel po zhlédnutí `/_preview` shellu potvrdil směr (sidebar+karty), ale
požádal o přepracování PALETY blíž ke ChatGPT: **UI chrome (pozadí, karty,
tlačítka, text) jen šedá/bílá/černá — barva je vyhrazená VÝHRADNĚ
subjektovým badge/výstrahám.** Dodal referenční HTML/CSS export ChatGPT
(`../nove zadani/pak-smazat-inspirace-chatgpt/`, smazat po dokončení) pro
zjištění reálné škály (`--gray-25…975`, `--main-surface-*`,
`--sidebar-surface-*`) — hodnoty tokenů níže z něj vychází, ne z odhadu.

**Tohle mění dřívější `DESIGN_SYSTEM.md` (v `nove zadani/`) na dvou místech
— dokument samotný jsem NEEDITOVAL (je to dodaný brief, ne repo soubor),
ale zaznamenávám odchylku tady, ať se neztratí:**
- §2.1 (barvy) — teplá krémová/teal paleta nahrazena šedou/bílou/černou.
  Subjektové barvy (§2.2) a tři úrovně stavů dokumentů (§2.3) zůstávají
  BEZE ZMĚNY — pořád jediné místo s barvou.
- §12 bod 9 (NIKDY dark mode) — ZRUŠENO na výslovnou žádost (uživatel
  poslal světlý i tmavý referenční screenshot). Světlý i tmavý režim
  jsou teď oba v `src/index.css`, přepínatelné přes `prefers-color-scheme`
  nebo `[data-theme]` (pro budoucí přepínač §5.6).

**Nové/změněné tokeny** (`src/index.css`, zrcadleno v `tailwind.config.js`):
- `--bg-app/-surface/-surface-soft/-inset`: teď `#F9F9F9/#FFF/#F3F3F3/#ECECEC`
  (light), `#212121/#2B2B2B/#262626/#333333` (dark) — místo cream škály.
- `--text-primary/-secondary/-tertiary`: `#171717/#676767/#9B9B9B` (light),
  `#EDEDED/#A0A0A0/#737373` (dark) — místo teplé skoro-černé.
- `--primary`: teď MONOCHROMNÍ (skoro černá v light, skoro bílá v dark),
  NE teal — přesně princip "barva jen na badge/výstraze". Nový token
  `--primary-foreground` (text NA primárním tlačítku, obrací se s tématem)
  — `Button.tsx` primary varianta ho používá misto natvrdo `text-white`.
- **Past, na kterou jsem narazil a opravil:** subjektové/sémantické barvy
  (`--danger` aj.) se v dark módu zesvětlují kvůli čitelnosti jako badge
  text na tmavém pozadí — ale destruktivní tlačítko (§6.1) potřebuje
  sytou plochu pro bílý text, ne zesvětlenou. Řešení: nový konstantní
  token `--danger-solid` (stejná hodnota v obou režimech), destruktivní
  varianta Button.tsx ho používá místo `--danger`.
- `--border-default/-strong`: teď alpha-black/white (`rgba(0,0,0,.1)` light,
  `rgba(255,255,255,.12)` dark) místo pevného hexu — funguje nad
  libovolnou plochou v obou režimech.
- Font zůstává Inter + Source Serif 4 (H1) — ChatGPT používá vlastní
  proprietární "OpenAI Sans", tu nelze/nemá smysl kopírovat, Inter je
  nejbližší volně dostupná alternativa a nebyla součástí připomínky.

**Ověřeno v prohlížeči** (`/_preview`, `/login`) — screenshoty i computed
styles v obou režimech (`resize_window` s `colorScheme: light/dark`),
včetně opravy bugu (dev server nesebral nový `tailwind.config.js` klíč
`primary.foreground` bez restartu — po restartu `npm run build` i dev
server generují `.text-primary-foreground` správně).

Čeká na finální schválení uživatele, než se stane závazným pro M1+.

---

## Stav: M0 hotový (2026-07-18)

### Co je hotové

- **Scaffold:** Vite + React 19 + TypeScript + Tailwind CSS v3 (bez shadcn
  CLI — viz "Rozhodnutí" níže). oxlint místo ESLint (Vite template default).
  Path alias `@/*` → `src/*`.
- **Design tokeny** (`src/index.css`, `tailwind.config.js`) — 1:1 opsané z
  DESIGN_SYSTEM.md §2. Inter + Source Serif 4 přes `@fontsource/*`
  (self-hosted, funguje offline v PWA — ne Google Fonts CDN).
- **Firebase Auth + role model** — `src/lib/firebase.ts` (env-based config,
  žádné reálné produkční credentials v repu), `src/types/user.ts` (role
  enum přesně dle §5), `src/contexts/AuthContext.tsx` (JEDINÝ realtime
  listener v appce = vlastní profil uživatele, přesně dle §10).
- **UID systém** (`src/lib/uid.ts`, `src/lib/counters.ts`) — EAN-13
  checksum, `buildUid`/`isValidUid`, transakční čítač
  `counters/{orgId}_{typ}`. 7 unit testů v `src/lib/uid.test.ts`, všechny
  procházejí (`npm run test`).
- **firestore.rules skeleton** — `isStaff()`/`isReadOnlyManager()`/
  `sameOrg()` helpery, `users/{uid}` read rules, `counters/{id}` rules.
  `users/{uid}` create/update/delete je záměrně `if false` (seam, viz níže).
- **Rules-unit-testing harness** — `tests/rules/m0.rules.test.ts`, 8
  scénářů vč. §5 "Klíčová past" (non-staff se sameOrg nesmí dostat k
  cizímu profilu). **NAPSÁNO, ale NEOVĚŘENO spuštěním** — viz TODO níže.
- **PWA + routing** — `vite-plugin-pwa` (manifest theme/background =
  `--bg-app`, ne bílá), React Router s lazy-loaded routami (`/login`,
  `/` za `RequireAuth`).
- **Lint + build zelené** (`npm run lint`, `npm run build`).
- **Ověřeno v prohlížeči** (`npm run dev`, ne jen build): nepřihlášený
  uživatel je přesměrován na `/login`, formulář se vykreslí správně, a
  computed styles sedí na tokeny — `body` bg `rgb(250,249,245)` (`--bg-app`),
  primární tlačítko bg `rgb(44,110,99)` (`--primary`) s `radius 12px`
  (`--radius-md`), H1 `Source Serif 4` 28px. Lokální dev vyžaduje
  `.env.local` (viz `.env.example`) — bez něj `getAuth()` hází
  `auth/invalid-api-key` synchronně a celá appka zůstane prázdná stránka
  bez jediné console chyby zachycené běžnými nástroji (objevilo se to jen
  přes `import()` v konzoli). Pro čistě emulátorový lokální vývoj stačí
  dummy hodnoty (`demo-api-key` apod.) — `.env.local` je gitignored.

### Dodatek (2026-07-18, po zpětné vazbě): hlavní shell přidán do M0

Uživatel oprávněně namítl, že samotná přihlašovací stránka nedokazuje nic o
cíli "vypadat jako Claude.ai/Gemini/ChatGPT/Mistral" — to dokazuje až hlavní
kostra appky (sidebar + obsah), ne login formulář. Metodika sama říká
"vzorek před sweepem" u čehokoli vizuálního (§11 bod 2) — měl jsem tímhle
vzorkem začít, ne přihlašovačkou. Doplněno proto ještě v M0:

- **`src/components/shell/Sidebar.tsx`** — 240px, `bg-surface-soft`,
  sbalitelná na ikonový rail, aktivní položka `primary-soft`/`primary`
  přesně dle DESIGN_SYSTEM §4. Navigační položky (Dnes/Rodiny/Úkoly/
  Kalendář/Dokumenty) jsou reprezentativní ukázka, ne finální
  role-aware seznam (ten je funkční záležitost M1+).
- **`src/components/shell/AppShell.tsx`** — sidebar + obsah na `--bg-app`,
  max-width 1200px vycentrovaný.
- **`src/components/FamilyCard.tsx`**, **`src/components/ui/badge.tsx`**,
  **`src/components/ui/empty-state.tsx`** — přesně dle mikro-příkladu §14,
  badge §6.3, prázdný stav §6.7.
- **`DashboardPage.tsx`** teď staví na `AppShell` + ukázkových datech
  (`TodaySampleSections`) — vizuál je tam, reálný dotaz nad Dohodami/
  timeline přijde s M2/M3.
- **`/_preview` route + `DesignPreviewPage.tsx`** — DOČASNÁ, obchází
  `RequireAuth` (žádný funkční backend zatím, viz emulator TODO níže),
  aby šel shell rovnou ukázat v prohlížeči bez přihlášení. **Smazat s M1**,
  jakmile jde stejný shell ověřit reálným přihlášením.

Tenhle vzorek čeká na schválení uživatelem, než se stane vzorem pro
všechny další obrazovky M1+ — neopakuj sidebar/kartu/badge vzor jinam,
dokud nepadne potvrzení.

### Rozhodnutí padlá při stavbě (proti čemu neregredovat)

1. **§5.8 byznys model:** vše zdarma zatím, žádné UI k placení. Datový
   model `plan.tier`/`entitlements` se přidá až s M9.5/M12 podle potřeby.
2. **§13.2 sharingLevel:** sjednoceno — `private|internal|foster|ospod`
   napříč chatem/dokumenty/zápisníkem. Zavést konzistentně od M2/M3.
3. **§13.3 AI krok zápisníku:** volitelný. M3 musí mít cestu "Uložit
   doslovný zápis" bez AI kroku.
4. **§13.4 data externisty:** potvrzeno — jen jméno/e-mail/telefon, žádné
   RČ/WhatsApp.
5. **Frontend stack:** React+Vite+TS+Tailwind, shadcn/ui CLI se
   NEPOUŽÍVÁ — primitivy (Button, Input, časem Dialog/Drawer/Tabs/Command
   paleta) se píšou ručně přímo nad Radixem a tokeny z DESIGN_SYSTEM.md.
   Důvod: shadcn CLI scaffolduje generický default theme, který by se stejně
   musel kompletně přetokenizovat — psaní rovnou proti našim tokenům je
   míň práce, ne víc. `class-variance-authority` + `clsx`/`tailwind-merge`
   (`cn()` helper v `src/lib/utils.ts`) zůstávají — to jsou obecné nástroje,
   ne shadcn-specifické.
6. **Mobil/PWA → budoucí iOS/Android:** Capacitor obalující stejný PWA
   build, ŽÁDNÁ druhá React Native codebase. Zatím nezavedeno (žádný
   Capacitor kód v repu) — teprve M11+ nebo když bude reálná potřeba app
   store distribuce.
7. **Tailwind v3** (ne v4) — DESIGN_SYSTEM.md výslovně mluví o
   `tailwind.config.js`, což je v3 vzor. V4 by šlo taky, ale nebyl důvod
   odchýlit se od doslovného znění zadání.
8. **`users/{uid}` create/update/delete = `if false`** — vědomý seam.
   Vytváření profilu je bezpečnostně citlivé (role se odtud čte přímo, bez
   Custom Claims pojistky) a musí být vázané na existující pozvánku
   (`foster_invitations`/`ep_invitations`, §6 A6) nebo na org_admina
   zakládajícího zaměstnance (§6 A9) — obojí přichází s M1/M4. Do té doby
   se testovací uživatelé sedí přes Admin SDK / `withSecurityRulesDisabled`
   v testech, nikdy přes klienta.
9. **`.firebaserc` → `demo-doprovazeni`** — placeholder, ŽÁDNÝ reálný
   Firebase/GCP projekt zatím neexistuje. Až org registrace (M1) bude
   potřebovat skutečné prostředí, založit reálný projekt a přepsat.

### TODO / otevřené seamy (poctivě, §11 bod 7)

- **Firestore emulator se na tomhle stroji nepodařilo spustit** —
  `firebase emulators:exec` padá na Netty/JDK loopback-socket chybě
  (`UnixDomainSockets.connect ... Invalid argument`), zkoušeno s Java 11 i
  21, s `WindowsSelectorProvider` flagem i bez sandboxu. Vypadá to na
  síťovou/Winsock nebo VPN/AV kolizi specifickou pro tenhle stroj, ne na
  chybu v kódu. **`tests/rules/m0.rules.test.ts` je napsaný a měl by být
  strukturálně správný, ale NENÍ ověřeno, že reálně prochází** — spusť
  `npm run test:rules` na jiném stroji / po vyřešení lokální Java
  síťové kolize, než na tenhle test suite spoléháš jako na hotový.
- PWA manifest má jen placeholder SVG ikonu (teal kruh) — reálné logo a
  192/512 PNG + maskable varianta čekají na M9.5 (branding).
- Bundle warning při buildu (~780 kB hlavní chunk, hlavně Firebase SDK) —
  neřešeno teď (žádné další routy na rozdělení), ale až přibudou moduly
  s vlastními routami (M1+), zkontrolovat, že lazy-loading routy skutečně
  drží hlavní chunk malý, případně přidat `manualChunks` pro `firebase/*`.
- Žádný skutečný Firebase/GCP projekt zatím neexistuje — `.env.local` si
  každý vývojář založí sám z `.env.example`, produkční nasazení řeší M11+.

### Jak pokračovat (M0–M7 hotové, viz sekce "M6+M7 hotové" úplně nahoře souboru)

M0 až M7 (vč. retrofitu DOPLNENI_ZADANI-DO-M5.md) jsou hotové — detaily,
seamy a co zůstává neověřené jsou v sekci "M6+M7 hotové" úplně nahoře
souboru, čti tu, ne tohle staré shrnutí (zbytek souboru pod ním je
historický log jednotlivých modulů, užitečný pro kontext KDYŽ potřebuješ
vědět PROČ něco vypadá, jak vypadá). Řiď se `NOVE-ZADANI-M6-AZ-KONEC.md`
(NE starým `old__ZADANI-PRO-NOVEHO-PROGRAMATORA (2).md`) pro cokoli od
M8 dál. Další v pořadí dle jeho vlastní sekvence: **M8 (externí
spolupracovníci — plný grant/permission engine + §5.1 povinná rules test
sada)** — `externalParticipantService.ts` už má MINIMÁLNÍ CRUD (§5.1
základ), M8 na to naváže plným `requestGrant→approveGrant→activateGrant`
tokem a `externalRoleTemplates`. Firestore emulátor se na tomhle stroji
STÁLE nepodařilo rozchodit (JDK < 21, blokér od M0) — než začneš psát
rules testy pro M8, zkus napřed jiný stroj / novější JDK, jinak skončíš
jako M6+M7: manuální review + živé ověření místo automatizované sady.
