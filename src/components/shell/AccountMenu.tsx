import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { Moon, Sun } from '@/components/ui/icons'
import { STAFF_ROLES, STAFF_ROLE_LABELS } from '@/types/user'
import { cn } from '@/lib/utils'

/**
 * Menu účtu — přihlášený uživatel, Nastavení, odhlášení, a (jen na
 * Petrově vlastním účtu, `devRolePreview: true` na users/{uid}) přepínač
 * náhledu role pro rychlé posouzení UI z pohledu superadmina/org_admina/
 * vedení/klíčové osoby atd. beze zakládání dalších účtů. Viz AuthContext
 * pro to, jak náhled funguje (mění jen klient-side `userDoc.role`, nikdy
 * skutečná Firestore oprávnění).
 *
 * Od 2026-07-25 nežije v hlavičce, ale DOLE V POSTRANNÍM PANELU (jako
 * v Routine): `variant="row"` je celý řádek s tváří, jménem a rolí,
 * `align="top"` otevírá menu nahoru, protože pod ním už není místo.
 * Přibylo Nastavení — ozubené kolo zmizelo z hlavičky spolu se zbytkem.
 */
export function AccountMenu({
  variant = 'avatar',
  align = 'bottom',
}: {
  variant?: 'avatar' | 'row'
  align?: 'bottom' | 'top'
} = {}) {
  const { userDoc, firebaseUser, canPreviewRoles, previewRole, setPreviewRole } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = userDoc?.displayName ?? firebaseUser?.email ?? ''
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const roleLabel = userDoc?.role
    ? (STAFF_ROLE_LABELS[userDoc.role as keyof typeof STAFF_ROLE_LABELS] ?? userDoc.role)
    : null

  return (
    <div ref={menuRef} className="relative">
      {variant === 'row' ? (
        <button
          type="button"
          aria-label="Účet"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-overlay-active"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-2xs font-medium text-text-primary">
            {initials || '?'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-text-primary">{displayName}</span>
            {roleLabel && <span className="block truncate text-xs text-text-tertiary">{roleLabel}</span>}
          </span>
        </button>
      ) : (
        <button
          type="button"
          aria-label="Účet"
          aria-expanded={open}
          title={displayName}
          onClick={() => setOpen((v) => !v)}
          className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
        >
          {initials || '?'}
        </button>
      )}

      {open && (
        <div
          className={cn(
            'absolute z-50 w-64 rounded-lg border border-border bg-surface p-2 shadow-overlay',
            align === 'top' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2',
          )}
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-text-primary">{displayName}</p>
            <p className="truncate text-xs text-text-secondary">
              {userDoc?.email ?? firebaseUser?.email}
            </p>
            {userDoc?.role && (
              <p className="mt-0.5 text-xs text-text-tertiary">
                {STAFF_ROLE_LABELS[userDoc.role as keyof typeof STAFF_ROLE_LABELS] ?? userDoc.role}
                {previewRole ? ' · náhled' : ''}
              </p>
            )}
          </div>

          {canPreviewRoles && (
            <>
              <div className="my-1.5 border-t border-border-subtle" />
              <p className="px-2 py-1 text-2xs leading-none text-text-secondary">
                Náhled role (jen pro tebe)
              </p>
              <div className="flex flex-col gap-0.5">
                {STAFF_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setPreviewRole(role)}
                    className={cn(
                      'flex h-8 items-center rounded-sm px-2.5 text-left text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-overlay-active',
                      userDoc?.role === role && 'bg-overlay-active',
                    )}
                  >
                    {STAFF_ROLE_LABELS[role]}
                  </button>
                ))}
                {previewRole && (
                  <button
                    type="button"
                    onClick={() => setPreviewRole(null)}
                    className="flex h-8 items-center rounded-sm px-2.5 text-left text-xs font-medium text-accent transition-colors duration-150 hover:bg-overlay-active"
                  >
                    Zpět na moji roli
                  </button>
                )}
              </div>
            </>
          )}

          <div className="my-1.5 border-t border-border-subtle" />
          {/* Motiv je v menu, ne jako samostatné tlačítko v řádku: přepne se
              jednou za měsíc, ale trvale by bral 32 px šířky panelu — a ta
              chybí jménu, které se pak ořeže na „Hana Procház…". */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-left text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-overlay-active"
          >
            {resolvedTheme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            {resolvedTheme === 'light' ? 'Tmavý režim' : 'Světlý režim'}
          </button>
          <Link
            to="/nastaveni/vzhled"
            onClick={() => setOpen(false)}
            className="flex h-8 w-full items-center rounded-sm px-2.5 text-left text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-overlay-active"
          >
            Nastavení
          </Link>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="flex h-8 w-full items-center rounded-sm px-2.5 text-left text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-overlay-active"
          >
            Odhlásit se
          </button>
        </div>
      )}
    </div>
  )
}
