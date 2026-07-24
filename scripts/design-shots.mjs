/**
 * Screenshoty designového náhledu (`design-preview.html`).
 *
 * Existuje proto, aby design nešel dělat naslepo: spustí náhledový Vite
 * server, projde seznam obrazovek a uloží PNG do `design-shots/`. Žádná
 * síť, žádný Firebase, žádné přihlášení — viz `src/preview/main.tsx`.
 *
 * Spuštění:
 *   npm run design:shots            # vše
 *   SHOT=rodiny npm run design:shots  # jen obrazovky, jejichž jméno obsahuje "rodiny"
 */
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('design-shots')
const FILTER = process.env.SHOT ?? ''

/** `click`/`tab` klikne po načtení na tlačítko s tímhle textem — jinak by
 * se stavy za kliknutím (pravý panel, záložka) nedaly vyfotit. */
const SCREENS = [
  // Designové návrhy (`src/preview/lab/`) — tři vizuální jazyky pro tutéž
  // obrazovku. `lab` obchází router, proto nemají `route`.
  { name: 'routine-dnes', lab: 'rt-dnes' },
  // Editor NENÍ vlastní paleta, kreslí se z tokenů appky — proto `dark: true`,
  // tmavý screenshot tu má smysl.
  { name: 'editor', lab: 'editor', dark: true },
  // Se otevřeným slash menu — panel příkazů se jinak nedá vyfotit.
  { name: 'editor-slash', lab: 'editor', type: '/' },
  { name: 'osa-1-dnes', lab: 'osa-dnes' },
  { name: 'osa-2-rodiny', lab: 'osa-rodiny' },
  { name: 'osa-3-rodina', lab: 'osa-rodina' },
  { name: 'osa-4-kalendar', lab: 'osa-kalendar' },
  { name: 'navrh-a-spis', lab: 'spis' },
  { name: 'navrh-b-tvare', lab: 'faces' },
  { name: 'navrh-c-osa', lab: 'rail' },
  { name: 'dnes', route: '/' },
  { name: 'rodiny', route: '/rodiny' },
  { name: 'rodiny-novy-panel', route: '/rodiny', click: 'Nová rodina' },
  { name: 'rodina-profil', route: '/rodiny/9900010000015' },
  { name: 'rodina-casova-osa', route: '/rodiny/9900010000015', tab: 'Časová osa' },
  { name: 'rodina-ukoly', route: '/rodiny/9900010000015', tab: 'Úkoly' },
  { name: 'rodina-kalendar', route: '/rodiny/9900010000015', tab: 'Kalendář' },
  { name: 'deti', route: '/deti' },
  { name: 'deti-nove', route: '/deti', click: 'Nové dítě' },
  { name: 'pestouni', route: '/pestouni' },
  { name: 'zamestnanci', route: '/zamestnanci' },
  { name: 'zamestnanec-profil', route: '/zamestnanci/u-eva' },
  { name: 'kalendar', route: '/kalendar' },
  { name: 'ukoly', route: '/ukoly' },
  { name: 'zpravy', route: '/zpravy' },
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  // 900 px = notebook na půl obrazovky / tablet na šířku. Appka má tvrdý
  // přepínač mobil/desktop, takže právě tady se pozná, jestli mezi nimi
  // něco funguje, nebo je to díra.
  { name: 'uzky', width: 900, height: 900 },
  { name: 'mobil', width: 390, height: 844 },
]

const server = await createServer({
  configFile: path.resolve('vite.preview.config.ts'),
  server: { port: 5199, strictPort: true },
})
await server.listen()
const base = `http://localhost:5199/design-preview.html`

// Bez filtru se složka vymete celá; s filtrem NE — jinak `SHOT=osa` smaže
// screenshoty, které jsem si nechal na porovnání (a stalo se to).
if (!FILTER) await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

// Prostředí má Chromium předinstalované (`PLAYWRIGHT_BROWSERS_PATH`), ale
// jeho verze nemusí odpovídat té, kterou si balíček `playwright` chce
// stáhnout — a stahovat nemáme. Proto explicitní `executablePath`, když
// existuje; jinak necháme Playwright vybrat po svém (např. na tvém stroji).
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch(
  existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {},
)
const errors = []

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  })
  for (const theme of ['light', 'dark']) {
    // Tmavý režim jen na desktopu — mobilní layout je stejný, jen užší,
    // a čtyři varianty každé obrazovky už jsou spíš šum než informace.
    if (theme === 'dark' && viewport.name !== 'desktop') continue
    for (const screen of SCREENS) {
      if (FILTER && !screen.name.includes(FILTER)) continue
      // Designové návrhy mají VLASTNÍ paletu (`lab/*.css`), ne tokeny appky —
      // tmavý screenshot by byl bajt za bajt stejný jako světlý a tvářil se,
      // že tmavý režim je hotový. Tmavá varianta vzniká až při převodu
      // vybraného směru do tokenů.
      if (screen.lab && !screen.dark && theme === 'dark') continue
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(`${screen.name}/${viewport.name}: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${screen.name}/${viewport.name}: ${m.text()}`)
      })
      const params = new URLSearchParams({ theme })
      if (screen.route) params.set('route', screen.route)
      if (screen.lab) params.set('lab', screen.lab)
      if (screen.click) params.set('click', screen.click)
      if (screen.tab) params.set('tab', screen.tab)
      await page.goto(`${base}?${params}`, { waitUntil: 'networkidle' })
      // Stuby odpovídají okamžitě, ale `AutoInteract` klika po 400 ms a
      // panely mají vjezdovou animaci — 1200 ms je s rezervou po ní.
      await page.waitForTimeout(1200)
      // `type` píše do editoru SKUTEČNÉ klávesy — slash menu reaguje na vstup
      // ProseMirroru, takže nastavit stav zvenčí by ukázalo něco jiného, než
      // co uživatel uvidí.
      if (screen.type) {
        // Klikneme na POSLEDNÍ odstavec a skočíme na jeho konec. `Control+End`
        // ProseMirror nemá navázané, takže by „/" skončilo uprostřed textu.
        await page.click('.rte__content > p:last-of-type')
        await page.keyboard.press('End')
        await page.keyboard.press('Enter')
        await page.keyboard.type(screen.type, { delay: 30 })
        await page.waitForTimeout(400)
      }
      const suffix = theme === 'dark' ? '-dark' : ''
      await page.screenshot({
        path: path.join(OUT, `${viewport.name}-${screen.name}${suffix}.png`),
        fullPage: viewport.name === 'mobil',
      })
      await page.close()
      console.log(`  ${viewport.name}-${screen.name}${suffix}.png`)
    }
  }
  await context.close()
}

await browser.close()
await server.close()

if (errors.length) {
  console.log(`\n${errors.length} chyb v konzoli / na stránce:`)
  for (const e of [...new Set(errors)].slice(0, 30)) console.log(`  ${e}`)
} else {
  console.log('\nŽádné chyby v konzoli.')
}
console.log(`\nHotovo → ${OUT}`)
