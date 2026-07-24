import { useState } from 'react'
import { RichTextEditor } from '@/components/ui/rich-text-editor'

const SAMPLE = `# Zápis z návštěvy — rodina Novotných

Návštěva 22. 7. 2026, přítomni oba pěstouni a **Adélka**. Dominik byl u kamaráda.

## Průběh

Návštěva proběhla v klidné atmosféře. Adélka ukazovala vysvědčení, zlepšila se
v matematice o stupeň. Domluvili jsme doučování na čtvrtky.

> Adélka: „Už to konečně chápu, jen mi to trvá dýl než ostatním."

### Domluvené kroky

- [x] Podepsat aktualizaci Dohody
- [ ] Zajistit doučování matematiky — do 30. 7.
- [ ] Ověřit platnost lékařské zprávy Dominika

## Poznámky

1. Paní Novotná se ptala na respitní pobyt v srpnu.
2. Škola hlásí konflikt Dominika se spolužákem — řeší třídní učitelka.
3. Odkaz na kurz: [Doprovázení pěstounů](https://doprovazeni.com)

---

Další návštěva plánovaná na 20. 9. 2026.`

/**
 * Editor v náhledu. `DocumentDetailPage` potřebuje parametr v URL a načtený
 * dokument, což by pro posouzení TYPOGRAFIE bylo zbytečné zapojování —
 * tady jde o to vidět nadpisy, citaci, úkoly, odkaz a osnovu na jednom
 * vzorovém zápisu.
 */
export function LabEditor() {
  const [value, setValue] = useState(SAMPLE)
  return (
    <div style={{ minHeight: 900, background: 'var(--bg-void)', padding: '28px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <h1 className="text-xl font-medium text-text-primary">Zápis</h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Rodina Novotných · 22. 7. 2026 · sdíleno s oběma pěstouny
        </p>
        <div className="mt-4">
          <RichTextEditor value={value} onChange={setValue} minHeight={620} />
        </div>
      </div>
    </div>
  )
}
