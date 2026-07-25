import { useEffect, useState, type RefObject } from 'react'

/**
 * OSNOVA STRÁNKY — to, co v profilu nahradilo řadu záložek.
 *
 * Záložky rozřezaly rodinu na šest obrazovek, mezi kterými se člověk
 * proklikával, aby si dal dohromady, jak se rodině vede. Profil je teď JEDNA
 * dlouhá stránka a orientaci v ní drží tenhle sloupec vlevo: ví, kde člověk
 * právě je, a jedním kliknutím doskočí jinam. Stejně to řeší Notion (osnova
 * stránky) i Routine.
 *
 * Aktivní položka se pozná DÉLKOU ČÁRKY a barvou textu, ne plochou —
 * navigace, která je vidět celou dobu, musí být nejtišší prvek na stránce.
 *
 * Kde člověk je, se čte z ROLOVÁNÍ, ne z kliknutí: kdo sjede kolečkem, taky
 * čeká, že se osnova posune. Proto se sleduje `scrollRef`, ne stav tlačítek.
 */
export interface OutlineSection {
  id: string
  label: string
}

export function PageOutline({
  sections,
  scrollRef,
}: {
  sections: readonly OutlineSection[]
  scrollRef: RefObject<HTMLElement | null>
}) {
  const [active, setActive] = useState(sections[0]?.id ?? '')

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() {
      // 120 px pod horní hranou: sekce se stává „aktivní" chvíli PŘED tím,
      // než se dotkne stropu, jinak by se přepínala až když je nadpis pryč.
      const line = el!.scrollTop + 120
      let current = sections[0]?.id ?? ''
      for (const { id } of sections) {
        const node = document.getElementById(id)
        if (node && node.offsetTop <= line) current = id
      }
      setActive(current)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, sections])

  return (
    <nav className="sp__rail" aria-label="Osnova stránky">
      {sections.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className={`sp__raillink${active === id ? ' sp__raillink--active' : ''}`}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
