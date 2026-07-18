# CURRENT_STATE.md

> Čti tohle PŘED zadáním (viz ZADANI §11 bod 1: "čti mapu, ne území").
> Odkazuje na `ZADANI-PRO-NOVEHO-PROGRAMATORA.md` a `DESIGN_SYSTEM.md` v
> `../nove zadani/` — ty jsou zdroj pravdy pro CO a JAK, tenhle soubor jen
> říká CO UŽ JE HOTOVO a jaká rozhodnutí padla cestou.

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

## Dodatek 5 (2026-07-19): přeměřeno přímo na živé Magnific appce (ne odhad)

Uživatel po Dodatku 4 napsal "STÁLE TO NENÍ ONO" a poslal screenshot naší
appky, který ukázal, že dosavadní hodnoty (Dodatek 3/4) byly moc "hrubé" —
moc velké skoky mezi void/sidebar/obsah, moc velké radiusy, moc silný
aktivní stav navigace. Místo dalšího grepování minifikovaného CSS jsem
otevřel `maginific/Magnific _ All-in-One AI Creative Suite.html` znovu
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
  konstantně) — Magnific nedimuje text pro "neaktivní" stav, rozlišuje
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

Reference zůstává `../nove zadani/pak-smazat-inspirace-chatgpt/maginific/`
— HTML lze znovu otevřít přes `npx --yes serve -l 4321 .` v tom adresáři
(nebo `.claude/launch.json` config `magnific-inspiration` v `nove zadani/`)
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
   Magnific elevated plochy nemají žádnou viditelnou outline. Náš
   `--border-default` je už jen 10% alpha, což při vizuální kontrole v
   dark módu nepůsobí jako tvrdá čára — ponecháno beze změny, ale je to
   vědomé rozhodnutí (ne přehlédnutí), zmínit uživateli při schvalování.

Zdroj reference: `../nove zadani/pak-smazat-inspirace-chatgpt/maginific/`
(HTML/CSS export + screenshot dodaný přímo v konverzaci).

---

## Dodatek 3 (2026-07-19): design tokeny v3 — Magnific.ai referencia, tmavší dark mode, sidebar úpravy

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
   reálné Magnific.ai produkční škály** (dodaný HTML/CSS export v
   `../nove zadani/pak-smazat-inspirace-chatgpt/maginific/`, otevřen lokálně
   přes `npx serve` a fyzicky ověřen v prohlížeči, ne jen čten jako text).

**Token hodnoty přepsané na Magnific `--color-surface-*`/`--color-*-alpha`/
`--color-alert-icon-*`:**
- `--bg-app/-surface/-surface-soft/-inset`: `#FFF/#F5F5F5/#ECECEC/#E3E3E3`
  (light), `#101010/#1A1A1A/#2B2B2B/#353535` (dark) — POZOR, směr elevace
  se mezi tématy OBRACÍ (v light je karta (surface) tmavší/šedější než
  plátno (app), v dark je karta SVĚTLEJŠÍ než plátno) — to je záměrné,
  přesně jak to dělá Magnific, ne chyba.
- **Zjednodušení oproti v2:** sémantické foreground barvy (`--success`,
  `--warning`, `--danger`, `--subject-foster/-ospod/-bio`) jsou teď
  KONSTANTNÍ napříč light/dark (přesně jak to má Magnific — mění se jen
  jejich `-bg` protějšek). To ruší potřebu z v2 dark-mode badge barvy
  zesvětlovat kvůli čitelnosti. `--danger-solid` zůstává samostatný
  konstantní token (sytější červená než `--danger`) — pořád ho potřebuje
  jen destruktivní tlačítko (§6.1), kde plná plocha s bílým textem
  vyžaduje víc sytosti než badge text.
- `--subject-foster`/`--success`: `#14A372` (bylo `#4A7C59`) — teal-zelená
  z Magnific `alert-icon-success`.
- `--subject-ospod`: `#4F69F2` (bylo `#4A6FA5`) — Magnific `alert-icon-
  information`/`primary` modrá (POZOR: tohle je i jejich brand primary —
  u nás je unikátní jen pro OSPOD badge, naše `--primary` zůstává
  monochromní, žádná kolize).
- `--subject-bio`/`--warning`: `#E7AD16` (bylo `#A8752A`).
- `--crisis`/`--danger`: `#F66950` (bylo `#C05B4D`), `--danger-solid`:
  `#DA2A0B` (Magnific `destructive-1` dark).
- `--subject-court`: beze změny (`#6B7280`) — nemá magnific ekvivalent,
  zůstává náš vlastní neutrální tón.
- `--primary-foreground` (light): `#FAFAFA` (ne čistá bílá) — drobný
  detail z jejich `primary-foreground-0`.

Ověřeno v prohlížeči (`/_preview`, computed styles i vizuálně, oba
režimy) — hodnoty sedí přesně na tokeny výše.

**Poznámka k `pak-smazat-inspirace-chatgpt/`:** obsahuje teď DVĚ reference
(ChatGPT dump + `maginific/` podsložka) — obojí zůstává smazat, jakmile
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

### Jak pokračovat (M1)

Organizace + zaměstnanci CRUD, Spis/Dítě/fosterPerson základ. Tohle je
první modul, který skutečně potřebuje `allocateUid()` (`src/lib/counters.ts`)
a rozbije seam v `users/{uid}` create (A9 workflow — org_admin zakládá
zaměstnance). Než začneš, přečti si `ZADANI §4.1, §4.2, §6 A9` — ne celý
dokument znovu.
