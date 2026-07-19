# CURRENT_STATE.md

> Čti tohle PŘED zadáním (viz ZADANI §11 bod 1: "čti mapu, ne území").
> Odkazuje na `ZADANI-PRO-NOVEHO-PROGRAMATORA.md` a `DESIGN_SYSTEM.md` v
> `../nove zadani/` — ty jsou zdroj pravdy pro CO a JAK, tenhle soubor jen
> říká CO UŽ JE HOTOVO a jaká rozhodnutí padla cestou.

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

### Jak pokračovat (M1+M2 hotové, viz sekce nahoře souboru → M1.5/M3)

M1 a M2 jsou hotové — detaily, seamy a co zůstává neověřené jsou v
sekcích "Modul M1 hotový"/"Modul M2 hotový" úplně nahoře souboru, čti tu,
ne tohle staré shrnutí. Další v pořadí dle §11.1 tabulky: **M1.5
(Import/Export/Záloha)**, nebo rovnou **M3 (Časová osa a hlasový
zápisník)** — M3 přímo naváže na `families`/M2 (skutečné `timeline`
záznamy + konečně zapojí `historyDigest` generování, které M2 nechalo
jen jako pravidla). Než začneš M3, přečti si `ZADANI §7` (hlasový
zápisník) a `§4.4.A` (vzdělávání pěstounů, dvojí evidence) znovu — ne
celý dokument. Pokud se ještě NEPODAŘILO rozchodit lokální Firestore
emulátor, zkus napřed `hash -r` v bashi (viz "Modul M2 hotový" — reálný
nález, mohlo to celou dobu tiše maskovat skutečnou chybovou hlášku).
