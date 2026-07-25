import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * BLOK PROFILU — jedna „vnořená databáze" na dlouhé stránce (Notion).
 *
 * Nadpis je malý a tichý, vedle něj počet a vpravo ovládání toho bloku
 * (přepínač pohledu, „Zobrazení", odkaz jinam). Nadpis bloku nemá soutěžit
 * s obsahem: na stránce je jich šest a když každý křičí, nekřičí žádný.
 *
 * `lazy` je tu z jednoho konkrétního důvodu: dokud byl profil na záložky,
 * kalendář, úkoly a chat se načítaly teprve při kliknutí na svou záložku.
 * Jedna dlouhá stránka by je připojila všechny hned a otevření rodiny by
 * platilo tři dotazy, které nikdo nechtěl. Blok se proto připojí AŽ KDYŽ SE
 * PŘIBLÍŽÍ K OBRAZOVCE (a pak už zůstane). Dokud se nepřipojí, drží místo
 * nadpisem, takže osnova nelže o délce stránky.
 */
export function SpisBlock({
  id,
  title,
  count,
  actions,
  lazy,
  bare,
  children,
}: {
  id: string
  title: string
  count?: number
  /** Ovládání tohoto bloku — vpravo v jeho nadpisu. */
  actions?: ReactNode
  /** Připojit obsah až když se blok blíží k obrazovce. */
  lazy?: boolean
  /**
   * Nekreslit vlastní nadpis — jen kotvu pro osnovu. Pro bloky, jejichž
   * obsah si nadpis nese sám (chat, respit): jinak stojí na stránce dvakrát
   * po sobě „Chat s pěstounem", což vypadá jako chyba, protože to chyba je.
   */
  bare?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(!lazy)

  useEffect(() => {
    if (shown || !ref.current) return
    const el = ref.current
    // 600 px předstih: obsah je připojený, než na něj člověk dojede, takže
    // nevidí skákání — ale při otevření stránky se nenačte.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [shown])

  return (
    <section ref={ref} className="sp__block">
      {bare ? (
        <span id={id} aria-label={title} />
      ) : (
        <div className="sp__blockhead" id={id}>
          <h2 className="text-base font-medium text-text-primary">{title}</h2>
          {count !== undefined && <span className="text-sm text-text-faint">{count}</span>}
          {actions && <div className="ml-auto flex items-center gap-3">{actions}</div>}
        </div>
      )}
      {shown ? children : <p className="pt-4 text-sm text-text-faint">Načítá se…</p>}
    </section>
  )
}

/** Popisek skupiny uvnitř bloku („Pěstouni 2"). Dělí obsah časem nebo rolí,
 * ne rámem — proto je to jen text, ne hlavička tabulky. */
export function SpisGroupLabel({ label, count }: { label: string; count?: number }) {
  return (
    <p className="pb-1 pt-4 text-xs text-text-faint">
      {label}
      {count !== undefined && <span className="ml-1.5">{count}</span>}
    </p>
  )
}
