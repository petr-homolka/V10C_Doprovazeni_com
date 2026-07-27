# Předání projektu Doprovázení.com dalšímu AI programátorovi

**Datum:** 27. 7. 2026
**Stav repozitáře:** commit `6b531b9` na větvi `design-d`
**Autor předávky:** předchozí AI programátor (Claude Opus)
**Zadavatel:** Petr Homolka (petr.homolka@gmail.com)

---

## 0. Přečti si tohle první, jinak uděláš chybu

Tenhle soubor je **kompletní brífink**. Nepředpokládá, že něco o projektu víš.
Čti ho celý, než sáhneš na kód. Pořadí je záměrné: nejdřív s kým pracuješ,
pak co ten software vlastně dělá, pak jak je postavený, a nakonec kde jsou
miny.

Kromě tohohle souboru jsou v repozitáři tři další, které jsou **závazné**:

| Soubor | K čemu je |
|---|---|
| `CURRENT_STATE.md` (2 773 řádků) | Chronologický deník rozhodnutí od M0. Když nechápeš, PROČ je něco tak jak je, hledej tam. |
| `DESIGN_RULES.md` (161 řádků) | Vizuální pravidla. Nejsou to doporučení, jsou to rozhodnutí. |
| `DESIGN_PATHS.md` (79 řádků) | Jak fungují paralelní designové větve A/B/C/D. |

A jeden zdroj pravdy, který v repozitáři **není** — `ZADANI-PRO-NOVEHO-PROGRAMATORA.md`
a `DESIGN_SYSTEM.md` ve složce `../nove zadani/`. `CURRENT_STATE.md` na ně
odkazuje jako na autoritu pro „CO a JAK". Jestli je nemáš, řekni si o ně Petrovi.
Odkazy typu „§4.3" nebo „§5 Klíčová past" v komentářích kódu míří tam.

---

## 1. S kým pracuješ

Petr Homolka je zadavatel a produktový vlastník. Není programátor.

**Jak komunikuje:**
- Píše **česky**, stručně, přímo, často bez diakritiky a s překlepy. Používá `:-)`.
- Používá VELKÁ PÍSMENA pro důraz — to je důraz, ne křik.
- Zadání jsou často jednovětá („Zablokovat :-)", „ano, udělej to", „oboje hned vyřeš").
  Za tou větou je typicky hodina práce. Nežádej upřesnění, když se dá rozhodnout rozumně sám.
- Když má výhradu, řekne ji rovnou. Když se mu něco líbí, taky.
- Odpovídej **česky**, stejným registrem — věcně, bez omáčky, bez chválení.

**Co od tebe čeká:**
1. **Rozhodni sám.** „UID vyřeš jak je dle tebe nejlepší :-)" znamená přesně to.
   Neptej se na věci, které si můžeš zjistit nebo o kterých můžeš rozhodnout.
2. **Ověřuj, netvrď.** Než napíšeš „systém tohle dělá", ověř to grepem nebo testem.
   Petr několikrát věřil něčemu, co v systému nebylo — a naopak.
   Když se mýlí, řekni mu to věcně a doloženě.
3. **Přiznávej chyby rovnou.** Když ti něco spadne nebo zjistíš, že jsi předtím
   napsal nesmysl, napiš to jednou větou a oprav to. Neomlouvej se opakovaně.
4. **Nedodělky hlas nahlas.** Když něco nejde ověřit (třeba síťová politika
   zablokuje prohlížeč), řekni to, nepředstírej hotovo.
5. **Právní věci neřeš.** Doslova: „právně to neřeš, to udělají právníci :-)".
   Tvoje práce je zapsat pravidlo tak, jak ho Petr popíše, ne posuzovat, jestli obstojí.

**Zásadní instrukce z 27. 7., drž se jí:**

> „data v databázi jsou nyní všechna pouze testovací … soustřeď se na vývoj
> systému, a nikoli na správu databáze!"

Konkrétně to znamená:
- **Nepiš převodní (backfill/migrační) skripty** ke změnám datového modelu.
- **Nepouštěj nic proti produkční databázi.** Ani suché běhy, ani ověřování.
- Když nový model nesedí se starými daty, **přegeneruj data seedem**, nepřeváděj je.
- Ověřování patří do testů (`tsc`, `vitest`, `test:rules`), ne do produkce.
- **Až Petr řekne, že přišla první skutečná organizace se skutečnými pěstouny,
  tohle pravidlo se OBRACÍ** — od té chvíle se nesmí nic přegenerovávat a převody
  jsou povinné. Sám to z databáze nepoznáš, testovací data vypadají stejně jako ostrá.

---

## 2. Co ten software je

**Doprovázení.com** — SaaS pro české **doprovázející organizace** v pěstounské péči.

Kontext reálného světa: pěstoun (zákonně „osoba pečující" nebo „osoba v evidenci")
má ze zákona nárok na doprovázení. To zajišťuje doprovázející organizace na
základě **Dohody o výkonu pěstounské péče**. Organizace zaměstnává **klíčové
osoby (KO)**, každá doprovází desítky rodin: navštěvuje je, zajišťuje vzdělávání,
respit, odbornou pomoc, vede spis, vykazuje činnost státu.

