import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { app } from './firebase'

/**
 * M10 SEAM uzavřený — Firebase AI Logic, Gemini Developer API backend
 * (`GoogleAIBackend`), klientský SDK zabezpečený App Check (`firebase.ts`)
 * — žádná Cloud Function, žádný vlastní backend (§10). `gemini-2.5-flash`
 * — rychlý/levný model, dostačující pro "učesat krátký hlasový přepis",
 * ne komplexní generování.
 */
const ai = getAI(app, { backend: new GoogleAIBackend() })
const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' })

const SUMMARY_PROMPT = `Jsi asistent pro pracovníky doprovázející pěstounské rodiny (sociální práce, ČR). Dostaneš doslovný hlasový přepis poznámky z terénu, často s výplňovými slovy, opakováním a neuspořádanou mluvenou řečí.

Uprav ho do stručného, profesionálního textu v gramaticky správné češtině — zachovej VŠECHNA fakta, jména a čísla beze změny, jen vyčisti formu (odstraň výplňová slova a opakování, dej dohromady souvislé věty). Nic nevymýšlej ani nedoplňuj, co v přepisu není. Vrať POUZE upravený text, bez úvodu, nadpisu nebo komentáře.

Přepis:
`

/** `VoiceRecorderPanel.tsx` "AI souhrn" — vstup je surový přepis
 * (`recognizer.transcript`/ruční úprava v textarea), výstup nahradí `body`
 * a surový vstup se uloží do `originalTranscript` (§7.5, nikdy nemazané). */
export async function summarizeVoiceEntry(rawTranscript: string): Promise<string> {
  const result = await model.generateContent(SUMMARY_PROMPT + rawTranscript)
  return result.response.text().trim()
}
