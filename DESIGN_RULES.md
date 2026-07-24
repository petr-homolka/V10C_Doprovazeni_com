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

Pět velikostí. Šestá neexistuje.

| Použití | Velikost / řez | Font |
|---|---|---|
| Titulek stránky | 26 px / 700 | Poppins |
| Nadpis sekce | 15 px / 700, `uppercase`, `tracking-wide`, `text-text-tertiary` | Inter |
| Jméno v řádku, hodnota v poli | 15 px / 600 | Inter |
| Tělo textu, popisky | 14 px / 400 | Inter |
| Metadata, štítky sloupců | 12 px / 500, `text-text-tertiary` | Inter |

**Pravidlo hierarchie:** nadpis sekce nesmí být slabší než obsah pod ním.
Proto je nadpis sekce `uppercase` + tercierní barva — odliší se JINAK než
velikostí, takže nesoutěží se jménem v řádku, ale ani nezmizí.

## 2. Odsazení

Násobky 4. Používej jen: **4, 8, 12, 16, 24, 32, 48**.
- vnitřek řádku seznamu: `12px` svisle, `16px` vodorovně
- mezera mezi řádky seznamu: `8px`
- mezera mezi sekcemi: `32px`
- vnitřek karty/panelu: `16px` (`24px` jen u hlavičky profilu)

## 3. Šířka obsahu

Jedna hodnota pro celou stránku: **`max-width: 1120px`**, obsah zarovnán
vlevo. NIKDY tři různé šířky pod sebou (viz `desktop-rodina-profil.png`
před opravou — karta Dohody 560, řádky 930, přepínač 560).

Sekce, které patří k sobě, mají STEJNOU šířku. Rozdílná šířka je informace
("tohle je něco jiného"), ne dekorace — a používá se výjimečně.

## 4. Hustota a mřížka seznamu

Řádek seznamu je **CSS grid se sdílenou šablonou sloupců**, definovanou
jednou na seznamu, ne skládanou v každém řádku zvlášť. Bez toho se sloupce
mezi řádky nezarovnají, jakmile některá hodnota chybí — což byl nejhorší
nalezený defekt (řádek bez klíčové osoby posunul všechny ostatní sloupce).

- metadata jsou zarovnaná **VLEVO** ke svému sloupci; doprava se zarovnávají
  jen čísla a datumy
- prázdná hodnota se kreslí jako `—`, sloupec NIKDY nezmizí
- štítek sloupce je nad hodnotou, `12px uppercase`, jen na prvním řádku by
  se ztratil → je u každého řádku (to je vědomá redundance, protože seznam
  se skenuje, ne čte odshora)

**Priorita při zužování** (co se obětuje první):
1. jméno má vždycky nejmíň `220px` a NIKDY se neořezává jako první
2. při ubývání šířky mizí sloupce v tomhle pořadí: kapacita/věk → narození
   → telefon/e-mail → rodina → klíčová osoba
3. datum posledního kontaktu a stav naléhavosti zůstávají do konce

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
