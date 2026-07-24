import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Baby, Search, UserCog, UserRound, UsersRound } from '@/components/ui/icons'
import { EntityAvatar } from '@/components/ui/entity-avatar'
import { searchEntities, type SearchResult, type SearchResultKind } from '@/lib/entitySearch'
import { personProfilePath } from '@/components/ui/person-link'
import { listFamiliesWithDocIds, listChildrenForOrg, listFosterPersonsForOrg } from '@/services/familyService'
import { listStaff } from '@/services/staffService'
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

export interface SearchDataset {
  families: Array<{ docId: string; family: FamilyDoc }>
  fosterPersons: Array<{ docId: string; fosterPerson: FosterPersonDoc }>
  children: Array<{ docId: string; child: ChildDoc }>
  staff: UserDoc[]
}

const EMPTY_DATASET: SearchDataset = { families: [], fosterPersons: [], children: [], staff: [] }

/**
 * Hledání entit — pole se při psaní roztáhne na výšku a vypíše výsledky
 * napříč kontaktními údaji VŠECH entit; každý výsledek má vedle sebe ikonu
 * svého druhu (dítě má ikonu dítěte) a je proklikem na profil.
 *
 * Data si buď vezme od volajícího (`data` — kalendář je stejně má načtená,
 * takže hledání nestojí ani jeden dotaz navíc), nebo si je při prvním
 * otevření dotáhne samo (`organizationId` — globální hledání v hlavičce,
 * kde žádná stránka ta data po ruce nemá).
 *
 * Ovládání klávesnicí je součást funkce, ne příplatek: kdo hledá, píše, a
 * nechce sundávat ruku z klávesnice — ↑/↓ vybírá, Enter otevře.
 */
export function EntitySearch({
  data,
  organizationId,
  onNavigated,
  autoFocus = true,
}: {
  data?: SearchDataset
  /** Když není `data`, hledání si je dotáhne samo pro tuhle organizaci. */
  organizationId?: string
  /** Zavolá se po odskoku na profil — volající tím zavře panel/modál. */
  onNavigated?: () => void
  autoFocus?: boolean
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [loaded, setLoaded] = useState<SearchDataset | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const selfLoading = !data && !!organizationId

  useEffect(() => {
    if (!selfLoading || !organizationId) return
    let cancelled = false
    Promise.all([
      listFamiliesWithDocIds(organizationId),
      listFosterPersonsForOrg(organizationId),
      listChildrenForOrg(organizationId),
      listStaff(organizationId),
    ])
      .then(([families, fosterPersons, children, staff]) => {
        if (!cancelled) setLoaded({ families, fosterPersons, children, staff })
      })
      .catch(() => { if (!cancelled) setLoadFailed(true) })
    return () => { cancelled = true }
  }, [selfLoading, organizationId])

  const dataset = data ?? loaded ?? EMPTY_DATASET
  const results = useMemo(() => searchEntities(query, dataset), [query, dataset])

  // Po každé změně dotazu se výběr vrací na první výsledek — jinak by Enter
  // otevřel položku, která už na obrazovce dávno není.
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, results.length])

  function open(result: SearchResult) {
    const href = personProfilePath({ kind: result.kind, id: result.id, familyUid: result.familyUid })
    if (!href) return
    navigate(href)
    onNavigated?.()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const result = results[activeIndex]
      if (result) open(result)
    }
  }

  const trimmed = query.trim()
  const stillLoading = selfLoading && !loaded && !loadFailed

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative shrink-0">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jméno, telefon, e-mail, adresa, rodné číslo…"
          aria-label="Hledat mezi entitami"
          className="w-full rounded-full bg-field py-2.5 pl-9 pr-3 text-text-primary placeholder:text-text-tertiary focus:shadow-focus focus:outline-none"
        />
      </div>

      {loadFailed && (
        <p className="px-1 text-sm text-danger" role="alert">
          Data pro hledání se nepodařilo načíst.
        </p>
      )}

      {/* Dokud se nehledá, nic nezabírá místo; jak se začne psát, seznam
       * výsledků vyplní celou zbývající výšku. */}
      {trimmed.length > 0 && (
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {stillLoading ? (
            <p className="px-1 py-2 text-sm text-text-secondary">Načítám…</p>
          ) : results.length === 0 ? (
            <p className="px-1 py-2 text-sm text-text-secondary">Nic neodpovídá „{trimmed}".</p>
          ) : (
            <div className="flex flex-col gap-1">
              {results.map((result, index) => {
                const Icon = KIND_ICONS[result.kind]
                const linkable =
                  personProfilePath({ kind: result.kind, id: result.id, familyUid: result.familyUid }) !== null
                const active = index === activeIndex
                return (
                  <button
                    key={`${result.kind}-${result.id}`}
                    type="button"
                    disabled={!linkable}
                    data-active={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => open(result)}
                    title={linkable ? undefined : 'Profil nejde otevřít — chybí vazba na rodinu.'}
                    className={`flex items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                      active ? 'bg-overlay-active' : ''
                    }`}
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
