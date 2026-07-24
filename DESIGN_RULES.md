# DESIGN_RULES.md — závazná pravidla, ne inspirace

> Tenhle soubor vznikl 2026-07-24 po přiznání, že se nám webdesign nedaří.
> Diagnóza: tři cesty (B/C/D) začaly barvami a fonty a doufaly, že se z toho
> vyloupne systém. Nevyloupl. Design se rozhoduje DOPŘEDU a pak se drží.
>
> Pravidla jsou schválně ÚZKÁ a rozhodnutá. Když něco chybí, doplň to sem
> jako rozhodnutí — nedělej výjimku v komponentě. Když pravidlo někde
> nefunguje, změň pravidlo (a všechna místa), ne jednu obrazovku.
>
> Ověřuje se očima: `npm run design:shots` → `design-shots/`. Bez podívání
> se nic z tohohle nepovažuje za hotové.

## 0. Co se v tomhle produktu vlastně dělá

Klíčová osoba doprovází desítky rodin. Hlavní činnost je **skenovat seznam
a najít, komu se musím věnovat** — ne obdivovat kartičky. Z toho plyne
priorita, která přebíjí estetiku: **hustota a zarovnání před vzdušností.**

## 1. Typografická stupnice

**ODEČTENO Z ROUTINE** (uživatel poslal uloženou stránku své aplikace včetně
CSS), ne vymyšleno. Zdroj měření: `main-*.css`, `useJournalEntry-*.css`.

Jeden font: **Inter**. Druhý řez pro nadpisy neexistuje.

| Použití | Velikost / prokládání | Řez | Třída |
|---|---|---|---|
| Titulek stránky | 20 / 28 | 500 | `text-xl font-medium` |
| Nadpis sekce | 16 / 120 % | 500 | `text-lg font-medium` |
| Jméno v řádku | 14 / 20 | 500 | `text-base font-medium` |
| Tělo textu, hodnoty | 13 / 19 | 400 | `text-sm` |
| Metadata, popisky sloupců | 11 / 17 | 400 | `text-xs` |

**Nejdůležitější pravidlo v celém dokumentu: HIERARCHII DĚLÁ VELIKOST
A BARVA, NE TUČNOST.**

Měření, ze kterého to plyne: v CSS Routine je `font-weight:500` 329×,
`400` 311×, ale `600` jen 26× a `700` čtyřikrát. Appka měla 53×
`font-semibold` a 35× `font-bold`, takže všechno křičelo a nic nevystupovalo.

Proto `tailwind.config.js` PŘEMAPOVAL význam tříd: `font-semibold` kreslí
500 a `font-bold` kreslí 600. Tučnější řez v appce neexistuje a nedá se
omylem použít. Řez 600 patří jen nadpisům v editoru zápisů.

Čtyři stupně inkoustu, ne tři — čtvrtý (`text-text-faint`) je to, čím se
odlišuje popisek od hodnoty místo tučnosti:
`--text-primary` #2a3038 → `--text-secondary` #47505d →
`--text-tertiary` #79818c → `--text-faint` #a9a9a9.

## 2. Odsazení

**ODEČTENO:** `gap:8px` 132×, `4px` 79×, `12px` 77×, `6px` 29×, `16px` 15×.
Používej jen: **2, 4, 6, 8, 12, 16, 24**. Nic mezi tím.

- vnitřek řádku seznamu: `8px` svisle, `12px` vodorovně
- mezera mezi řádky seznamu: **žádná** — řádky dělí vlasová linka (§4)
- mezera mezi sekcemi: `24px`
- vnitřek karty/panelu: `12px 16px`

Radiusy (odečteno: 3px 182×, 7px 173×, 10px 44×):
`--radius-sm` **3px** kompaktní (čip, řádek), `--radius-md` **7px** blok
a tlačítko, `--radius-lg` **10px** kontejner a vyskakovací panel. Nic jiného.

**Vzdušnost dělá prázdné místo, ne velké písmo.** Základ je 13 px právě proto,
aby na padding zbylo místo. Tenhle vztah je snadné otočit špatným směrem:
větší litery → menší mezery → nejtěsnější možný výsledek.

## 3. Šířka obsahu

Jedna hodnota pro celou stránku: **`max-width: 1120px`**, obsah zarovnán
vlevo. NIKDY tři různé šířky pod sebou (viz `desktop-rodina-profil.png`
před opravou — karta Dohody 560, řádky 930, přepínač 560).

Sekce, které patří k sobě, mají STEJNOU šířku. Rozdílná šířka je informace
("tohle je něco jiného"), ne dekorace — a používá se výjimečně.

