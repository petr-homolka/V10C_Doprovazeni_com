/**
 * families/{familyId} — SPIS (rodinná složka), ZADANI §3/§4.1/§4.5.
 *
 * ─── K ČEMU SPIS JE A K ČEMU UŽ NE, 2026-07-26 ────────────────────────
 *
 * Za jeden den se pod Spisem vyměnilo skoro všechno, co ho dřív dělalo
 * důležitým. Stojí za to napsat, co mu zbylo, než ho někdo začne
 * považovat za víc, než je.
 *
 * UŽ NENÍ IDENTITA. Identitu má ČLOVĚK — pěstoun i dítě mají vlastní
 * náhodné UID, které je jejich napořád a putuje s nimi mezi organizacemi.
 * Právní rovinu drží rozhodnutí soudu a svěření (`types/custody.ts`),
 * výlučnost titulu se hlídá na OSOBĚ PEČUJÍCÍ (`titleRegistry`), ne na
 * domácnosti. „Rodina není jednotka" — to je celý důvod, proč custody
 * model vznikl.
 *
 * POŘÁD JE TO SCHRÁNKA A ROZSAH PŘÍSTUPU. A to je práce, kterou nic
 * jiného nedělá:
 *
 *   • Visí na něm PĚT podkolekcí — agreements, timeline, documents,
 *     historyDigest, messages. Návštěva v rodině, dokument o domácnosti
 *     nebo chat nepatří jednomu člověku, patří domácnosti.
 *   • `orgAccessList` je kotva přístupových práv. Celá §4.5 segmentace
 *     v `firestore.rules` stojí na cestě `families/{familyId}/…` —
 *     pravidla neumí join, takže bez společné cesty by se „kdo smí číst
 *     čí historii" nedalo napsat.
 *   • Je to pracovní plocha. Klíčová osoba otevírá „Novákovy", ne tři
 *     nezávislé lidi.
 *
 * ČEHO SE VYVAROVAT: `uid` níž je číslo SLOŽKY, ne identita. Nikdo si
 * domácnost mezi organizacemi nepřenáší — přenáší se ČLOVĚK. Kdo by začal
 * s UID Spisu zacházet jako s UID pěstouna, narazí u první rozvedené
 * rodiny nebo u pěstouna, který se přestěhuje do jiné domácnosti.
 *
 * `orgAccessList` (M2) NAHRAZUJE M1 dočasné `createdByOrgId` — je to
 * denormalizovaný seznam VŠECH organizací, které kdy měly s rodinou
 * Dohodu (aktivní i skončenou), aktualizovaný `agreementService.ts` při
 * založení Dohody (`arrayUnion`, nikdy se neodebírá — jednou přítomná
 * organizace vidí Spis navždy, i po skončení Dohody, §4.5: "vlastní
 * období: vidí VŠE... natrvalo, i po skončení vlastní Dohody"). Tohle
 * pole řeší JEN přístup k samotnému Spisu (identita/adresa/pěstouni).
 *
 * Jemnější 3-úrovňové pravidlo pro historii (timeline/documents/
 * historyDigest, §4.5 "Pravidlo čtení": "načíst vlastní Dohodu organizace
 * O pro daný Spis") čte PŘÍMO dokument `families/{familyId}/agreements/
 * {organizationId}` — Dohoda má deterministické ID (= organizationId, viz
 * AgreementDoc), takže nepotřebuje žádnou denormalizovanou kopii tady;
 * jeden zdroj pravdy, ne dva sesynchronizovaná pole.
 */
export interface FamilyDoc {
  uid: string
  orgAccessList: string[]
  fosterPersonRefs: string[]
  address?: string
  /** Cloud Storage download URL (`avatars/families/{familyId}/...`, viz
   * avatarService.ts) — M3, jen zobrazovací účel, žádná Firestore rules
   * logika se na tohle pole neváže. */
  avatarUrl?: string | null
  createdAt: string
  /**
   * Vyplněné JEN pokud tenhle Spis vznikl hromadným importem (§5.5, M1.5)
   * — Firestore document ID rodičovského `importJobs/{jobId}`. Jediný účel:
   * `firestore.rules` na tohle pole navazuje NARROW delete výjimku pro
   * rollback (§5.5 "30denní okno na kompletní vrácení") — jinak by import
   * omylem nešel vůbec vrátit zpět, protože `families`/`fosterPersons`/
   * `children` mají jinak `delete: if false` natvrdo (audit stopa, §5).
   * Ručně založené entity tohle pole nikdy nemají.
   */
  createdByImportJobRef?: string
  /** DOPLNENI_ZADANI-DO-M5 §2 — výchozí stav přepínače "Sdílet s oběma
   * pěstouny" v zápisníku (`VoiceRecorderPanel`) pro tenhle Spis.
   * Nenastavené = `true` (běžný případ, sdíleno s oběma) — pole existuje
   * jen pro rodiny, kde chce pracovník tenhle výchozí stav trvale
   * změnit, ne pro každou rodinu zvlášť nastavovat. */
  partnerSharingDefault?: boolean
  /** UX zpětná vazba 2026-07-20 — profil rodiny se nemá jmenovat podle
   * syrového UID, ale podle čitelného, editovatelného jména. Nenastavené =
   * padá na jméno primárního pěstouna, pak adresu, pak UID (viz
   * FamilyDetailPage/FamilyListPage `resolveFamilyDisplayName` helper). */
  displayName?: string
  /** UX zpětná vazba 2026-07-21 — "Poslední dotek": denormalizace času
   * NEJNOVĚJŠÍHO timeline zápisu, co NENÍ `type: 'system'` (návštěva,
   * poznámka, hlasový zápis, dokument — cokoli od člověka), stejný vzor
   * jako `AgreementDoc.lastVisitAt`. Zapisuje `timelineService.ts` při
   * každém vytvoření zápisu. Na rozdíl od `lastVisitAt` (per Dohoda,
   * legislativní lhůta §3) je tohle jen provozní "kdy se s rodinou naposled
   * něco dělo" pro seznam Rodin — proto žije rovnou na Spisu, ne na Dohodě. */
  lastTouchAt?: string | null
}
