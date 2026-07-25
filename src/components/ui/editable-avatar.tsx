import { useRef, useState } from 'react'
import type { IconComponent } from '@/components/ui/icons'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { uploadEntityAvatar, uploadUserAvatar } from '@/services/avatarService'
import type { SubjectRefKind } from '@/types/timelineEntry'

/**
 * Avatar v hlavičce profilu, který jde kliknutím změnit — otevře
 * výběr souboru, nahraje ho přes `avatarService.uploadEntityAvatar` (Cloud
 * Storage + `avatarUrl` na dokumentu) a zavolá `onUploaded(url)`. Upload
 * službu jsme měli od M3, ale nikde nebyla ve UI zapojená — tohle je ten
 * chybějící kus.
 */
export function EditableAvatar({
  kind,
  id,
  familyId,
  photoURL,
  label,
  fallbackIcon,
  onUploaded,
  size = 'lg',
}: {
  /** `staff` má fotku na `users/{uid}` v jiné cestě Storage než klientské
   * entity, jinak je chování stejné. */
  kind: SubjectRefKind | 'staff'
  id: string
  familyId?: string
  photoURL?: string | null
  label: string
  fallbackIcon?: IconComponent
  onUploaded: (url: string) => void
  /**
   * `sm` (32 px) je pro stránky, kde je nadpis nesený TYPOGRAFIÍ, ne
   * portrétem. Devadesátišestipixelový kruh vedle jména byl přesně ten
   * „profil jako vizitka", který Petr 2026-07-25 odmítl — fotka rodiny
   * nikomu neřekne, jak se rodině vede.
   */
  size?: 'sm' | 'lg'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const url = kind === 'staff' ? await uploadUserAvatar(id, file) : await uploadEntityAvatar({ kind, id, familyId, file })
      onUploaded(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotku se nepodařilo nahrát.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <EntityAvatar
        size={size}
        photoURL={photoURL}
        label={label}
        fallbackIcon={fallbackIcon}
        onChangePhoto={busy ? undefined : () => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      {busy && <span className="text-xs text-text-tertiary">Nahrávám…</span>}
      {error && <span className="max-w-[140px] text-center text-xs text-danger">{error}</span>}
    </div>
  )
}
