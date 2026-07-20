import type { SubjectRef } from './timelineEntry'

/**
 * families/{familyId}/documents/{docId} — ZADANI §6 A1, M5. Nahrazuje M2
 * placeholder (5 českých stavů, jen pro §4.5 rules fixtures) PLNÝM
 * schvalovacím automatem:
 *
 *   draft → foster_review → (commented|approved_foster) → final →
 *   mgmt_review → closed|closed_foster_unapproved|closed_ko_unapproved|
 *   closed_both_unapproved → sent|filed
 *
 * Smyčka `foster_review ↔ commented` se opakuje, dokud KO znovu needituje
 * a nepošle zpět (§6 A1 bod 4). `final` je dosažitelné jak z
 * `approved_foster`, TAK z `commented` — KO SMÍ pokračovat i bez
 * výslovného schválení pěstounem (přesně proto existují
 * `closed_*_unapproved` koncové stavy, viz níž).
 *
 * INTERPRETAČNÍ ROZHODNUTÍ (zadání nedefinuje, co přesně znamená "ko" v
 * `closed_ko_unapproved" — KO přece celý tok sám řídí): `assignedKoApprovedAt`
 * sleduje, jestli krok 5 ("KO označí Konečný") provedl PŘÍMO přiřazený KO
 * Dohody (`agreement.assignedTo`), NEBO jiný staff (`asistent_ko`, jiná
 * klíčová osoba zaskakující za kolegyni) — pokud jiný, `assignedKoApprovedAt`
 * zůstává `null` a uzavření dokumentu to odrazí v `closed_ko_unapproved`/
 * `closed_both_unapproved`. `fosterApprovedAt`/`assignedKoApprovedAt` jsou
 * NEZÁVISLÉ příznaky (ne samotný `status`) — `documentService.mgmtClose`
 * z nich koncový stav ODVOZUJE, vedení nevybírá ručně ze 4 tlačítek.
 * Než tenhle výklad Petr případně opraví, ber ho jako odůvodněný, ne
 * jistý — zapsáno záměrně zjevně v kódu, ne potichu.
 *
 * PDF/DOCX export s UID/verzí/hashem/QR (001-IDENTITY_MODEL.md §7) je
 * SEAM — UID/hash/verze/QR se ukazují na obrazovce od prvního uložení,
 * ale generování samotného staženého PDF/DOCX souboru vyžaduje novou
 * knihovnu a je mimo rozsah týhle dávky (stejná kategorie jako OCR/AI
 * SEAMy jinde v projektu).
 */
export type FamilyDocumentStatus =
  | 'draft'
  | 'foster_review'
  | 'commented'
  | 'approved_foster'
  | 'final'
  | 'mgmt_review'
  | 'closed'
  | 'closed_foster_unapproved'
  | 'closed_ko_unapproved'
  | 'closed_both_unapproved'
  | 'sent'
  | 'filed'

/** `markdown` = KO psaný obsah (tahle dávka práce). `pdf`/`image` = §6 A4
 * ingest (přijatý dokument zvenku) — datově připravené, OCR/e-mailový
 * kanál samotný zůstává SEAM (Vertex Vision, MX/parser, viz A4 text). */
export type FamilyDocumentKind = 'markdown' | 'pdf' | 'image'

export interface FamilyDocumentDoc {
  uid: string
  createdByOrgId: string
  createdByUid: string
  familyId: string
  kind: FamilyDocumentKind
  title: string
  status: FamilyDocumentStatus
  /** §6 A2: report pro OSPOD je BĚŽNÝ dokument se `subjectRefs` na děti —
   * stejný typ jako timeline, žádná zvláštní entita. */
  subjectRefs: SubjectRef[]
  /** Aktuální (nejnovější verze) obsah — denormalizace z `versions`
   * poslední položky, kvůli čtení bez druhého dotazu. */
  body: string
  currentVersion: number
  /** SHA-256 hex aktuálního `body`, Web Crypto (`crypto.subtle`) — stejný
   * mechanismus jako `backupService.ts`, žádná nová závislost. */
  hash: string
  fosterApprovedAt?: string | null
  fosterApprovedByUid?: string | null
  fosterComments?: string | null
  assignedKoApprovedAt?: string | null
  assignedKoApprovedByUid?: string | null
  /** §6 A1 bod 6: "KO → vedení, VÝBĚR SCHVALOVATELE" — kdo byl vybraný
   * jako schvalovatel, jen informativní (rules nekontrolují, že PRÁVĚ
   * tenhle člověk uzavření provedl — libovolné vedení organizace smí,
   * stejně jako libovolný org_admin, viz firestore.rules). */
  mgmtReviewerUid?: string | null
  /** Vedení "zamítne (zpět draft s důvodem)" — §6 A1 bod 7. */
  rejectionReason?: string | null
  sentTo?: 'ospod' | 'soud' | null
  sentAt?: string | null
  filedAt?: string | null
  createdAt: string
  updatedAt: string
}

/** families/{familyId}/documents/{docId}/versions/{versionId} —
 * append-only audit stopa (§5, §6 A1 bod 2 "nová verze do append-only
 * versions"). `createdByOrgId` denormalizované PŘÍMO na verzi (ne jen na
 * rodičovském dokumentu) — zjednodušuje `firestore.rules` (přímé
 * `sameOrg`, žádný `get()` na rodiče). */
export interface DocumentVersionDoc {
  createdByOrgId: string
  version: number
  body: string
  editedByUid: string
  createdAt: string
  hash: string
}