## 4. Hustota a mřížka seznamu

**Řádek je řádek, ne karta.** Celý seznam je JEDEN list; řádky dělí vlasová
linka `1px var(--border-subtle)`. Karta se stínem na řádek znamená dvanáct
plovoucích destiček, a ty se nedají skenovat očima svisle, protože každá má
vlastní hranu.

**Mřížka drží celý řádek**, včetně avataru vlevo (`lead`) a akcí vpravo
(`trail`). Šířky obou vyhlašuje seznam jednou. Bez toho má hlavička jiný
zbytek místa než řádky a popisek stojí vedle svého sloupce — což se stalo
a odhalil to až screenshot, ne kód.

**Popisky sloupců jsou JEDNOU v hlavičce**, ne nad každou hodnotou. Dřív
nesl každý řádek „STAV / POSLEDNÍ KONTAKT / KLÍČOVÁ OSOBA", takže seznam
dvanácti rodin obsahoval popisky šestatřicetkrát a informace zabírala třetinu
plochy.

**Priorita sloupců:** jméno nikdy nezmizí a nejde pod 220 px. Buňky jsou
seřazené od nejdůležitější a ubývají ZPRAVA. Nejvýš tři sloupce metadat.
Zúžení řídí **container queries** (šířka, kterou má seznam SKUTEČNĚ
k dispozici), ne `@media` — sidebar bere 240 px a otevřený pravý panel
dalších 380 px.

## 5. Vyvýšení (stíny)

Tři úrovně, víc ne:
- **`shadow-raised`** — karta/řádek na ploše. Jediný stín pro obsah.
- **`shadow-overlay`** — pravý panel, modál, rozbalené menu. Nic jiného.
- **žádný stín** — vnořený obsah v kartě (`bg-inset`), přepínače, pole.

Zákaz: dvě různě vyvýšené karty vedle sebe bez rozdílu ve významu.

## 6. Jazyk naléhavosti — JEDEN

Naléhavost se ukazuje **výhradně štítkem** (`AlertTag`) v posledním sloupci:
`Naléhavé` / `Po termínu` / `Čeká`. Vždy stejný tvar, stejné umístění.

Zákázáno:
- podbarvení celého řádku (křičí přes celý seznam a nese stejnou informaci
  dvakrát)
- holý barevný text vedle štítku pro tu samou věc
- dvě různá řešení v jednom seznamu (viz `desktop-rodiny.png` před opravou:
  pilulka na prvním řádku, růžový řádek + červený text na druhém)

Barva samotná nikdy nenese informaci sama — vždy je u ní text nebo ikona
(barvoslepost, tisk, screenshot v e-mailu).

## 7. Tmavý režim

Karta musí být **světlejší** než plocha, sidebar **tmavší nebo světlejší**
než plocha, nikdy stejný. Kontrolní otázka u každého screenshotu: *poznám
hranu karty, aniž bych hledal stín?* Ve tmavém režimu stín nefunguje, dělá
to jen barva.

## 8. Akce

- Primární akce stránky je **jedna**, vpravo v hlavičce stránky.
- Plovoucí kolečko (FAB) patří **výhradně na mobil**. Na desktopu je to
  duplicitní tlačítko plující nad prázdnem.
- Akce v řádku jsou v `⋮` menu, ne rozeseté jako ikony.

## 9. Formuláře v pravém panelu

- Pole jsou seskupená do rámečků (`bg-inset`) po významu, ne jedno pod
  druhým.
- Panel s jedním polem neexistuje. Když má formulář jedno pole, patří do
  modálu, ne do panelu na celou výšku obrazovky.
- Popisek nad polem, chyba pod polem, nikdy placeholder místo popisku.

## 10. Prázdné a okrajové stavy

Každá obrazovka musí vypadat rozumně, když:
- je prázdná (žádná data)
- má jeden záznam (nesmí vypadat rozbitě — viz „7 hodin prázdné mřížky")
- má dlouhá jména (`Rodina Vondráčkových-Bartošových`, `Bartoňová-Křížová`)
- má chybějící hodnoty (rodina bez klíčové osoby, pěstoun bez telefonu)

Vzorová data v `src/preview/fixtures.ts` tyhle případy záměrně obsahují.
Kdo přidá obrazovku, přidá si tam i její okrajový případ.

## 11. Šířky, na kterých se to musí kontrolovat

`1440` (desktop), `900` (notebook na půl obrazovky — TADY se to lámalo),
`390` (mobil). Všechny tři generuje `npm run design:shots`.
