import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// App Check pro AI Logic ŽIJE na VLASTNÍ, sekundární `FirebaseApp` instanci
// (`lib/ai.ts`), NIKDY tady na primární — živě odhaleno 2026-07-21 (M10):
// jakmile `initializeAppCheck` běží na sdílené primární instanci, Firebase
// Auth/Firestore SDK na TÉTO instanci si od něj taky začnou žádat App
// Check token ke KAŽDÉMU požadavku (i bez server-side enforcementu), a
// když reCAPTCHA skript nejde načíst (blokovaná/pomalá síť), přihlášení
// (`signInWithEmailAndPassword`) viselo/padalo — stejný "sdílená instance
// nakazí i ostatní SDK" princip jako `secondaryAuth.ts` (tam Auth, tady
// App Check). Izolace na druhou app = primární Auth/Firestore/Storage se
// App Checku vůbec nedotknou, ať síť ke Google recaptcha dělá cokoli.

// Lokální vývoj proti Firestore/Auth emulátoru (firebase.json), nikdy proti
// produkci omylem — zapíná se explicitně přes .env.local, ne automaticky
// podle DEV/PROD módu.
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}
