import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Baby, Search, UserCog, UserRound, UsersRound } from 'lucide-react'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { searchEntities, type SearchResult, type SearchResultKind } from '@/lib/entitySearch'
import { personProfilePath } from '@/components/ui/person-link'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { UserDoc } from '@/types/user'

const KIND_ICONS: Record<SearchResultKind, typeof Baby> = {
  family: UsersRound,
  fosterPerson: UserRound,
  child: Baby,
  staff: UserCog,
}

const KIND_LABELS: Record<SearchResultKind, string> = {
  family: 'Rodina',
  fosterPerson: 'Pěstoun',
  child: 'Dítě',
  staff: 'Zaměstnanec',
}

/**
 * Hledání entit pod lupou v kalendáři (Petrovo zadání 2026-07-24): pole se
 * při psaní roztáhne na výšku a vypíše výsledky napříč kontaktními údaji
 * VŠECH entit; každý výsledek má vedle sebe ikonu svého druhu (dítě má
 * ikonu dítěte) a je proklikem na profil.
 *
 * Hledá se v datech, která volající stránka už má načtená — kalendář je
 * potřebuje pro filtry i avatary, takže hledání nestojí ani jeden dotaz
 * navíc a odpovídá okamžitě při psaní.
 */
export function EntitySearch({
  families,
  fosterPersons,
  children,
  staff,
  onNavigated,
  autoFocus = true,
}: {
  families: Array<{ docId: string; family: FamilyDoc }>
  fosterPersons: Array<{ docId: string; fosterPerson: FosterPersonDoc }>
  children: Array<{ docId: string; child: ChildDoc }>
  staff: UserDoc[]
  /** Zavolá se po odskoku na profil — volající tím zavře panel/sheet. */
  onNavigated?: () => void
  autoFocus?: boolean
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const results = useMemo(
    () => searchEntities(query, { families, fosterPersons, children, staff }),
    [query, families, fosterPersons, children, staff],
  )

  function open(result: SearchResult) {
    const href = personProfilePath({ kind: result.kind, id: result.id, familyUid: result.familyUid })
    if (!href) return
    navigate(href)
    onNavigated?.()
  }

  const trimmed = query.trim()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative shrink-0">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jméno, telefon, e-mail, adresa, rodné číslo…"
          aria-label="Hledat mezi entitami"
          className="w-full rounded-full bg-field py-2.5 pl-9 pr-3 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:shadow-focus"
        />
      </div>

      {/* Dokud se nehledá, panel nic nezabírá; jak se začne psát, seznam
       * výsledků vyplní celou zbývající výšku (roztažení "na výšku" ze
       * zadání). */}
      {trimmed.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-1 py-2 text-sm text-text-secondary">Nic neodpovídá „{trimmed}".</p>
          ) : (
            <div className="flex flex-col gap-1">
              {results.map((result) => {
                const Icon = KIND_ICONS[result.kind]
                const linkable = personProfilePath({ kind: result.kind, id: result.id, familyUid: result.familyUid }) !== null
                return (
                  <button
                    key={`${result.kind}-${result.id}`}
                    type="button"
                    disabled={!linkable}
                    onClick={() => open(result)}
                    title={linkable ? undefined : 'Profil nejde otevřít — chybí vazba na rodinu.'}
                    className="flex items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-150 hover:bg-overlay-active disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <EntityAvatar photoURL={result.avatarUrl} label={result.name} fallbackIcon={Icon} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <Icon size={13} className="shrink-0 text-text-tertiary" />
                        <span className="truncate text-sm font-medium text-text-primary">{result.name}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-text-secondary">
                        {KIND_LABELS[result.kind]}
                        {result.detail && ` · ${result.detail}`}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
