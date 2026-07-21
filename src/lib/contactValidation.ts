/**
 * Sdílená normalizace/validace kontaktních údajů — použito všude, kde se
 * zadává e-mail nebo telefon (Externisté, Zájemci, Pěstoun, Zaměstnanci...).
 * Princip: co jde bezpečně opravit samo (mezery, chybějící +420, 00 → +),
 * se opraví potichu; co ne (špatný počet číslic apod.), vrátí přátelskou
 * zprávu k ruční opravě u pole — appka nikdy neuloží nesmyslná data ani
 * netiše nezahodí chybu.
 */
export interface FieldCheck {
  /** Normalizovaná hodnota — použij ji jako novou hodnotu pole, i když ok===false (ať uživatel vidí, co se opravilo). */
  value: string
  ok: boolean
  message?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function checkEmail(raw: string): FieldCheck {
  const value = raw.trim().toLowerCase()
  if (!value) return { value, ok: true }
  if (!EMAIL_RE.test(value)) {
    return { value, ok: false, message: 'Zkontrolujte prosím formát e-mailu (např. jmeno@domena.cz).' }
  }
  return { value, ok: true }
}

/** České telefonní číslo — doplní chybějící +420, sjednotí 00→+, ořeže
 * mezery/pomlčky a zformátuje na "+420 XXX XXX XXX". Cizí čísla se
 * ZAČÁTKEM "+" a jiným počtem číslic nechá být (jen ověří rozumnou délku). */
export function checkPhone(raw: string): FieldCheck {
  const trimmed = raw.trim()
  if (!trimmed) return { value: '', ok: true }

  let digits = trimmed.replace(/[^\d+]/g, '')
  digits = digits.replace(/^00/, '+')
  if (/^420\d{9}$/.test(digits)) digits = `+${digits}`
  if (/^\d{9}$/.test(digits)) digits = `+420${digits}`

  const czMatch = /^\+420(\d{9})$/.exec(digits)
  if (czMatch) {
    const d = czMatch[1]
    return { value: `+420 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`, ok: true }
  }
  if (/^\+\d{8,15}$/.test(digits)) {
    return { value: digits, ok: true }
  }
  return {
    value: trimmed,
    ok: false,
    message: 'Telefonní číslo nevypadá správně — české číslo má 9 číslic (např. 601 234 567), zahraniční začíná "+" a kódem země.',
  }
}
