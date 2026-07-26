/**
 * OSTRÁ vs. TESTOVACÍ data — jedno pole, které rozhoduje o tom, jestli se
 * na záznam vztahují archivační a retenční pravidla.
 *
 * PROČ to musí být v databázi a ne jen „v hlavě":
 * Retenční politika říká, že dokumentace o dítěti v náhradní rodinné péči
 * se drží nejméně 30 let. To je pravidlo pro OSTRÝ PROVOZ. Testovací data
 * se naopak smějí kdykoli smazat a nesmějí spouštět žádné lhůty ani výzvy
 * vedení. Bez značky v datech se to po pár letech nepozná — a ten, kdo to
 * bude řešit, bude hádat.
 *
 * PROČ `live` JAKO VÝCHOZÍ:
 * Chybějící pole se čte jako `'live'` (viz `dataClassOf`). Je to bezpečná
 * strana: neoznačený záznam se chová jako ostrý, tedy CHRÁNĚNÝ. Kdyby se
 * chybějící pole četlo jako `'test'`, znamenala by jedna zapomenutá
 * migrace ztrátu ochrany u skutečných spisů.
 *
 * PROČ NE JEN PODLE ORGANIZACE:
 * „demo-org je testovací" by fungovalo dneska, ale ne až si skutečná
 * organizace naklikala vlastní zkušební rodinu, aby si appku vyzkoušela.
 * Značka patří k záznamu, ne k organizaci.
 */
export type DataClass = 'live' | 'test'

/** Pole, které nese značku. Stejné jméno napříč všemi kolekcemi. */
export const DATA_CLASS_FIELD = 'dataClass' as const

export interface DataClassed {
  /** Chybí-li, jde o ostrá data (viz `dataClassOf`). */
  dataClass?: DataClass
}

/** Bezpečné čtení: co není označené jako testovací, je ostré. */
export function dataClassOf(doc: DataClassed | null | undefined): DataClass {
  return doc?.dataClass === 'test' ? 'test' : 'live'
}

export function isTestData(doc: DataClassed | null | undefined): boolean {
  return dataClassOf(doc) === 'test'
}

export const DATA_CLASS_LABELS: Record<DataClass, string> = {
  live: 'Ostrá data',
  test: 'Testovací data',
}
