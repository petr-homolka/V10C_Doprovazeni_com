/**
 * titleRegistry/{uid} — REJSTŘÍK OBSAZENÝCH UID.
 *
 * Vzniklo z jedné Petrovy odpovědi („Zablokovat :-)") a z jedné tvrdé
 * překážky: metodika MPSV zakazuje, aby osoba pečující měla v daném čase
 * víc než jeden právní titul — jenže dnešní `firestore.rules` organizaci
 * NEDOVOLÍ přečíst cizí Dohodu (`sameOrg(resource.data.organizationId)`).
 * Systém tedy o cizím titulu neví a bez tohohle rejstříku ho nemá jak
 * zablokovat. Kontrola, která se dá obejít tím, že data nevidí, není
 * kontrola.
 *
 * ─── PROČ JE TO SAMOSTATNÁ KOLEKCE A NE POLE NA PĚSTOUNOVI ────────────
 *
 * `fosterPersons/{id}` čte jen organizace v `orgAccessList`. Přesně ta,
 * která se ptá „je tohle UID volné?", tam ještě není — a být nesmí,
 * protože se ptá dřív, než získá jakýkoli vztah k té osobě. Rejstřík je
 * proto samostatná, platformní kolekce s vlastními pravidly.
 *
 * ─── CO TU SCHVÁLNĚ NENÍ ──────────────────────────────────────────────
 *
 * ŽÁDNÉ OSOBNÍ ÚDAJE. Ani jméno, ani rodné číslo, ani id rodiny. Odpověď
 * zní „obsazeno / volno, kým a dokdy" — nic víc. Kdo se zeptá na cizí UID,
 * nesmí se dozvědět, komu patří. Proto se taky rejstřík nedá vylistovat
 * (`allow list: if false`) — jde jen sáhnout na konkrétní UID, které
 * tazatel už zná.
 */

export interface TitleRegistryDoc {
  /** UID osoby pečující. Zároveň document ID — sáhne se přímo, bez dotazu. */
  uid: string

  /**
   * Organizace v našem systému, která titul drží. `null` znamená, že titul
   * běží MIMO nás — u OSPODu jako doprovázejícího subjektu nebo u cizí
   * organizace.
   */
  holderOrgId: string | null

  /** Jméno subjektu mimo náš systém, když `holderOrgId` je `null`. */
  externalSubjectName?: string | null

  validFrom: string
  /** `null` = běží. Vyplněné = titul skončil (nebo má konec naplánovaný). */
  validTo: string | null

  updatedAt: string
  /** Kdo zápis provedl — kvůli dohledatelnosti, ne kvůli přístupu. */
  updatedByOrgId: string
}

/**
 * Běží titul k danému dni? Stejné pravidlo jako `isEffective` v custody.ts
 * — konec je VÝLUČNÝ.
 *
 * Díky tomu se skončený titul uvolní SÁM, bez zápisu: stačí, že `validTo`
 * uplynulo. Kdyby uvolnění záviselo na zápisu, jeden zapomenutý by UID
 * zablokoval navždycky.
 */
export function isTitleRunning(entry: TitleRegistryDoc, at: Date = new Date()): boolean {
  const day = at.toISOString()
  if (entry.validFrom > day) return false
  return !entry.validTo || entry.validTo > day
}
