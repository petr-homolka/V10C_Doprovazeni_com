/**
 * Společný přístup k Firestore REST API pro administrativní skripty
 * (seed/backfill). Obchází firestore.rules stejně jako `firebase
 * firestore:delete` — vhodné JEN pro tenhle druh správy, nikdy pro zápisy
 * appky samotné.
 *
 * DVĚ cesty k tokenu, ať jeden skript funguje všude (2026-07-24 — dřív
 * existovaly dvě rozešlé kopie seedu, jedna na `gcloud`, druhá na
 * service accountu, a produkci naplnila ta druhá; tohle tu dvojkolejnost
 * ruší):
 *   1. `GOOGLE_APPLICATION_CREDENTIALS` = cesta k service-account JSONu
 *      (CI, kontejner, prostředí bez gcloud),
 *   2. jinak `gcloud auth print-access-token` (běžný lokální případ).
 */
import { execSync } from 'node:child_process'

export const PROJECT_ID = process.env.SEED_PROJECT_ID ?? 'v10c-doprovazeni-com'

export async function getAccessToken() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (keyPath) {
    /*
      JWT.authorize(), NE GoogleAuth.getAccessToken().
      `GoogleAuth` u service accountu vydá „self-signed JWT" — Firestore ho
      u ČTENÍ (`runQuery`) vezme, ale u ZÁPISU (`Commit`) ho odmítne s
      „ACCESS_TOKEN_TYPE_UNSUPPORTED / Expected OAuth 2 access token"
      (naraženo 2026-07-25 při seedu produkce; čtení přitom fungovalo, takže
      to vypadalo jako problém oprávnění, a nebyl). `authorize()` provede
      skutečnou výměnu za OAuth access token, který bere obojí.
    */
    const { readFile } = await import('node:fs/promises')
    const { JWT } = await import('google-auth-library')
    const key = JSON.parse(await readFile(keyPath, 'utf8'))
    const jwt = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/datastore'],
    })
    const { access_token: token } = await jwt.authorize()
    if (!token) throw new Error('Service account nevydal access token.')
    return token
  }
  try {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim()
  } catch {
    throw new Error(
      'Nepodařilo se získat access token. Buď se přihlas přes `gcloud auth login`, ' +
        'nebo nastav GOOGLE_APPLICATION_CREDENTIALS na service-account JSON.',
    )
  }
}

const BASE = () => `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

export async function firestoreCommit(token, writes) {
  const res = await fetch(`${BASE()}:commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-goog-user-project': PROJECT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Firestore commit selhal: ${JSON.stringify(body)}`)
  return body
}

/** `structuredQuery` proti kořeni databáze; vrací pole řádků (i prázdných). */
export async function runQuery(token, structuredQuery) {
  const res = await fetch(`${BASE()}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-goog-user-project': PROJECT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Firestore runQuery selhal: ${JSON.stringify(body)}`)
  return Array.isArray(body) ? body.filter((r) => r.document) : []
}
