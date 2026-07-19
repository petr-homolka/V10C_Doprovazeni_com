import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getOrganization } from '@/services/organizationService'
import { generateOrganizationExport } from '@/services/exportService'
import type { BackupConfigDoc, BackupJobDoc } from '@/types/backup'

/**
 * Barrel service (ZADANI §11 bod 3) pro organizační zálohu — M1.5, §5.5
 * "vrstva 2" (self-service, na rozdíl od vrstva 1 = platformní DR mimo
 * appku). Viz src/types/backup.ts pro přesný rozsah tohodle SEAMu:
 * JEDINÁ cesta, co tenhle soubor skutečně provede end-to-end, je
 * `runManualBackup` se `destination.type === 'download'` — generuje
 * export (`exportService.ts`), zašifruje ho VLASTNÍM heslem organizace
 * (Web Crypto, AES-256-GCM + PBKDF2-SHA256) a vrátí hotový soubor ke
 * stažení. Naplánované zálohy a gdrive/onedrive/ftp cíle se dají v UI
 * NASTAVIT (`saveBackupConfig` je skutečně funkční zápis), ale nikdy se
 * samy nespustí/nedoručí — chybí Cloud Scheduler/Function a OAuth
 * konektory, žádné z toho tenhle build nemá nasazené.
 *
 * Heslo/klíč se NIKDE neukládá — ani ve Firestore, ani jinam — jen
 * dočasně v paměti prohlížeče pro odvození klíče přes PBKDF2. To je
 * doslovné naplnění §5.5 "organizace si klíč/heslo spravuje sama, systém
 * ho neukládá v čitelné podobě": my ho neukládáme VŮBEC, ani zašifrovaně.
 * Ztráta hesla = nevratná ztráta přístupu k obsahu zálohy, záměrně (jinak
 * bychom museli klíč nějak my sami držet, což by porušilo předpoklad).
 */

const PBKDF2_ITERATIONS = 210_000 // OWASP (2023) doporučené minimum pro PBKDF2-SHA256

export interface EncryptedBackupEnvelope {
  format: 'doprovazeni-backup-v1'
  createdAt: string
  organizationId: string
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string }
  ciphertext: string
}

function toBase64(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function deriveAesKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
}

async function encryptPayload(
  organizationId: string,
  payload: ArrayBuffer,
  password: string,
): Promise<EncryptedBackupEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(password, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload)
  return {
    format: 'doprovazeni-backup-v1',
    createdAt: new Date().toISOString(),
    organizationId,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    ciphertext: toBase64(ciphertext),
  }
}

function backupConfigRef(organizationId: string) {
  return doc(db, 'organizations', organizationId, 'backupConfig', 'config')
}

export async function getBackupConfig(organizationId: string): Promise<BackupConfigDoc | null> {
  const snap = await getDoc(backupConfigRef(organizationId))
  return snap.exists() ? (snap.data() as BackupConfigDoc) : null
}

export async function saveBackupConfig(organizationId: string, config: BackupConfigDoc): Promise<void> {
  await setDoc(backupConfigRef(organizationId), config)
}

export async function listBackupJobs(
  organizationId: string,
): Promise<Array<{ docId: string; job: BackupJobDoc }>> {
  const snap = await getDocs(collection(db, 'organizations', organizationId, 'backupJobs'))
  return snap.docs
    .map((d) => ({ docId: d.id, job: d.data() as BackupJobDoc }))
    .sort((a, b) => b.job.requestedAt.localeCompare(a.job.requestedAt))
}

export interface ManualBackupResult {
  blob: Blob
  filename: string
}

/**
 * Jediná plně funkční cesta (§5.5 SEAM, viz komentář nahoře). `password`
 * zadává organizace v UI těsně před spuštěním — nikdy se odsud nikam
 * neukládá ani neposílá, použije se jen pro odvození klíče v téhle funkci.
 */
export async function runManualBackup(organizationId: string, password: string): Promise<ManualBackupResult> {
  const jobRef = doc(collection(db, 'organizations', organizationId, 'backupJobs'))
  const requestedAt = new Date().toISOString()
  const jobData: BackupJobDoc = {
    triggeredBy: 'manual',
    requestedAt,
    startedAt: requestedAt,
    finishedAt: null,
    status: 'running',
    scope: 'full',
    destinationType: 'download',
  }
  await setDoc(jobRef, jobData)

  try {
    const org = await getOrganization(organizationId)
    const { workbook } = await generateOrganizationExport(organizationId)
    const xlsxBuffer = await workbook.xlsx.writeBuffer()
    const envelope = await encryptPayload(organizationId, xlsxBuffer, password)
    const envelopeJson = JSON.stringify(envelope)
    const blob = new Blob([envelopeJson], { type: 'application/json' })

    const datePart = requestedAt.slice(0, 10)
    const orgLabel = org?.orgCode ?? organizationId
    const filename = `zaloha-${orgLabel}-${datePart}.json`

    await updateDoc(jobRef, {
      status: 'completed',
      finishedAt: new Date().toISOString(),
      sizeBytes: envelopeJson.length,
    })

    return { blob, filename }
  } catch (err) {
    await updateDoc(jobRef, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'neznámá chyba',
    })
    throw err
  }
}
