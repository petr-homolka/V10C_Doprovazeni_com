import type { Timestamp } from 'firebase/firestore'

/**
 * organizations/{orgId}/auditLog/{entryId} — NEMĚNITELNÁ stopa o tom, kdo
 * co udělal s údaji o rodinách, dětech a pěstounech.
 *
 * PROČ to existuje: dosud jsme věděli jen „kdo záznam vytvořil"
 * (`createdByUid` na dokumentu). To odpovídá na otázku autorství, ne na
 * otázku, kterou dostaneme při kontrole: „kdo tenhle spis otevřel, komu
 * jste ta data poslali a kdo komu dal přístup". U platformy, která navíc
 * STĚHUJE údaje o dětech mezi správci (přechod k jiné doprovázející
 * organizaci), je tahle otázka jádrem doložitelnosti.
 *
 * CO SE LOGUJE: rozhodnutí a zpřístupnění, ne prohlížení. Zápis do
 * Firestore něco stojí a log, ve kterém je milion řádků „otevřel profil",
 * se nedá číst ani platit. Kategorie jsou dole v `AUDIT_ACTIONS`.
 *
 * ČEMU TAHLE VRSTVA NEBRÁNÍ (a je poctivé to říct nahlas): zápis dělá
 * klient. Pravidla vynutí, že (a) nikdo nezaloží záznam pod cizím jménem,
 * (b) záznam nejde změnit ani smazat, ani superadminem, a (c) čas je
 * serverový. Nevynutí ale, že upravený klient záznam vůbec pošle. Log je
 * tedy důkaz o běžném provozu, ne forenzní nástroj proti útočníkovi se
 * znalostí kódu. Neprůstřelná verze potřebuje serverovou vrstvu (Cloud
 * Functions) — dokud ji nemáme, tohle je maximum, které nestojí nic.
 */

export const AUDIT_ACTIONS = {
  // ---- Údaje opustily organizaci ------------------------------------
  document_sent_authority: 'Dokument odeslán úřadu',
  export_generated: 'Vygenerován export dat organizace',
  backup_created: 'Vytvořena a stažena záloha',

  // ---- Pohyb spisu mezi organizacemi --------------------------------
  agreement_created: 'Založena Dohoda',
  agreement_end_scheduled: 'Naplánováno ukončení Dohody',
  agreement_end_cancelled: 'Zrušeno naplánované ukončení Dohody',
  spis_access_granted: 'Spis zpřístupněn organizaci',

  // ---- Kdo dostal přístup k údajům ----------------------------------
  external_grant_requested: 'Požádáno o přístup pro externistu',
  external_grant_approved: 'Schválen přístup pro externistu',
  external_grant_rejected: 'Zamítnut přístup pro externistu',
  external_grant_activated: 'Aktivován přístup pro externistu',
  external_grant_revoked: 'Odebrán přístup externisty',
  collaborator_assigned: 'Spolupracovníkovi přiřazena osoba',
  collaborator_unassigned: 'Spolupracovníkovi odebrána osoba',
  staff_role_changed: 'Změněna role zaměstnance',
  staff_access_disabled: 'Zablokován přístup zaměstnance',
  staff_access_enabled: 'Obnoven přístup zaměstnance',

  // ---- Mazání --------------------------------------------------------
  record_deleted: 'Smazán záznam',
  retention_sweep: 'Proveden retenční úklid',
} as const

export type AuditAction = keyof typeof AUDIT_ACTIONS

/**
 * Kategorie slouží k filtrování v přehledu — kontrolor se ptá „co odešlo
 * ven" nebo „kdo dostal přístup", ne na jednotlivé akce.
 */
export const AUDIT_CATEGORIES = {
  disclosure: 'Údaje ven z organizace',
  transfer: 'Pohyb spisu',
  access: 'Přístupová práva',
  deletion: 'Mazání',
} as const

export type AuditCategory = keyof typeof AUDIT_CATEGORIES

export const AUDIT_ACTION_CATEGORY: Record<AuditAction, AuditCategory> = {
  document_sent_authority: 'disclosure',
  export_generated: 'disclosure',
  backup_created: 'disclosure',
  agreement_created: 'transfer',
  agreement_end_scheduled: 'transfer',
  agreement_end_cancelled: 'transfer',
  spis_access_granted: 'transfer',
  external_grant_requested: 'access',
  external_grant_approved: 'access',
  external_grant_rejected: 'access',
  external_grant_activated: 'access',
  external_grant_revoked: 'access',
  collaborator_assigned: 'access',
  collaborator_unassigned: 'access',
  staff_role_changed: 'access',
  staff_access_disabled: 'access',
  staff_access_enabled: 'access',
  record_deleted: 'deletion',
  retention_sweep: 'deletion',
}

/**
 * Odkaz na entitu. `label` je DENORMALIZOVANÝ schválně: uživatel i rodina
 * můžou ze systému zmizet, záznam v logu musí zůstat čitelný i pak. Proto
 * se tu neukládá jen id.
 */
export interface AuditRef {
  kind: 'family' | 'child' | 'fosterPerson' | 'document' | 'user' | 'organization' | 'externalParticipant' | 'other'
  id: string
  label: string
}

/**
 * Kdo akci udělal. Služby ho dostávají jako parametr — schválně, aby
 * nemusely sahat na přihlášeného uživatele a daly se testovat.
 */
export interface AuditActor {
  uid: string
  name: string
  role: string
}

export interface AuditEntryDoc {
  organizationId: string
  action: AuditAction
  category: AuditCategory

  /** Kdo. `actorName`/`actorRole` denormalizované ze stejného důvodu jako `AuditRef.label`. */
  actorUid: string
  actorName: string
  actorRole: string

  /** Čas z klienta — jen pro řazení a zobrazení. */
  at: string
  /** Čas ze serveru — pravidla vynucují `== request.time`. Tomuhle se věří. */
  serverAt: Timestamp | unknown

  /** Koho se to týká (rodina, dítě, pěstoun). */
  subject?: AuditRef
  /** Čeho se to týká (dokument, přístup, uživatel). */
  target?: AuditRef

  /** Druhá organizace u přenosů spisu. */
  counterpartOrgId?: string

  /** Jedna věta česky — co se stalo. Vždy bez citlivého obsahu záznamu. */
  detail?: string
}

/** Vstup pro `recordAudit` — server dopočítá `category`, `at` a `serverAt`. */
export type AuditEntryInput = Omit<AuditEntryDoc, 'category' | 'at' | 'serverAt'>
