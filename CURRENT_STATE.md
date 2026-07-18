# CURRENT_STATE.md

> Čti tohle PŘED zadáním (viz ZADANI §11 bod 1: "čti mapu, ne území").
> Odkazuje na `ZADANI-PRO-NOVEHO-PROGRAMATORA.md` a `DESIGN_SYSTEM.md` v
> `../nove zadani/` — ty jsou zdroj pravdy pro CO a JAK, tenhle soubor jen
> říká CO UŽ JE HOTOVO a jaká rozhodnutí padla cestou.

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
