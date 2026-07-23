# DESIGN_PATHS.md

> Petrovo zadání (2026-07-24): "rozdělení na dvě designové cesty... Cesta A
> = to co nyní máme, Cesta B = nová designová cesta... a nebude pouze
> Cesta B, ale možná i C D E..." — tenhle soubor je RECEPT, jak založit
> další cestu, a PŘEHLED, co existuje teď.

## Princip

Každá "cesta" = **vlastní git branch** + **vlastní Firebase Hosting web**
(stejný Firebase projekt, stejná Firestore/Auth databáze — jde jen o
VZHLED, ne o jiná data). Všechny cesty existují SOUČASNĚ, natrvalo, na
vlastních adresách — žádná z nich nikdy nepřepisuje jinou. Vracet se k
libovolné cestě znamená prostě otevřít její adresu, nic se neruší ani
neslučuje, dokud si to výslovně nevyžádáš.

## Aktuální cesty

| Cesta | Branch               | Firebase Hosting target | URL                                    | Poznámka                          |
|-------|----------------------|--------------------------|-----------------------------------------|------------------------------------|
| A     | `claude/session-zhiye5` (→ `master` po sloučení PR) | `path-a`   | https://v10c-doprovazeni-com.web.app   | Současný produkční vzhled, beze změny. |
| B     | `design-b`            | `design-b`               | https://v10c-design-b.web.app          | Lumo/Vaadin inspirovaná cesta — plná strukturální přestavba (taby, PageHeader, full-bleed Kalendář s pravým panelem, rozšiřitelné číselníky, ikonové čipy). Průběžně živá, Petr na ní dál dolaďuje. |
| C     | `design-c`            | `design-c`               | https://v10c-design-c.web.app          | Snímek Cesty B ze dne 2026-07-23 (větev odbočená z tehdejšího `design-b`) — zachovaný bod, ke kterému se lze kdykoli vrátit a nezávisle v něm dál dělat úpravy, i když se Cesta B mezitím posune jinam. |
| D     | `design-d`            | `design-d`               | https://v10c-design-d.web.app          | Založená 2026-07-23 (stejný výchozí bod jako C) — čeká na kompletní nové zadání design systému, zatím vizuálně identická s tehdejší Cestou B. |

## Jak založit další cestu (C, D, E, …)

Vždy stejných 6 kroků — jen změň `design-c`/`v10c-design-c` na
odpovídající písmeno:

```bash
# 1. Nový Firebase Hosting web (jednorázově, jen při zakládání cesty)
firebase hosting:sites:create v10c-design-c --project v10c-doprovazeni-com

# 2. Namapovat "target" jméno na ten web (zapíše se do .firebaserc)
firebase target:apply hosting design-c v10c-design-c --project v10c-doprovazeni-com

# 3. Přidat blok do firebase.json → pole "hosting" (zkopírovat existující
#    blok, jen změnit "target")
#    { "target": "design-c", "public": "dist", "ignore": [...], "rewrites": [...] }

# 4. Nová git branch od aktuálního stavu (nebo od kterékoli existující cesty)
git checkout -b design-c
git push -u origin design-c

# 5. Na týhle branchi se dělají VŠECHNY designové úpravy pro cestu C —
#    zbytek appky (Firestore rules, služby, datový model) zůstává STEJNÝ
#    jako na ostatních cestách, pokud se výslovně nerozhodne jinak.

# 6. Nasazení (po `npm run build` na aktuální branchi):
firebase deploy --only hosting:design-c --project v10c-doprovazeni-com
```

Krok 1–3 se dělají JEDNOU (zůstávají v `.firebaserc`/`firebase.json`,
sdílené napříč branchemi po smazání/sloučení). Krok 6 se opakuje pokaždé,
když chceš na tu cestu nahrát novou verzi — vždy z branche, která k té
cestě patří.

## Jak "povýšit" cestu na produkci

Pokud se ti některá cesta (např. B) zalíbí natolik, že se má stát NOVOU
hlavní appkou:

1. Sloučit `design-b` do `master` (běžný merge/PR).
2. Přesměrovat `path-a` target na produkční web (buď `firebase target:apply
   hosting path-a v10c-design-b` — cesta B "se stane" cestou A, PŮVODNÍ
   `v10c-doprovazeni-com` web přestane dostávat nasazení, ale nemaže se),
   NEBO jednodušeji: dál nasazovat na oba weby stejný obsah, dokud si
   nebudeš jistý, a starý `v10c-design-b` web pak smazat
   (`firebase hosting:sites:delete v10c-design-b`).

Žádný krok tady není nevratný, dokud aktivně nesmažeš Hosting web/branch.

## Jak cestu zahodit

`firebase hosting:sites:delete v10c-design-c` (smaže jen ten web, ne
appku/data) + smazat branch (`git push origin --delete design-c`), pokud
už ji definitivně nechceš. Firestore/Auth data zůstávají netknutá — nikdy
nebyla per-cesta oddělená.