Software tohle celé vede: rodiny, pěstouny, děti, Dohody, návštěvy, dokumenty,
kalendář, úkoly, vzdělávání, respit, výkazy, kontroly kvality.

**Hlavní činnost uživatele je skenovat seznam a najít, komu se musím věnovat.**
Z toho plyne priorita, která přebíjí estetiku: hustota a zarovnání před vzdušností.
(Viz `DESIGN_RULES.md` §0.)

**Jazyk celého produktu je čeština** — UI, chybové hlášky, komentáře v kódu,
commit messages. Anglicky jsou jen identifikátory v kódu.

---

## 3. Technický základ

| Vrstva | Volba |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Router | react-router-dom |
| Styly | Tailwind + vlastní `sp__*` třídy (viz §9) |
| Databáze | Firebase Firestore |
| Auth | Firebase Auth (e-mail + heslo) |
| Soubory | Firebase Storage |
| Hosting | Firebase Hosting (4 weby, viz §4) |
| AI | Firebase AI Logic, Gemini 2.5 Flash, chráněno App Check |
| Lint | oxlint |
| Testy | vitest (unit) + `@firebase/rules-unit-testing` (pravidla) |
| Editor zápisů | TipTap (ProseMirror) se slash menu |
| Kalendář | FullCalendar |
| Ikony | HugeIcons (stroke-rounded) |
| Font | Inter (jediný) |

**Backend neexistuje a nemá vzniknout.** Žádné Cloud Functions, žádný vlastní
server. Všechno jde přímo z prohlížeče do Firestore a bezpečnost drží
**Firestore Security Rules**. To je zásadní architektonické rozhodnutí (§10
původního zadání) — kdykoli budeš v pokušení napsat „to udělá serverová funkce",
napřed ověř u Petra, jestli to smí vzniknout.

Důsledek, se kterým budeš bojovat pořád: **pravidla neumí join.** Když
potřebuješ „má tahle organizace přístup k tomuhle dokumentu?", odpověď musí
být přímo v tom dokumentu (denormalizované pole `orgAccessList`), ne dohledatelná
přes tři skoky.

### Příkazy

```bash
npm run dev              # vývojový server
npm run build            # tsc -b && vite build
npm run lint             # oxlint
npm test                 # vitest run (267 testů)
npm run test:rules       # emulátor + testy pravidel (253 testů)
npm run emulators        # jen emulátory
npm run deploy:rules     # pravidla + indexy do produkce
npm run design:shots     # screenshoty pro vizuální kontrolu
```

