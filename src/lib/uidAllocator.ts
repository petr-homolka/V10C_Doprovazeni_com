import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { gs1CheckDigit, isValidUid } from './uid'
import type { EntityType } from '@/types/identity'

/**
 * PŘIDĚLENÍ UID — NÁHODNÉ ČÍSLO, ŽÁDNÁ STRUKTURA.
 *
 * Změna politiky, Petr Homolka 26. 7. večer. Dosud UID vypadalo
 * `TT OOOO SSSSSS C`, kde OOOO byla organizace, která entitu založila.
 * To se ruší: UID je od teď náhodné třináctimístné číslo s kontrolní
 * číslicí GS1 a NIC z něj nejde vyčíst.
 *
 * ─── PROČ JE TO LEPŠÍ ─────────────────────────────────────────────────
 *
 * 1. ODPADÁ OTÁZKA, KDO ČÍSLO VYDÁVÁ. Segment organizace znamenal, že UID
 *    smí vzniknout jen uvnitř organizace. Pěstoun, který se zaregistruje
 *    sám na pestouni.com, ale žádnou organizaci nemá — a dvě soustavy,
 *    které by si vydávaly čísla nezávisle, by se dřív nebo později
 *    potkaly. Náhodné číslo z jedné společné zásoby tenhle problém nemá.
 *
 * 2. ODPADÁ STROP 9 999 ORGANIZACÍ. Byl to jediný segment, který mohl
 *    reálně dojít, a jeho rozšíření by měnilo délku celého UID.
 *
 * 3. NEJDE HÁDAT. Vydaných čísel je proti zásobě mizivý zlomek, takže
 *    zkoušení náhodných čísel nikam nevede. (Ochrana ověřovací karty přes
 *    UID + příjmení zůstává — dvě vrstvy nic nestojí.)
 *
 * ─── CO SE TÍM ZTRÁCÍ ─────────────────────────────────────────────────
 *
 * Z čísla už nepoznáte, jestli patří pěstounovi, dítěti nebo dokumentu.
 * Zkontroloval jsem to: v aplikaci to nečte ANI JEDNO místo, `uidEntityTypeCode`
 * nemá jediného volajícího. Typ se zjistí z `uidRegistry` jedním čtením.
 *
 * ─── PROČ NESTAČÍ „VYLOSOVAT A ZAPSAT" ────────────────────────────────
 *
 * Zásoba je 9·10^11 čísel, což zní jako dost — jenže srážky nepřicházejí
 * lineárně. Při MILIONU vydaných čísel je pravděpodobnost, že se aspoň dvě
 * potkají, kolem 40 % (narozeninový paradox). Dokumentů bude milion dřív,
 * než se kdo naděje.
 *
 * Proto se každé číslo zapisuje do `uidRegistry` TRANSAKCÍ, která selže,
 * pokud už existuje, a losuje se znovu. Při deseti milionech vydaných je
 * šance na opakování 1 : 100 000, takže se druhý pokus prakticky nikdy
 * nekoná — ale když přijde, nic se nestane.
 */

/** Kolik pokusů, než to vzdáme. Druhý pokus je vzácný, třetí astronomicky. */
const MAX_ATTEMPTS = 5

/**
 * Náhodné platné UID. ČISTÁ funkce (kromě generátoru náhody) — dá se
 * otestovat bez databáze.
 *
 * První číslice nesmí být nula, protože UID se občas dostane do prostředí,
 * kde se čísla srovnávají jako čísla (tabulky, exporty) a vedoucí nula by
 * tiše zmizela.
 */
export function randomUid(): string {
  const digits = Array.from({ length: 12 }, (_, i) => {
    const max = i === 0 ? 9 : 10
    const min = i === 0 ? 1 : 0
    return String(min + Math.floor(Math.random() * max))
  }).join('')
  return `${digits}${gs1CheckDigit(digits)}`
}

export interface UidRegistryDoc {
  uid: string
  entityType: EntityType
  issuedAt: unknown
  /** Kdo číslo vydal — organizace, nebo `pestouni.com` u samoregistrace. */
  issuedBy: string
}

export function uidRegistryRef(uid: string) {
  return doc(db, 'uidRegistry', uid)
}

/**
 * Vydá nové UID a zaregistruje ho. Vrací hotové číslo.
 *
 * `issuedBy` je jen stopa, ne součást čísla — na rozdíl od dřívějška
 * neovlivňuje, jak UID vypadá.
 */
export async function allocateUid(entityType: EntityType, issuedBy: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = randomUid()
    const ref = uidRegistryRef(candidate)

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        // Srážka. Transakce se zruší a losuje se znovu — viz hlavička,
        // proč se na to nedá spolehnout, že se to nikdy nestane.
        if (snap.exists()) throw new Error('UID_TAKEN')
        tx.set(ref, {
          uid: candidate,
          entityType,
          issuedAt: serverTimestamp(),
          issuedBy,
        })
      })
      return candidate
    } catch (error) {
      if ((error as Error).message !== 'UID_TAKEN') throw error
    }
  }

  // Pět srážek po sobě není smůla, to je porucha generátoru náhody nebo
  // vyčerpaná zásoba. Tiše to spolknout by znamenalo vydat číslo, které
  // už někdo má.
  throw new Error('Nepodařilo se přidělit UID — pět pokusů skončilo srážkou.')
}

/**
 * Zaregistruje UID, které vydala JINÁ soustava (pestouni.com).
 *
 * Tady se nelosuje — číslo je dané a buď se zapíše, nebo je obsazené.
 * Vrací `false` při srážce, aby si volající mohl vyžádat jiné; házet
 * výjimku by tady bylo přehnané, protože je to očekávaný stav.
 */
export async function registerExternalUid(
  uid: string,
  entityType: EntityType,
  issuedBy: string,
): Promise<boolean> {
  if (!isValidUid(uid)) return false
  const ref = uidRegistryRef(uid)
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      if (snap.exists()) throw new Error('UID_TAKEN')
      tx.set(ref, { uid, entityType, issuedAt: serverTimestamp(), issuedBy })
    })
    return true
  } catch (error) {
    if ((error as Error).message === 'UID_TAKEN') return false
    throw error
  }
}
