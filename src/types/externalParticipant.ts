/**
 * external_participants/{epId} — původní ZADANI §5.1. Žádné speciální
 * role (rodič/psycholog/škola) — jeden obecný účet + popisný `relationLabel`
 * (bez právních účinků) + přidělená oprávnění (granty) + audit. Výchozí
 * stav = vše zakázáno. RČ ani WhatsApp se PŘI REGISTRACI NEPOŽADUJÍ.
 */
/** `child` i `fosterPerson` — externista nemusí patřit jen k dítěti (viz
 * `access/{entityId}/grants` níž, kde `entityId` je docId jednoho, nebo
 * druhého). `primary*` jen usnadňuje UI (předvyplnění při registraci),
 * granty samotné na tomhle poli nezávisí. */
export type ExternalEntityType = 'child' | 'fosterPerson'

export interface ExternalParticipantDoc {
  organizationId: string
  name: string
  email: string
  phone?: string
  relationLabel: string // popisný, žádná logika oprávnění sama o sobě
  primaryEntityType?: ExternalEntityType
  primaryEntityId?: string
  primaryEntityLabel?: string
  createdAt: string
  disabledAt?: string | null
}

/** Katalog oprávnění — přesně toto pořadí/jména dle §5.1. `*` = citlivé. */
export const PERMISSION_KEYS = [
  'viewDocuments',
  'viewTimeline',
  'viewPhotos',
  'viewSchool',
  'viewMedical', // *
  'viewReports',
  'viewCalendar',
  'uploadFiles',
  'downloadFiles',
  'signDocuments', // *
  'chatWith', // *
  'receiveNotifications',
  'confirmVisits',
  'videoCalls', // *
] as const
export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const SENSITIVE_PERMISSIONS: readonly PermissionKey[] = ['viewMedical', 'signDocuments', 'chatWith', 'videoCalls']
export function isSensitivePermission(key: PermissionKey): boolean {
  return (SENSITIVE_PERMISSIONS as readonly string[]).includes(key)
}

export interface TimeWindow {
  frequency: 'daily' | 'weekly'
  daysOfWeek?: number[] // 0-6, jen pro weekly
  from: string // HH:mm
  to: string // HH:mm
  weekParity?: 'all' | 'odd' | 'even'
}

/**
 * external_participants/{epId}/access/{entityId}/grants/{grantId} — `entityId`
 * je docId dítěte NEBO pěstouna (viz `ExternalEntityType` výš), verzované,
 * `revoke` = nastavení `validTo`, NIKDY delete. Citlivá oprávnění = 3 kroky/
 * 3 aktéři (`requestGrant→approveGrant→activateGrant`), necitlivá = `grantDirect`.
 */
export type GrantStatus = 'requested' | 'approved' | 'active' | 'revoked' | 'rejected'

export interface GrantDoc {
  permissionKey: PermissionKey
  status: GrantStatus
  validFrom: string
  validTo?: string | null
  timeWindows?: TimeWindow[]
  reasonType?: string
  sourceType?: string
  requestedBy?: string
  requestedAt?: string
  approvedBy?: string | null
  approvedAt?: string | null
  activatedBy?: string | null
  activatedAt?: string | null
  revokedBy?: string | null
  revokedAt?: string | null
  note?: string
}

/** organizations/{orgId}/externalRoleTemplates/{id} — zkratka pro VYPLNĚNÍ,
 * NE pro SCHVÁLENÍ. Citlivá oprávnění pořád projdou celým řetězcem. */
export interface ExternalRoleTemplateDoc {
  name: string
  category: string // váže se na relationLabel jako filtr výběru v UI
  defaultPermissions: Partial<Record<PermissionKey, boolean>>
  defaultTimeWindows?: TimeWindow[]
  suggestedReasonType?: string
  createdBy: string
  updatedAt: string
}
