/**
 * organizations/{orgId}/backupConfig + backupJobs/{jobId} — ZADANI §5.5
 * "Záloha — dvě vrstvy". Tenhle typ je jen VRSTVA 2 (organizační,
 * self-service) — vrstva 1 (platformní DR záloha) je superadmin-only
 * provozní věc mimo appku, nemá tu žádný typ.
 *
 * M1.5 SEAM: `destination.type === 'download'` je JEDINÁ cesta, která
 * tenhle build skutečně provede end-to-end (klient-side generování +
 * šifrování + stažení, viz backupService.ts). `gdrive`/`onedrive`/`ftp`
 * jsou v UI vybratelné, ale NEFUNGUJÍ — potřebují OAuth konektor/FTP
 * přihlašovací tok a server-side doručení, žádné z toho tenhle build
 * nemá. Naplánovaná záloha (`schedule.enabled`) se dá NASTAVIT (uloží se
 * do Firestore), ale nikdy sama nespustí — potřebuje Cloud
 * Scheduler+Function, které nejsou nasazené (žádný reálný Firebase
 * projekt zatím neexistuje). "Zálohovat teď" tlačítko funguje VŽDY
 * (manuální trigger, klient spustí generování okamžitě), bez ohledu na
 * chybějící scheduler.
 */
export type BackupDestinationType = 'download' | 'gdrive' | 'onedrive' | 'ftp'

export interface BackupSchedule {
  enabled: boolean
  dayOfWeek?: string
  time?: string
  timezone?: string
}

export interface BackupDestination {
  type: BackupDestinationType
  path?: string
}

export interface BackupConfigDoc {
  schedule: BackupSchedule
  destination: BackupDestination
  encryption: { method: 'AES-256'; keyOwnership: 'organizace' }
}

export type BackupTrigger = 'schedule' | 'manual'
export type BackupJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface BackupJobDoc {
  triggeredBy: BackupTrigger
  requestedAt: string
  startedAt?: string | null
  finishedAt?: string | null
  status: BackupJobStatus
  scope: 'full'
  sizeBytes?: number
  destinationType: BackupDestinationType
  error?: string
}

/**
 * organizations/{orgId}/backupRestoreTests/{id} — POVINNÝ GATE (§5.5):
 * "Záloha, která se nikdy nezkusila obnovit, není záloha." M1.5 staví jen
 * typ + rules — skutečné obnovení (a tedy i skutečný test obnovy)
 * potřebuje bezpečné server-side zpracování (dešifrování, dry-run diff,
 * náhrada celé organizace), které vyžaduje Cloud Functions — SEAM, viz
 * backupService.ts. Bez alespoň jednoho záznamu s `restoreSuccessful:
 * true` tady se zálohovací mechanismus nepovažuje za ověřený pro
 * produkční nasazení — to zůstává explicitně NESPLNĚNO.
 */
export interface BackupRestoreTestDoc {
  performedAt: string
  performedBy: string
  backupJobRef: string
  restoreEnvironment: 'isolated_staging'
  restoreSuccessful: boolean
  integrityCheck: {
    recordCountsMatch: boolean
    sampleRecordsVerified: boolean
  }
  measuredDurationMinutes: number
  notes?: string
}
