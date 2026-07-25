import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Clock } from '@/components/ui/icons'

/**
 * SEKCE PROFILU — vlevo název a jedna vysvětlující věta, vpravo bílá karta
 * s obsahem, celé na šedé straně.
 *
 * Sazba je z referenční stránky, kterou poslal Petr 2026-07-25 (výpis
 * o autě — a je to opravdu profil jako u nás). Předchozí verze měla všechno
 * na jedné bílé ploše pod sebou a Petr o ní napsal, že je nepřehledná.
 * Právem: nadpis sekce byl ze stejné plochy, stejné barvy a jen o dva pixely
 * větší než obsah, takže se v něm ztrácel.
 *
 * Co to řeší:
 *   1. Levý okraj se skenuje SVISLE — „kde jsou Lhůty" najde oko bez čtení.
 *   2. Karta má hranu, takže je vidět, kde sekce začíná a končí.
 *   3. Věta pod názvem odpovídá na „co v tom mám hledat", což u spisu není
 *      samozřejmé (co přesně je „respit"? co „lhůty"?).
 *   4. Vypadl tím navigační sloupec — název v okraji dělá jeho práci.
 *
 * `lazy`: obsah se připojí až když se sekce přiblíží k obrazovce (a pak už
 * zůstane). Dokud byl profil na záložky, kalendář/úkoly/chat se načítaly
 * teprve po kliknutí na svou záložku; jedna dlouhá stránka by je připojila
 * všechny hned a otevření rodiny by platilo tři dotazy, které nikdo nechtěl.
 */
export function SpisSection({
  id,
  title,
  description,
  count,
  actions,
  lazy,
  padded,
  children,
}: {
  id: string
  title: string
  /** Jedna věta „co v tom je". Vlevo pod názvem, tichá. */
  description?: string
  count?: number
  /** Ovládání sekce — v kartě vpravo nahoře. */
  actions?: ReactNode
  lazy?: boolean
  /** Obsah není seznam řádků, takže karta potřebuje odsazení dokola. */
  padded?: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(!lazy)

  useEffect(() => {
    if (shown || !ref.current) return
    const el = ref.current
    // 600 px předstih: obsah je připojený, než na něj člověk dojede.
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
    <section ref={ref} id={id} className="sp__sec">
      <div className="sp__seclabel">
        <h2 className="flex items-center gap-2 text-base font-medium text-text-primary">
          {title}
          {count !== undefined && <span className="text-sm text-text-faint">{count}</span>}
        </h2>
        {description && <p className="mt-1 text-sm text-text-tertiary">{description}</p>}
      </div>

      <div className={`sp__card${padded ? ' sp__card--pad' : ''}`}>
        {actions && <div className="flex items-center justify-end gap-3 pt-3">{actions}</div>}
        {shown ? children : <p className="py-6 text-sm text-text-faint">Načítá se…</p>}
      </div>
    </section>
  )
}

/**
 * KONTROLNÍ BOD v souhrnném pásu pod jménem.
 *
 * Z reference: řada bodů, každý s ikonou, popiskem a hodnotou, hned pod
 * nadpisem. Je to nejcennější prvek té stránky — odpovídá na „je něco
 * v nepořádku?" bez rolování. U spisu rodiny je ta otázka ještě důležitější
 * než u auta, protože z ní plyne zákonná lhůta.
 *
 * Barva je JEN v ikoně a jen když něco není v pořádku. Zelená fajfka
 * u splněného, jinak by pás vypadal jako vánoční stromek a ztratil smysl.
 */
export function SpisCheck({
  tone,
  label,
  value,
}: {
  tone: 'ok' | 'blizko' | 'po'
  label: string
  value: ReactNode
}) {
  const Icon = tone === 'po' ? AlertTriangle : tone === 'blizko' ? Clock : Check
  const color = tone === 'po' ? 'text-accent' : tone === 'blizko' ? 'text-text-secondary' : 'text-success'
  return (
    <div className="sp__check">
      <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-sm text-text-tertiary">{label}</p>
        <p className={`truncate text-base ${tone === 'po' ? 'text-accent' : 'text-text-primary'}`}>{value}</p>
      </div>
    </div>
  )
}
