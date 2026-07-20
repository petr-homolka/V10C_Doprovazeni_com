import type { FamilyDocumentStatus } from '@/types/familyDocument'

/** Sdílené české popisky stavů §6 A1 automatu — FamilyDetailPage,
 * DocumentDetailPage, globální /dokumenty seznam i /moje foster pohled
 * všechny čtou ODSUD, ne vlastní kopii (jedno místo pravdy). */
export const DOCUMENT_STATUS_LABELS: Record<FamilyDocumentStatus, string> = {
  draft: 'Koncept',
  foster_review: 'Čeká na pěstouna',
  commented: 'Okomentováno pěstounem',
  approved_foster: 'Schváleno pěstounem',
  final: 'Konečná verze',
  mgmt_review: 'Čeká na vedení',
  closed: 'Uzavřeno',
  closed_foster_unapproved: 'Uzavřeno (bez schválení pěstouna)',
  closed_ko_unapproved: 'Uzavřeno (bez schválení klíčové osoby)',
  closed_both_unapproved: 'Uzavřeno (bez schválení obou stran)',
  sent: 'Odesláno',
  filed: 'Uloženo do spisu',
}
