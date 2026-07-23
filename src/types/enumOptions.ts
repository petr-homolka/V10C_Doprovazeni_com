/**
 * organizations/{orgId}/enumOptions/{listId} — Petrovo zadání 2026-07-23:
 * "Většina číselníků nesmí mít konečný počet variant... uživatel si je
 * definuje sám (+ Přidat nový)". `listId` je libovolný identifikátor
 * číselníku (např. `calendarEventKind`) — jeden dokument = jeden číselník
 * pro danou organizaci, ať přidání nové položky je JEDNA atomická
 * `arrayUnion` operace (žádné čtení-před-zápisem, žádná race podmínka
 * mezi dvěma zaměstnanci přidávajícími položku současně).
 *
 * ZÁMĚRNĚ obecné (ne `calendarEventKindOptions` jméno) — stejný dokument
 * tvar se dá znovupoužít pro libovolný další číselník (typ dokumentu,
 * role externisty, …), viz `enumOptionsService.ts`.
 */
export interface EnumOption {
  key: string
  label: string
  createdByUid: string
  createdAt: string
}

export interface EnumOptionsDoc {
  options: EnumOption[]
}
