/**
 * Google Kalendář sync (nový milestone, 2026-07-21) — VÝHRADNĚ klientský
 * tok (Google Identity Services, "token client"), ŽÁDNÁ Cloud Function
 * (§10 "žádný vlastní backend"). Google Client ID je veřejná hodnota
 * (bezpečná v repu, na rozdíl od API klíčů/secretů — Google OAuth Client
 * ID je navržené k tomu, aby bylo vidět v klientském JS).
 *
 * VĚDOMÉ ROZHODNUTÍ proti ukládání access/refresh tokenu do Firestore:
 * GIS token client dává jen KRÁTKODOBÝ access token (~1h), NE refresh
 * token (ten vydává jen Authorization Code flow s client secretem — to by
 * vyžadovalo server/Cloud Function na výměnu, přesně to, čemu se appka
 * vyhýbá). Token proto žije JEN v paměti modulu (`cachedToken`), nikdy na
 * disku/Firestore — po zavření karty zmizí, další synchronizace si
 * vyžádá nový (tiše, bez popupu, pokud uživatel souhlas už jednou dal a
 * má aktivní Google session — `prompt: ''`). Nulová rules/security
 * expozice navíc, žádné "kdo smí přečíst cizí token" riziko.
 *
 * Sync je VÝHRADNĚ push, jen `calendarEvents` (ne agreement připomínky) a
 * jen VLASTNÍ (`assignedToUid === currentUid`) — appka nikdy nepíše do
 * cizího Google Kalendáře. Mazání/"zrušeno" se na Google stranu zatím
 * nepropaguje (SEAM, viz `CalendarPage.tsx` komentář) — smazání události
 * z Google Kalendáře ručně nic v appce nerozbije, `googleEventId` prostě
 * zůstane ukazovat na už neexistující položku a další sync ji znovu založí.
 */

const GOOGLE_CLIENT_ID = '100588401887-at6stva6dcvafknr8rqiksc4f5ifqpd4.apps.googleusercontent.com'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const GIS_SCRIPT_ID = 'google-identity-services'

interface TokenResponse {
  access_token: string
  expires_in: number
  error?: string
}

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (resp: TokenResponse) => void
          }) => TokenClient
        }
      }
    }
  }
}

let gisScriptPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (gisScriptPromise) return gisScriptPromise
  gisScriptPromise = new Promise((resolve, reject) => {
    if (document.getElementById(GIS_SCRIPT_ID)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.id = GIS_SCRIPT_ID
    script.src = GIS_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Nepodařilo se načíst přihlašovací skript Google.'))
    document.head.appendChild(script)
  })
  return gisScriptPromise
}

let cachedToken: { token: string; expiresAt: number } | null = null

/** Vrátí platný access token — z paměti, pokud ještě neexpiroval (s
 * minutovou rezervou), jinak vyžádá nový (tiše, pokud souhlas už byl
 * jednou dán touhle kartou, jinak Google popup). */
export async function getGoogleCalendarAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }
  await loadGisScript()
  if (!window.google) throw new Error('Google přihlašovací skript se nepodařilo inicializovat.')

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: CALENDAR_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error('Přihlášení ke Google Kalendáři se nezdařilo nebo bylo zrušeno.'))
          return
        }
        cachedToken = { token: resp.access_token, expiresAt: Date.now() + resp.expires_in * 1000 }
        resolve(resp.access_token)
      },
    })
    client.requestAccessToken({ prompt: cachedToken ? '' : 'consent' })
  })
}

export interface GoogleCalendarEventPayload {
  summary: string
  description?: string | null
  start: string
  end: string
}

async function callCalendarEventsApi(
  accessToken: string,
  method: 'POST' | 'PATCH',
  payload: GoogleCalendarEventPayload,
  existingGoogleEventId?: string | null,
): Promise<{ id: string }> {
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
  const url = existingGoogleEventId ? `${base}/${existingGoogleEventId}` : base
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: payload.summary,
      description: payload.description ?? undefined,
      start: { dateTime: payload.start },
      end: { dateTime: payload.end },
    }),
  })
  if (!res.ok) {
    throw new Error(`Google Kalendář API vrátilo chybu (${res.status}).`)
  }
  return res.json()
}

/** Založí novou událost v Google Kalendáři (`existingGoogleEventId` chybí),
 * nebo aktualizuje už dřív synchronizovanou (`existingGoogleEventId`
 * vyplněné) — vrací Google event ID pro uložení zpět na `CalendarEventDoc`. */
export async function upsertGoogleCalendarEvent(
  accessToken: string,
  existingGoogleEventId: string | null | undefined,
  payload: GoogleCalendarEventPayload,
): Promise<string> {
  const result = await callCalendarEventsApi(
    accessToken,
    existingGoogleEventId ? 'PATCH' : 'POST',
    payload,
    existingGoogleEventId,
  )
  return result.id
}
