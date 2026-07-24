import { OsaShell } from './OsaShell'
import { families, fosterPersons, children, timelineEntries, agreementsByFamilyId, staff } from '../../fixtures'
import { initials } from '../labData'

const TABS = ['Přehled', 'Časová osa', 'Kalendář', 'Úkoly', 'Dokumenty', 'Chat']

/**
 * Profil rodiny ve směru „Osa" — odpověď na otázku „jak to bude vypadat na
 * dalších stránkách".
 *
 * Tři rozhodnutí, která opravují dnešní stav:
 *   1. JEDNA šířka obsahu, dva sloupce (obsah + pravý pruh na to, co se jen
 *      čte). Dnes jsou pod sebou tři různé šířky.
 *   2. Vlastnosti Dohody jsou řádky „popisek — hodnota", ne karta. Nastavení
 *      a záznam o člověku dnes vypadají identicky, což mate.
 *   3. Nadpis sekce se odlišuje malými kapitálkami a tercierní barvou, ne
 *      velikostí — takže nesoutěží se jménem v řádku pod ním. Dnes je nadpis
 *      sekce slabší než obsah, tedy hierarchie naruby.
 */
export function OsaFamily() {
  const { family } = families[0]
  const agreement = agreementsByFamilyId.f1
  const fosters = fosterPersons.filter((f) => f.fosterPerson.familyId === 'f1')
  const kids = children.filter((c) => c.child.familyId === 'f1')
  const keyWorker = staff.find((s) => s.uid === agreement?.assignedTo)

  return (
    <OsaShell
      active="Rodiny"
      crumb={
        <>
          Rodiny / <b>{family.displayName}</b>
        </>
      }
      actions={
        <>
          <button type="button" className="osa__btn">
            Nadiktovat zápis
          </button>
          <button type="button" className="osa__btn osa__btn--primary">
            Zapsat návštěvu
          </button>
        </>
      }
    >
      <div className="osa__phead">
        {family.avatarUrl ? (
          <img className="osa__pface" src={family.avatarUrl} alt="" />
        ) : (
          <span className="osa__pface" />
        )}
        <div style={{ minWidth: 0 }}>
          <h1 className="osa__ptitle">{family.displayName}</h1>
          <p className="osa__sub" style={{ fontSize: 12.5 }}>
            {family.address} · spis {family.uid}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          {/* Stav rodiny patří do hlavičky profilu, ne až někam do sekce —
              je to první věc, kterou chce člověk vědět. */}
          <span className="osa__chip osa__chip--warm">Návštěva za 2 dny</span>
          <p className="osa__sub" style={{ marginTop: 4 }}>
            Poslední 27. 5. 2026
          </p>
        </div>
      </div>

      <nav className="osa__tabs">
        {TABS.map((tab) => (
          <span key={tab} className={`osa__tab${tab === 'Přehled' ? ' osa__tab--active' : ''}`}>
            {tab}
          </span>
        ))}
      </nav>

      <div className="osa__profile">
        <div>
          <h2 className="osa__section">Pěstouni</h2>
          {fosters.map(({ docId, fosterPerson: f }) => (
            <div key={docId} className="osa__prow">
              {f.avatarUrl ? (
                <img className="osa__face" src={f.avatarUrl} alt="" />
              ) : (
                <span className="osa__face">{initials(`${f.firstName} ${f.lastName}`)}</span>
              )}
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="osa__name" style={{ display: 'block' }}>
                  {f.firstName} {f.lastName}
                </span>
                <span className="osa__sub">{f.email ?? 'bez e-mailu'}</span>
              </span>
              <span className="osa__cell">{f.phone ?? '—'}</span>
              <span className="osa__more">⋯</span>
            </div>
          ))}

          <h2 className="osa__section">
            Svěřené děti
            <span className="osa__chip">+ Přidat</span>
          </h2>
          {kids.map(({ docId, child: c }) => (
            <div key={docId} className="osa__prow">
              {c.avatarUrl ? (
                <img className="osa__face" src={c.avatarUrl} alt="" />
              ) : (
                <span className="osa__face">{initials(`${c.firstName} ${c.lastName}`)}</span>
              )}
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="osa__name" style={{ display: 'block' }}>
                  {c.firstName} {c.lastName}
                </span>
                <span className="osa__sub">{c.birthNumber}</span>
              </span>
              <span className="osa__cell">14 let</span>
              <span className="osa__more">⋯</span>
            </div>
          ))}

          <h2 className="osa__section">Dohoda</h2>
          <div className="osa__kv">
            <span className="osa__kvlabel">Typ péče</span>
            <span>Zprostředkovaná · 24 h vzdělávání / 12 měsíců</span>
          </div>
          <div className="osa__kv">
            <span className="osa__kvlabel">Klíčová osoba</span>
            <span>{keyWorker?.displayName}</span>
          </div>
          <div className="osa__kv">
            <span className="osa__kvlabel">Interval návštěv</span>
            <span>60 dní</span>
          </div>
          <div className="osa__kv">
            <span className="osa__kvlabel">Platí od</span>
            <span>27. 9. 2025</span>
          </div>
          <div className="osa__kv">
            <span className="osa__kvlabel">Sdílení zápisů</span>
            <span>Oběma pěstounům</span>
          </div>
        </div>

        {/* Pravý pruh = co se jen čte. Práce se dělá vlevo. */}
        <aside style={{ display: 'grid', gap: 14 }}>
          <div className="osa__panel">
            <div className="osa__panelhead">Nejbližší v kalendáři</div>
            <div className="osa__panelbody" style={{ paddingTop: 4, paddingBottom: 4 }}>
              <div className="osa__tl">
                <span className="osa__tldate">26. 7.</span>
                <span className="osa__tlbody">
                  <b>Případová konference</b> — OSPOD Brno-střed, 9:00
                </span>
              </div>
              <div className="osa__tl">
                <span className="osa__tldate">24. 7.</span>
                <span className="osa__tlbody">
                  <b>Návštěva v rodině</b> — 10:00, Eva Dvořáková
                </span>
              </div>
            </div>
          </div>

          <div className="osa__panel">
            <div className="osa__panelhead">Otevřené úkoly · 2</div>
            <div className="osa__panelbody" style={{ paddingTop: 4, paddingBottom: 4 }}>
              <div className="osa__tl">
                <span className="osa__tldate" style={{ color: 'var(--accent)' }}>
                  +3 dní
                </span>
                <span className="osa__tlbody">
                  <b>Zpráva pro OSPOD za 2. kvartál</b>
                </span>
              </div>
              <div className="osa__tl">
                <span className="osa__tldate">30. 7.</span>
                <span className="osa__tlbody">
                  <b>Zajistit doučování matematiky</b> — Adélka
                </span>
              </div>
            </div>
          </div>

          <div className="osa__panel">
            <div className="osa__panelhead">Poslední zápisy</div>
            <div className="osa__panelbody" style={{ paddingTop: 4, paddingBottom: 4 }}>
              {timelineEntries.slice(0, 3).map(({ docId, entry }) => (
                <div key={docId} className="osa__tl">
                  <span className="osa__tldate">
                    {new Date(entry.occurredAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
                  </span>
                  <span className="osa__tlbody">{entry.body}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </OsaShell>
  )
}
