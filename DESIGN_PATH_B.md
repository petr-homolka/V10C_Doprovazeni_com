# DESIGN_PATH_B.md

> Viz `DESIGN_PATHS.md` pro obecný princip více souběžných designových
> cest. Tenhle soubor je specifický pro **Cestu B** — co se změnilo, proč,
> a odkud to vychází.

## Zadání (2026-07-24)

Petr: "nejde mi jen o změnu barev, ale o změnu všeho, pokud by tě
napsala i změna platformy (smysl a datové modely musí zůstat), pak do
toho! ... prosím překvap mě." Plus konkrétní designový zdroj: Figma
soubor "Lumo / Vaadin Design System (Community)" — otevřený a extrahovaný
(`.fig` je zip archiv s vloženými PNG exporty), konkrétně:
- barevné proměnné (Light/Dark), CSS export (`--lumo-*` HSLA tokeny)
- typografická škála (Heading 1–6, Normal/Small body text, Field label)
- stínová škála (Shadow XS–XL)
- ukázky komponent (date picker, taby, tabulka, dialog, karta, tlačítka
  Primary/Secondary/Tertiary)

## Co se změnilo (a proč)

**Filosofie**: Cesta A = decentní, monochromní "iOS Nastavení" chrome,
barva jen na subjektových badge. Cesta B = SEBEVĚDOMÁ modrá (Lumo Primary
`#006AF5`) jako skutečná barva appky — tlačítka, aktivní stavy, focus
ring. Enterprise/nástrojový charakter (hustší, ostřejší, tabulkový) místo
konzumního/kartového.

- **Font**: Geist Sans → **Inter** (`@fontsource/inter`) — lepší číselná
  čitelnost pro datově hutný nástroj, `font-feature-settings: 'tnum'`
  (tabulková čísla) navíc zapnuto v `index.css`.
- **Tokeny** (`src/index.css`) — STEJNÁ sada CSS custom properties jako
  Cesta A (`--bg-app`, `--text-primary`, `--primary`, …), jen nové
  hodnoty → celá appka (~90 souborů) se přebarvila/přetypografovala
  BEZE ZMĚNY jednotlivých stránek, díky tomu, že `tailwind.config.js` na
  ně mapuje stejné utility třídy.
  - Radiusy zmenšeny (sm 8→6px, md 12→9px, lg 16→13px) — crisp, ne
    "bublinaté".
  - Stínová škála rozšířena z 2 na 5 úrovní (`shadow-xs/raised/md/
    overlay/xl`), navíc `shadow-focus` (skutečný modrý focus ring —
    `box-shadow` glow, ne tloušťkový skok border 1→2px jako Cesta A).
- **Komponenty** (`src/components/ui/*`) — Button (solidní modrá
  primary, `secondary` teď tónovaná modrá místo neutrální), Input/
  Select/Combobox/DatePicker/DateRangePicker (focus ring místo border
  skoku, výška 40→36px), Table (tónovaná hlavička, hover na řádcích —
  "datová mřížka" místo prostého seznamu), Switch (přidán focus-visible
  ring).
- **Shell** (`src/components/shell/AppShell.tsx` + `Sidebar.tsx` +
  `TopBar.tsx`) — STRUKTURÁLNÍ změna, ne jen retint: Cesta A "plovoucí
  zaoblené panely na tmavší ploše s mezerou" (macOS/iOS System Settings
  vzor) → Cesta B **full-bleed enterprise layout** (sidebar přisedlý
  vlevo na celou výšku, TopBar přisedlý nahoře s `border-b`, žádné
  zaoblené rohy/mezery). Sidebar dostal VLASTNÍ pozadí (`bg-surface-soft`,
  skoro bílá) odlišné od obsahu (`bg-app`, jemně namodralá) — na rozdíl
  od Cesty A, kde obojí splývalo. Aktivní nav položka: plný `primary-soft`
  podklad + 3px levý akcentní pruh (Lumo/enterprise konvence), ne jen
  jemný alpha overlay.
- **Mobil** (`src/components/mobile/*`) — `IosList`/`IosListRow`
  PŘEJMENOVÁNO na `GroupedList`/`GroupedListRow` (stejná
  interakce/struktura, jen vizuál — jméno "Ios" by na appce, co se
  záměrně vzdaluje od iOS jazyka, bylo zavádějící). `MobileShell`
  (dolní tab bar): odstraněný "frosted glass" `backdrop-blur` (typická
  Apple afordance, záměrně pryč), aktivní záložka dostává VYPLNĚNOU
  pilulku za ikonou (Material 3 "active indicator" vzor) místo pouhého
  probarvení ikony/textu.
- **Kategorické barvy** (`STAFF_PALETTE`/`TIER_COLORS` v `CalendarPage.tsx`/
  `MobileCalendarPage.tsx`) — přebarveno tak, aby se vyhnulo kolizi s
  novou primární modrou appky samotné.
- **Typografie stránek** — `<h1>` titulky stránek 18px normální →
  **26px tučné** (Lumo-scale sebevědomější hierarchie), `<h2>` v
  drawer/modal hlavičkách na 17px semibold.

## Co se NEZMĚNILO (záměrně)

- Datové modely, Firestore schema, business logika, služby — beze
  změny, Petrovo zadání to výslovně vyžadovalo ("smysl a datové modely
  musí zůstat").
- Routy/URL struktura — stejná, jen jiný vzhled na stejných cestách.
- Ikonová knihovna (`lucide-react`) — beze změny, funguje dobře napříč
  oběma jazyky, nahrazení by bylo vysoké riziko/nízký přínos.

## Živě ověřeno

Playwright (emulátor, čerstvá organizace, desktop 1440px i mobil 390px,
light i dark mode): registrace → Dnes/Rodiny/Kalendář (+ Nová událost
modal)/Úkoly/Zaměstnanci (tabulka)/Nastavení (Vzhled, dvou-panelový
layout) na desktopu; Domů/Kalendář (+ BottomSheet)/Účet (Zkratky)/Rodiny
na mobilu. Nula konzolových/JS chyb. `npx tsc -b`, `npx oxlint src/`,
`npx vitest run` (50 testů) a `npm run build` všechny čisté. Firestore
rules beze změny na týhle větvi (žádný re-run rules testů potřeba).