### Proměnné prostředí (`.env.local`)

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_USE_FIREBASE_EMULATORS     # 'true' / 'false' — MUSÍ být false při buildu k nasazení
VITE_RECAPTCHA_SITE_KEY         # bez něj AI Logic běží bez App Check (funkční, nechráněné)
```

**Kázeň při nasazení:** před `npm run build` vždy zkontroluj, že
`VITE_USE_FIREBASE_EMULATORS=false`. Jednou se nasadil build namířený na
emulátor a appka v produkci nefungovala. Po buildu se to dá ověřit:
`grep -rl "127.0.0.1:8080" dist/assets/*.js` musí být prázdné.

---

## 4. Firebase projekty, větve a weby

`.firebaserc`:
- `default` = `demo-doprovazeni` (emulátory, testy)
- `production` = `v10c-doprovazeni-com`

Existují **čtyři paralelní designové cesty**. Stejná databáze, stejný Firebase
projekt — liší se jen vzhledem. Žádná nikdy nepřepisuje jinou.

| Cesta | Branch | Hosting target | URL |
|---|---|---|---|
| A | `claude/session-zhiye5` → `master` | `path-a` | https://v10c-doprovazeni-com.web.app |
| B | `design-b` | `design-b` | https://v10c-design-b.web.app |
| C | `design-c` | `design-c` | https://v10c-design-c.web.app |
| D | `design-d` | `design-d` | https://v10c-design-d.web.app |

**AKTIVNÍ CESTA JE `design-d`.** Veškerá práce jde tam a nasazuje se na
`v10c-design-d.web.app`. Nepracuj na jiné větvi, dokud ti Petr neřekne.

```bash
npx firebase deploy --only hosting:design-d --project production
npx firebase deploy --only firestore:rules,firestore:indexes --project production
```

Recept na založení další cesty (E, F, …) je v `DESIGN_PATHS.md`.

---

## 5. Datový model — jádro

### 5.1 Dvě roviny, které se nesmí míchat

Tohle je nejdůležitější koncept celého systému (Petrův návrh 26. 7.).
V pěstounské péči se prolínají dva světy s vlastní logikou a vlastní životností:

```
PRÁVNÍ ROVINA      Kdo je komu svěřen.   Určuje SOUD.    Mění se rozsudkem.
SERVISNÍ ROVINA    Kdo rodinu doprovází. Určuje SMLOUVA. Mění se dohodou.
```

Dřív existovala jen ta druhá a první se domýšlela z toho, kdo je v rodině zapsaný.
To nefunguje: rozvodem společná pěstounská péče **ze zákona zaniká**, ale Dohoda
o výkonu pěstounské péče je jiná smlouva s jinou životností.

Celé to je popsané v hlavičce `src/types/custody.ts` — **přečti si ji celou**,
je to nejhutnější dokument o datovém modelu, co v repozitáři je.

### 5.2 Hlavní kolekce

**Kořenové (top-level):**

| Kolekce | Co je | Klíčová pole |
|---|---|---|
| `users/{uid}` | Uživatel. Role se čte VÝHRADNĚ odsud, NIKDY z Auth Custom Claims. | `role`, `organizationId`, `fosterFamilyId`, `disabledAt` |
| `organizations/{orgId}` | Doprovázející organizace | |
| `families/{familyId}` | **Spis** = domácnost. Není identita, je to schránka a rozsah přístupu. | `uid`, `orgAccessList[]`, `fosterPersonRefs[]` |
| `fosterPersons/{id}` | Pěstoun | `uid`, `familyId` |
| `children/{id}` | Dítě | `uid`, `familyId`, `organizationId` |
| `courtDecisions/{id}` | **Rozhodnutí soudu** (právní rovina) | `orgAccessList[]`, `fileNumber`, `courtName`, `effectiveFrom` |
| `custodyAssignments/{id}` | **Svěření péče** — jedno dítě, 1–2 pěstouni, jeden rozsudek | `orgAccessList[]`, `childId`, `fosterPersonIds[]`, `form`, `courtDecisionId` |
| `agreementSubjects/{id}` | **Předmět dohody** — které svěření pokrývá která Dohoda | `organizationId`, `agreementId`, `custodyAssignmentId` |
| `titleRegistry/{uid}` | Rejstřík obsazených právních titulů (viz §6) | `holderOrgId`, `validTo`, `releasedAt` |
| `uidRegistry/{uid}` | Rejstřík vydaných UID (unikátnost) | |
| `uidHolderCard/{hash}` | Ověřovací kartička držitele UID, klíč = hash(uid+příjmení) | |
| `personIndex/{hash}` | Index pro rozpoznání osoby, klíč = hash(sůl\|druh\|hodnoty) | |
| `orgDirectory/{orgId}` | Veřejný adresář organizací (vizitka) | |
| `lookupQuota/{userUid}` | Počítadlo dotazů — nad limit blokuje účet | |
| `legislativeParameters/{key}` | Legislativní parametry s historií | |
| `platformDefaults/global` | Výchozí hodnoty platformy | |

**Podkolekce Spisu (`families/{familyId}/…`):**
`agreements/{orgId}` (+ `history`, `ippd`, `rateOverrides`, `policyOverrides`),
`timeline`, `documents` (+ `versions`), `historyDigest`, `messages`,
`respitEvents`, `assistedContactSeries`, `childHandovers`

**Podkolekce organizace (`organizations/{orgId}/…`):**
`enumOptions`, `importJobs` (+ `stagingRecords`), `backupConfig`, `backupJobs`,
`auditLog`, `calendarEvents`, `tasks`, `spvpp`, `inspections`, `backupRestoreTests`

**Podkolekce pěstouna:** `courses`, `benefitChecks`, `educationPlans`,
`courseEnrollments`, `householdHistory`, `rateOverrides`, `policyOverrides`

**Podkolekce dítěte:** `scheduledActivities` (+ `occurrences`), `supportExpenses`

### 5.3 Dohoda má deterministické ID

`families/{familyId}/agreements/{agreementId}`, kde **`agreementId` = `organizationId`**.
Vědomé rozhodnutí: pravidla se tak umí zeptat „má organizace O Dohodu s tímhle
Spisem?" jedním přímým čtením bez dotazu.

**Past:** protože document ID není globálně unikátní, `agreementSubjects.agreementId`
ukládá **`AgreementDoc.uid`** (náhodné globální UID), ne document ID. Kdyby ne,
dvě rodiny u téže organizace by měly nerozlišitelné předměty.

### 5.4 UID — náhodné číslo bez struktury

**Politika se změnila 26. 7. večer.** Dřív bylo UID strukturované
`TT OOOO SSSSSS C` (typ entity, organizace, sekvence, kontrolní číslice).
Teď je to **náhodné 13místné číslo s kontrolní číslicí GS1** a nic z něj nejde vyčíst.

- Generuje `src/lib/uidAllocator.ts` → `randomUid()` a `allocateUid(entityType, issuedBy)`.
- Unikátnost drží **transakční zápis do `uidRegistry`**, ne modlitba.
  Zásoba je 9·10¹¹ čísel, ale při milionu vydaných je šance na kolizi ~40 %
  (narozeninový paradox) — proto transakce a `MAX_ATTEMPTS = 5`.
- První číslice nesmí být nula (exporty do tabulek by ji spolkly).
- `registerExternalUid()` je připravené pro **pestouni.com**, kde si pěstoun
  vygeneruje UID sám při samoregistraci a ponese si ho navždy.
- UID pěstouna, organizace i Dohody jsou **nezávislá náhodná čísla**. Dohoda je
  konceptuálně „součet" UID pěstouna a organizace, ale fyzicky má vlastní náhodné.

**⚠️ ZNÁMÝ ROZPOR V KÓDU:** `src/types/identity.ts` pořád popisuje **starou**
strukturovanou soustavu včetně tabulky `ENTITY_TYPE_CODES` (10 = pěstoun,
20 = dítě, 90 = Dohoda, 99 = Spis…). Ta tabulka se **pořád používá** jako
`EntityType` parametr v `allocateUid()`, ale do vygenerovaného čísla se
**nepromítá** — slouží už jen jako štítek v `uidRegistry`. Hlavička toho souboru
je zavádějící a měla by se opravit. Ověřeno: `uidEntityTypeCode` nemá jediného
volajícího, nic v aplikaci strukturu UID nečte.

---

## 6. Zákonná pravidla zapsaná jako kód

Zdroj: **metodika MPSV, aktualizace 20. 1. 2026**. Všechno žije v
`src/lib/agreementLaw.ts` jako čisté testovatelné funkce (21 testů).

### 6.1 Jedna osoba pečující = nejvýš jeden aktivní právní titul

Nejtvrdší pravidlo v systému. Když druhá organizace zkusí uzavřít Dohodu
s pěstounem, který už jednu má, **systém to TVRDĚ ZABLOKUJE** (ne varování —
Petrovo výslovné rozhodnutí: „Zablokovat :-)").

Jak je to zajištěné:
- `titleRegistry/{uid}` — jeden dokument na pěstouna, veřejně čitelný pro
  všechny zaměstnance (ptát se musí i organizace, která k té osobě nic nemá).
- **Nedá se vylistovat** — jinak by z něj šlo stáhnout přehled cizích případů.
- `claimTitlesExclusively()` v `titleRegistryService.ts` — **transakce**, která
  přečte všechny a zapíše všechny, a běží **PŘED** zápisem Dohody. Manželé se
  zabírají společně. Tohle je skutečná záruka; `assertCanOpenTitle()` před ní
  je jen pre-check kvůli hezčí hlášce.

### 6.2 Konec Dohody ≠ uvolnění pěstouna

Oprava z 26. 7., stálo to přepis testů. Že Dohoda skončila, **neznamená**, že
si pěstouna může vzít někdo jiný. Musí ho stará organizace **uvolnit**
(`releasedAt`) — teprve pak je volný. Stav se odvozuje funkcí `titleState()`
z `releasedAt` + `validTo`, neukládá se zvlášť.

Stavy: `volny` → `bezi` → `ukoncena` (Dohoda skončila, pěstoun NENÍ uvolněný)
→ `uvolneny`.

### 6.3 Předání pěstouna mezi organizacemi (Petrův postup, 26. 7.)

Systém **nedělá rozhodnutí, dělá jen zprostředkování**:
1. Nová organizace zapíše pěstouna (podle rodného čísla, OP, pasu, čísla
   rozsudku, kombinace jméno+adresa, nebo **UID**).
2. Systém pozná, že už ho zná, a zobrazí: *„pravděpodobně má Dohodu s organizací XYZ"*
   + kontakt na ni.
3. **Telefonát proběhne mimo systém.**
4. Stará organizace buď potvrdí (nová smí uložit jen zájemce, ne podepsat Dohodu),
   nebo **jedním kliknutím uvolní**.

Logika je v `src/lib/takeoverFlow.ts`, rozpoznávání osoby v `src/lib/personMatch.ts`.

### 6.4 Kalendář výpovědí

Dohoda smí skončit **jen k 30. 6. nebo 31. 12.** s výpovědní dobou **aspoň 30 dnů**.
`planAgreementEnd()` bere důvod jako první vstup:
- `vypoved` → ručně zvolené datum se **zahodí** a dopočítá se zákonné
  (`overriddenByLaw: true`, aby obrazovka mohla říct proč).
- `dohodou` / `uplynuti_doby` → datum volné, zákon nic nepředepisuje.

Další konstanty: `AGREEMENT_DEADLINE_DAYS = 30` (lhůta na uzavření Dohody),
`WIND_DOWN_DAYS = 90` (přístup po skončení Dohody — **není to druhá Dohoda**).

### 6.5 Přijetí dalšího dítěte NENÍ nová Dohoda

Je to změna té stávající → v datech další `agreementSubject` se **stejným**
`agreementId`. Hlídá `canOpenNewTitle()`.

### 6.6 Manželé uzavírají JEDNU Dohodu

26. 7. dopoledne padlo, že dvě; odpoledne metodika rozhodla, že jednu.
Platí: **jedna Dohoda, v ní dva `agreementSubjects`** (po jednom za manžela),
aby šlo vykazovat za konkrétního pěstouna.

### 6.7 OSPOD se nemodeluje vůbec

Petrovo rozhodnutí: „OSPOD nebude náš systém používat, pravděpodobně má vlastní."
OSPOD sám může být doprovázejícím subjektem, ale **v systému ho nikdo nezapíše
— nikdy**. Varianta „Správní rozhodnutí" byla z modelu odstraněná.

**Vědomý důsledek, který je potřeba znát:** pěstoun doprovázený OSPODem vypadá
v systému jako volný. Je to napsané nahlas v hlavičce `agreementLaw.ts` bod 4.

---

## 7. Bezpečnostní model

### 7.1 Role

Čtou se **výhradně** z `users/{uid}.role`, **nikdy** z Firebase Auth Custom Claims.
(To je v původním zadání označené jako „Klíčová past".)

**Zaměstnanecké:** `superadmin`, `org_admin`, `vedouci_pobocky`, `teamleader`,
`klicova_osoba`, `asistent_ko`, `zamestnanec`, `spolupracovnik`
**Externí:** `pestoun`, `external`, `provider`

Zvláštnosti:
- `spolupracovnik` **záměrně není** v `isStaff()` v pravidlech. Nedostává obecný
  organizační přístup — vidí jen entity, které mu někdo výslovně přiřadí
  (`collaboratorAssignments`) a jen povolené moduly (`UserDoc.collaboratorModules`).
- `provider` nemá `organizationId` (obsluhuje víc organizací), scoping jde přes
  `providerInstitutionRef`.
- `vedouci_pobocky` a `teamleader` jsou v `READ_ONLY_MANAGER_ROLES`.

### 7.2 Firestore Rules — 1 400+ řádků

Pomocné funkce nahoře v `firestore.rules`: `isSignedIn`, `userDoc`, `isDisabled`,
`isStaff`, `isReadOnlyManager`, `isFoster`, `isSuperadmin`, `isCollaborator`,
`hasCollaboratorAssignment`, `collaboratorModuleEnabled`, `sameOrg`,
`isProfileLess`, `isValidAccessExtension`, `ownAgreementPeriod`,
`hasOwnAgreementFor`, `hasActiveAgreementFor`, `canRollbackImportEntity`,
`hasFosterPersonAccess`, `hasChildAccess`.

### 7.3 ⚠️ TŘI PASTI, KTERÉ TĚ DOSTANOU

**Past 1 — chybějící pole je CHYBA, ne `false`.**

```javascript
// ŠPATNĚ — na dokumentu bez pole `disabledAt` to shodí VYHODNOCENÍ,
// tedy i pravidla, která s tím polem nemají nic společného.
userDoc().disabledAt != null

// SPRÁVNĚ
userDoc().get('disabledAt', null) != null
```

Tahle chyba **shodila 20 testů napříč nesouvisejícími moduly**, než se našla.
Narazil jsem na ni dvakrát. Vždycky používej `.get('pole', null)`.

**Past 2 — `list` se vyhodnocuje nad DOTAZEM, ne nad výsledkem.**

Firestore pustí dotaz jen tehdy, když **dotaz sám dokazuje**, že pravidlo bude
platit. Pravidlo `organizationId in resource.data.orgAccessList` se dá dokázat
**jedině** dotazem `where('orgAccessList', 'array-contains', org)`.

Dotaz filtrovaný na jiné pole skončí `permission-denied` — **i když by všechny
nalezené dokumenty té organizaci patřily.**

Tohle mě dostalo 27. 7.: `listAssignmentsForFoster()` filtroval podle
`fosterPersonIds` a v produkci by **vždycky spadl**. A druhý `array-contains`
do téhož dotazu přidat nelze. Řešení: ptát se serveru na organizaci a pěstouna
filtrovat v paměti.

**Vždycky napiš test, který posílá přesně ten dotaz, co posílá aplikace.**
Testy nad jednotlivými dokumenty (`getDoc`) tuhle třídu chyb nezachytí.
Vzor je v `tests/rules/custody.rules.test.ts`, blok „dotazy, které aplikace
opravdu posílá".

**Past 3 — pravidla neumí join.**

Proto je `orgAccessList` denormalizovaný na entitě. Je to **odvozený údaj, ne
druhý zdroj pravdy** — smí se jen rozšiřovat (`arrayUnion`), nikdy zužovat.
Pravidla to vynucují:

```javascript
resource.data.orgAccessList.toSet().difference(request.resource.data.orgAccessList.toSet()).size() == 0
```

### 7.4 Struktura jako záruka, ne politika

Kde to jde, je bezpečnost **strukturální** — nedá se obejít, protože není co obejít:
- `uidHolderCard/{hash(uid+příjmení)}` a `personIndex/{hash(sůl|druh|hodnoty)}` —
  **klíč dokumentu JE tajemství**. Kdo nezná UID i příjmení, nespočítá cestu.
- Append-only historie: `auditLog`, `agreements/{orgId}/history/{uid}`,
  `fosterPersons/{id}/householdHistory/{id}` mají `update, delete: if false`
  **i pro superadmina**.
- `courtDecisions`, `custodyAssignments`, `agreementSubjects`: `delete: if false`.
  Rozsudek je právní titul; kdyby šel smazat, nedohledá se, o co se péče opírala.
- Transakce tam, kde by kontrola-pak-zápis šla obejít závodem
  (`claimTitlesExclusively`, `allocateUid`).

### 7.5 Ochrana ověřování osob

Petrovo zadání: ověřovat smí **jen přihlášený**, musí to být **logované**, a
**podezřelé chování nad rozumný limit zablokuje účet** s hláškou, ať se obrátí
na provozovatele (vizitka). Implementováno přes `lookupQuota/{userUid}` +
`disabledAt` na uživateli.

---

## 8. Retenční lhůty a třídy dat

- `src/lib/retentionPolicy.ts` — `RETENTION_RULES`, kotvy, akce.
  **Soubor záměrně nevymýšlí lhůty**, jen je vykonává.
- Superadmin je nastavuje na stránce **`/platforma/retence`**
  (`PlatformRetentionPage.tsx`). Přepisy se ukládají přes
  `retentionSettingsService.ts`.
- `keepMonths: null` = **nerozhodnuto**; stránka počítá a hlásí, kolik kategorií
  ještě rozhodnutí nemá. Stav `status` je **odvozený**, ne uložený.
- `RETENTION_CHILD_CARE_YEARS = 30` — archivační doba u péče o dítě.
- `src/types/dataClass.ts` — `DataClass = 'live' | 'test'`, pole `dataClass`
  na dokumentech. Rozlišení testovacích a ostrých dat.

**Otevřené:** několik kategorií pořád nemá rozhodnutou lhůtu. Rozhodnout je
může Petr sám v `/platforma/retence` — není to práce pro tebe.

---

## 9. Design system

**Čti `DESIGN_RULES.md` celý, než sáhneš na cokoli vizuálního.** Vznikl po
přiznání, že se webdesign nedařil, a je záměrně úzký a rozhodnutý.
Když pravidlo někde nefunguje, **změň pravidlo a všechna místa** — nedělej
výjimku v jedné komponentě.

Nejdůležitější pravidla:

1. **Hierarchii dělá VELIKOST A BARVA, NE TUČNOST.**
   `tailwind.config.js` **přemapoval** význam tříd: `font-semibold` kreslí 500,
   `font-bold` kreslí 600. Tučnější řez v appce neexistuje a nedá se omylem použít.
2. **Jeden font: Inter.** Druhý řez pro nadpisy neexistuje.
3. **Čtyři stupně inkoustu:** `--text-primary` #2a3038 → `--text-secondary`
   #47505d → `--text-tertiary` #79818c → `--text-faint` #a9a9a9.
   Čtvrtý stupeň je to, čím se odlišuje popisek od hodnoty — místo tučnosti.
4. **Typografická stupnice** (odečtená z reference, ne vymyšlená):
   titulek stránky 20/28 · nadpis sekce 16 · jméno v řádku 14/20 ·
   tělo 13/19 · metadata 11/17.

**Stavební prvky:**
- `src/components/spis/` — `SpisSection`, `PageBody`, `PageHead`, `DataRow`, `LimitRow`
- `src/components/ui/` — 35 primitiv (`button`, `input`, `select`, `date-picker`,
  `side-panel`, `record-card`, `property-list`, `tabs`, `modal`, `drawer`,
  `rich-text-editor`, …)
- `src/styles/spis.css` — třídy `sp__page`, `sp__card`, `sp__row`, `sp__sec`,
  `sp__group`, `sp__grouplabel`, `sp__prop`, `sp__chip`, `sp__meter`, …
- `src/tokens.css` — barvy, radiusy, stíny

**Detailní stránky** se skládají ze `SpisSection` (id, title, description,
volitelně `lazy` a `padded`). Sekce nemají žádný centrální registr — id je
lokální věc stránky.

**Ověřuje se očima:** `npm run design:shots` → `design-shots/`.
Bez podívání se nic nepovažuje za hotové.

---

## 10. Mapa kódu

```
src/
  App.tsx                 router — všechny cesty na jednom místě
  lib/                    ČISTÉ FUNKCE — logika bez databáze, testovatelná
    agreementLaw.ts       ★ metodika MPSV jako kód (21 testů)
    custody.ts            validace svěření
    takeoverFlow.ts       předání pěstouna mezi organizacemi
    personMatch.ts        rozpoznání osoby, hashované klíče
    uidAllocator.ts       ★ přidělení náhodného UID
    uid.ts                GS1 kontrolní číslice, validace
    retentionPolicy.ts    retenční pravidla
    birthNumber.ts        rodné číslo → datum narození
    eventSubjects.ts      subjectKeys pro zúžené dotazy
    firebase.ts           inicializace SDK
    ai.ts                 Gemini přes Firebase AI Logic + App Check
    secondaryAuth.ts      izolovaná Auth instance
  types/                  datové typy + hlavičkové komentáře s ROZHODNUTÍMI
    custody.ts            ★★ nejhutnější dokument o modelu, přečti celý
    family.ts             ★ k čemu Spis je a k čemu už ne
    agreement.ts          ★ proč agreementId = organizationId
    titleRegistry.ts      stavy právního titulu
    identity.ts           ⚠️ hlavička popisuje ZASTARALOU soustavu UID
    user.ts               role
  services/               ČTENÍ A ZÁPIS do Firestore (40 souborů)
    agreementService.ts   ★ pořadí operací při zakládání Dohody
    titleRegistryService.ts ★ transakční zábor titulů
    custodyService.ts     právní rovina
    familyService.ts      rodiny, pěstouni, děti, stěhování domácnosti
  components/
    spis/ ui/ family/ calendar/ tasks/ timeline/ documents/
    search/ settings/ shell/ mobile/ moje/
  routes/                 stránky (28 desktop + 8 mobil + 3 portál pěstouna + settings)
  hooks/                  useAuth, useIsMobile, useTheme, useSpeechRecognition, …
tests/rules/              15 souborů, 253 testů proti emulátoru
scripts/                  seedy a jednorázové nástroje (NESPOUŠTĚT — viz §1)
firestore.rules           1 400+ řádků
firestore.indexes.json    složené indexy
```

**Konvence, které drž:**
- `lib/` = čisté funkce bez databáze. Rozhodovací logika patří sem, ne do service.
- `services/` = čtení, zápis a **validace před zápisem**. Neplatný stav je
  snazší nepustit dovnitř než pak opravovat.
- Komentáře v kódu píšeme **česky** a vysvětlují **PROČ**, ne CO.
  Když děláš netriviální rozhodnutí, napiš ho do hlavičky typu nebo funkce
  — tenhle projekt takhle nese svoji paměť.
- Když opravuješ dřívější tvrzení v komentáři, **oprav ten komentář**, ať
  nezůstane lež (viz `types/custody.ts` „OPRAVA 27. 7.").

---

## 11. Co je hotové

**Hotovo a funkční:**
Autentizace a role · organizace · Spisy/rodiny/pěstouni/děti · Dohody
s deterministickým ID · timeline a zápisy (TipTap se slash menu) · dokumenty
s verzemi a schvalováním · QR ověření dokumentu (`/d/:uid`) · kalendář
(FullCalendar, opakování, vazby na entity, Google sync) · úkoly · chat
(zaměstnanci ↔ pěstoun) · hlasový zápis s AI učesáním · mobilní PWA
(8 obrazovek) · portál pěstouna `/moje` · vzdělávání a kurzy · respit ·
asistovaný kontakt · předání dítěte · podpůrné aktivity a výdaje · SPVPP ·
kontroly kvality · import s rollbackem · zálohy · audit log · retence a archiv ·
globální hledání (Ctrl/Cmd+K) · externisté a spolupracovníci s omezenými moduly ·
adresář organizací (vizitka) · průvodce registrací organizace · průvodce
zájemcem · rejstřík právních titulů s tvrdou blokací · právní rovina
(rozsudek → svěření → předmět dohody) · zákonný kalendář výpovědí ·
stěhování pěstouna mezi domácnostmi · retenční lhůty jako nastavení superadmina

**Stav testů k 27. 7.:** `tsc -b` čistý · `vitest` 267/267 · `test:rules` 253/253 ·
`oxlint` jen dřívější warningy (`no-children-prop` ×4, `exhaustive-deps` ×1,
`only-export-components` ×3 v `preview/main.tsx`)

---

## 12. Co zbývá — seřazené podle důležitosti

### A. Rozpory v kódu, které je potřeba srovnat

1. **`src/types/identity.ts`** — hlavička a `ENTITY_TYPE_CODES` popisují starou
   strukturovanou soustavu UID, která už neplatí. Přepsat hlavičku tak, aby
   říkala pravdu: kódy dnes slouží jen jako štítek typu v `uidRegistry`,
   do čísla se nepromítají.

### B. Nedodělky se známým rozsahem

2. **`AGREEMENT_VERSION` a dodatky k Dohodě** — model nemá verzování Dohody
   ani dodatky. Bude potřeba, až se začne řešit změna Dohody v čase.
3. **Zobecnění `osoba pečující` / `osoba v evidenci`** — zákon rozlišuje dvě
   kategorie, systém zatím zná jen „pěstouna".
4. **Tabulka hlídání zákonných lhůt** — 2 měsíce osobní kontakt, 6 měsíců
   odborná pomoc, kadence návštěv OSPOD. Data pro to existují, vyhodnocení ne.
5. **Naplánované zálohy** — `BackupSettingsPage` nastavení uloží, ale samo se
   nespustí; chybí plánovač. „Zálohovat teď" funguje. (Pozor: řešení přes
   Cloud Function naráží na rozhodnutí „žádný backend" — projednat s Petrem.)
6. **`courtDecisionId` u převedených svěření** — 410 svěření v databázi má
   `courtDecisionId: null` a odhadované datum (`validFromIsEstimate: true`).
   UI to hlásí a nabízí „Doplnit". **Není to práce pro tebe** — doplní to
   uživatelé, a beztak jde o testovací data.

### C. Chystané

7. **pestouni.com** — samostatný web, kde se pěstouni registrují celostátně
   sami, uvedou, kdo je doprovází, a dostanou UID, které používají navždy.
   Systém je na to připravený (`registerExternalUid()`, náhodná UID bez
   segmentu organizace, rezervovaný `orgCode 0000`), ale **napojení neexistuje**.
8. **Mapa organizací** — adresář organizací (`orgDirectory`) je zamýšlený jako
   semínko veřejného adresáře a později mapy.

### D. Otevřené, čeká na Petra

9. Nerozhodnuté retenční lhůty — `/platforma/retence`, rozhodne sám.

---

## 13. Pracovní postup, který se osvědčil

1. **Nejdřív si ověř realitu.** Než něco tvrdíš nebo měníš, grepni to.
   Tímhle se našlo, že strukturu UID nikdo nečte (a přechod na náhodné byl
   skoro zdarma), že `disabledAt` se nikdy nevynucovalo, že
   `upsertUidHolderCard`/`indexPerson` neměly volajícího, že `releaseFosterParent`
   nemělo UI a že kolekce právní roviny neměly pravidla ani volání.
2. **Piš testy na to, co v produkci selže.** Zvlášť dotazy — viz Past 2 v §7.3.
3. **Kontrolní kolečko před commitem:**
   ```bash
   npx tsc -b
   npx vitest run
   npm run test:rules      # napřed zabít viset zůstavší emulátory
   npx oxlint src
   ```
   Emulátory umí zůstat viset a držet port 8080 → `pkill -f "firebase.*emulators"; pkill -9 -f java`
4. **Nasazení:** ověř `VITE_USE_FIREBASE_EMULATORS=false` → `npm run build` →
   `grep -rl "127.0.0.1:8080" dist/assets/*.js` musí být prázdné → deploy.
5. **Commit message česky**, vysvětluje PROČ. Vzor je v `git log`.
   Na konec patří:
   ```
   Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
   Claude-Session: <odkaz na session>
   ```
6. **Nasaď a nech Petra kouknout živě.** Screenshoty jsou pomůcka, živá adresa
   je verdikt.

---

## 14. Poslední commity — kontext, ve kterém jsi převzal

```
6b531b9  Zákonný kalendář výpovědí a zapojení právní roviny        ← poslední
4cb2c80  Pěstoun může přejít do jiné domácnosti
6d61665  Bezpečnostní audit: čtyři nalezené bomby, všechny odpáleny
6989144  Zapsat, k čemu Spis ještě je — a k čemu už ne
cb8baa4  Návrat pěstouna k původní organizaci už nepřepíše starou Dohodu
896e398  UID je náhodné číslo bez struktury
8555738  Rezervace orgCode 0000 pro samoregistraci pěstouna (pestouni.com)
f5768eb  Retenční lhůty jako nastavení superadmina; OSPOD z modelu pryč
578575c  Průvodce zájemcem končí zájemcem, klíč přes UID+příjmení, zablokovaný účet blokuje
b9eaa00  Průvodce registrací organizace, průvodce zájemcem s UID
264e77a  Předání pěstouna přes telefonát: stav „Uvolněný", vizitka, rozpoznání osoby
c38a1d8  Tvrdá blokace druhého právního titulu + rejstřík obsazených UID
42b8dc4  OSPOD jako doprovázející subjekt mimo náš systém
b422551  Metodika MPSV: jedna osoba pečující = nejvýš jedna aktivní dohoda
df8f203  Právní rovina oddělená od servisní: rozsudek, svěření, předmět dohody
```

**Jediná věc, kterou jsem u posledního commitu neověřil:** vizuální kontrola
nasazené stránky v prohlížeči. Síťová politika sezení zamítla spojení na
`v10c-design-d.web.app` (proxy vrátila 403 na CONNECT). Nahradil jsem to testy
dotazů proti reálným pravidlům, ale **jak nová sekce „Svěření do péče" na
profilu dítěte vypadá, jsem neviděl.** Je to první věc, na kterou se koukni.

---

## 15. Sedm vět, které si zapamatuj, i kdybys zapomněl zbytek

1. **Všechna data v databázi jsou testovací** — nepiš převody, přegeneruj je.
2. **`.get('pole', null)`**, nikdy `resource.data.pole != null`.
3. **`list` se povoluje podle DOTAZU** — dotaz musí sám dokazovat oprávnění.
4. **Pravidla neumí join** — přístup patří denormalizovaně na entitu, jen se rozšiřuje.
5. **Právní rovina (soud) a servisní rovina (smlouva) se nesmí míchat.**
6. **Jedna osoba pečující = nejvýš jeden titul**, a konec Dohody ≠ uvolnění.
7. **Nikdy nevymýšlej data**, která systém nezná — `null` a poctivé „doplnit"
   je vždycky lepší než pravděpodobně správná hodnota, kterou za měsíc nikdo
   nerozezná od zjištěné.
