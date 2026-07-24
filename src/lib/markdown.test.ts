import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, markdownToHtml } from './markdown'

/**
 * Testy převodu markdown ⇄ HTML editoru.
 *
 * Klíčový je poslední blok: ROUND-TRIP. Dokument, který uživatel otevře
 * v editoru a zavře bez úpravy, se nesmí uložit jinak — jinak by každé
 * otevření nenápadně měnilo obsah spisu, a to je u dokumentace pěstounské
 * péče nepřijatelné.
 */

describe('markdownToHtml', () => {
  it('převede nadpisy', () => {
    expect(markdownToHtml('# Velký\n## Střední\n### Malý')).toBe(
      '<h1>Velký</h1><h2>Střední</h2><h3>Malý</h3>',
    )
  })

  it('převede tučně, kurzívu a kód', () => {
    expect(markdownToHtml('**tučně** a *kurzíva* a `kód`')).toBe(
      '<p><strong>tučně</strong> a <em>kurzíva</em> a <code>kód</code></p>',
    )
  })

  it('uvnitř kódu neuplatňuje další značky', () => {
    expect(markdownToHtml('`**není tučné**`')).toBe('<p><code>**není tučné**</code></p>')
  })

  it('převede odrážky a číslování', () => {
    expect(markdownToHtml('- jedna\n- dvě')).toBe('<ul><li><p>jedna</p></li><li><p>dvě</p></li></ul>')
    expect(markdownToHtml('1. jedna\n2. dvě')).toBe('<ol><li><p>jedna</p></li><li><p>dvě</p></li></ol>')
  })

  it('převede úkoly včetně zaškrtnutí', () => {
    expect(markdownToHtml('- [ ] nehotovo\n- [x] hotovo')).toBe(
      '<ul data-type="taskList">' +
        '<li data-type="taskItem" data-checked="false"><p>nehotovo</p></li>' +
        '<li data-type="taskItem" data-checked="true"><p>hotovo</p></li>' +
        '</ul>',
    )
  })

  it('spojí víc řádků citace do jednoho bloku', () => {
    expect(markdownToHtml('> první\n> druhý')).toBe('<blockquote><p>první<br>druhý</p></blockquote>')
  })

  it('převede oddělovač a blok kódu', () => {
    expect(markdownToHtml('---')).toBe('<hr>')
    expect(markdownToHtml('```\nkód\n```')).toBe('<pre><code>kód</code></pre>')
  })

  it('spojí zalomený odstavec do jednoho, jak markdown velí', () => {
    // Kdyby byl každý zdrojový řádek vlastní odstavec, měl by zalomený text
    // dvojnásobné mezery a uložení by změnilo obsah.
    expect(markdownToHtml('první řádek\ndruhý řádek\n\njiný odstavec')).toBe(
      '<p>první řádek druhý řádek</p><p>jiný odstavec</p>',
    )
  })

  it('escapuje HTML z textu, aby se nedalo vložit do dokumentu', () => {
    expect(markdownToHtml('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    )
  })

  it('zahodí nebezpečné schéma v odkazu', () => {
    expect(markdownToHtml('[klik](javascript:alert(1))')).toContain('href="#"')
    expect(markdownToHtml('[klik](https://example.com)')).toContain('href="https://example.com"')
  })
})

describe('htmlToMarkdown', () => {
  it('převede nadpisy a odstavce', () => {
    expect(htmlToMarkdown('<h2>Nadpis</h2><p>Text</p>')).toBe('## Nadpis\n\nText')
  })

  it('převede seznamy z formátu, který generuje editor', () => {
    expect(htmlToMarkdown('<ul><li><p>jedna</p></li><li><p>dvě</p></li></ul>')).toBe('- jedna\n- dvě')
    expect(htmlToMarkdown('<ol><li><p>jedna</p></li><li><p>dvě</p></li></ol>')).toBe('1. jedna\n2. dvě')
  })

  it('převede úkoly', () => {
    const html =
      '<ul data-type="taskList">' +
      '<li data-type="taskItem" data-checked="true"><p>hotovo</p></li>' +
      '<li data-type="taskItem" data-checked="false"><p>nehotovo</p></li>' +
      '</ul>'
    expect(htmlToMarkdown(html)).toBe('- [x] hotovo\n- [ ] nehotovo')
  })

  it('převede odkaz a řádkové značky', () => {
    expect(htmlToMarkdown('<p><strong>a</strong> <em>b</em> <a href="https://x.cz">c</a></p>')).toBe(
      '**a** *b* [c](https://x.cz)',
    )
  })

  it('nechá blok kódu na pokoji', () => {
    expect(htmlToMarkdown('<pre><code>a **b** c</code></pre>')).toBe('```\na **b** c\n```')
  })

  it('zahodí značky, kterým nerozumí, ale text nechá', () => {
    expect(htmlToMarkdown('<p>text <span class="x">uvnitř</span></p>')).toBe('text uvnitř')
  })
})

describe('round-trip', () => {
  const documents = [
    '## Zápis z návštěvy\n\nRodina **Novotných**, návštěva proběhla v klidu.',
    '# Hlavní\n\n### Podnadpis\n\n- první\n- druhý\n\n1. krok\n2. krok',
    '- [x] podepsat Dohodu\n- [ ] odeslat na OSPOD',
    '> Adélka se zlepšila v matematice.\n\nDoučování pokračuje.',
    'Text s `kódem` a [odkazem](https://doprovazeni.com).',
    '---\n\nPo oddělovači.',
    '```\nnějaký blok\nna dvou řádcích\n```',
  ]

  it('zalomený odstavec se uloží na jeden řádek (markdown to tak čte)', () => {
    expect(htmlToMarkdown(markdownToHtml('dlouhá věta\npokračuje dál'))).toBe('dlouhá věta pokračuje dál')
  })

  for (const [i, markdown] of documents.entries()) {
    it(`dokument ${i + 1} přežije cestu tam a zpátky`, () => {
      expect(htmlToMarkdown(markdownToHtml(markdown))).toBe(markdown)
    })
  }
})
