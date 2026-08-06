/**
 * uidHolderCard/{uid} — OVĚŘOVACÍ KARTA K UID.
 *
 * ─── TOHLE JE JEDINÉ MÍSTO, KDE OSOBNÍ ÚDAJ PŘEKRAČUJE HRANICI ────────
 * ─── ORGANIZACE. Čtěte dřív, než sem cokoli přidáte. ──────────────────
 *
 * Zadání Petr Homolka, 26. 7.: když nová organizace zadá UID a systém
 * najde shodu, má zobrazit „jméno, příjmení, adresu, a příslušnost
 * k doprovázející organizaci". Bez toho nemá pracovník jak poznat, jestli
 * opsal UID správně — a člověk, kterého se to týká, mu sedí naproti.
 *
 * Vědomě to jde PROTI pravidlu, které drží `titleRegistry` a `personIndex`
 * („ven jde jen obsazeno/volno a kontakt na organizaci"). Proto je to
 * SAMOSTATNÁ kolekce a ne další pole tam: ostatní kód s těmi dvěma
 * kolekcemi zachází jako s neosobními a to se nesmí změnit tím, že si
 * někdo přihodí jméno k rejstříku.
 *
 * ─── CO TO STOJÍ, NAPSANÉ NAHLAS ──────────────────────────────────────
 *
 * UID má kontrolní číslici, takže platné je zhruba každé desáté
 * třináctimístné číslo, a prvních šest míst (typ + organizace) se dá
 * uhodnout. Kdo bude zkoušet čísla po řadě, bude dostávat jména a adresy.
 * Pravidla Firestore počet dotazů omezit neumí.
 *
 * Zábrany, které tu jsou:
 *   • každý dotaz se povinně zapisuje do auditu volající organizace
 *     (`uidHolderCardService` — bez auditního kontextu se zeptat nedá),
 *   • kolekce nejde vylistovat,
 *   • karta obsahuje MINIMUM na ověření totožnosti: jméno, příjmení,
 *     obec. NE celou adresu s číslem popisným, NE rodné číslo, NE datum
 *     narození, NE nic o dětech.
 *
 * Zábrana, která tu NENÍ a musí přibýt před ostrým provozem: omezení
 * počtu dotazů na organizaci za den. To jde jedině serverovou funkcí.
 * Do té doby je audit odstrašení, ne prevence.
 */
export interface UidHolderCardDoc {
  uid: string
  firstName: string
  lastName: string
  /**
   * OBEC, ne celá adresa. Na ověření „ano, tenhle pan Novák z Kolína to
   * je" to stačí a zneužít se to dá o poznání hůř než ulice s číslem.
   */
  municipality: string
  /** Organizace, která osobu vede. Odtud vede cesta na vizitku. */
  holderOrgId: string | null
  updatedAt: string
}

/** Jak se karta ukáže na obrazovce. */
export function describeHolder(card: UidHolderCardDoc): string {
  const name = `${card.firstName} ${card.lastName}`.trim()
  return card.municipality ? `${name}, ${card.municipality}` : name
}
