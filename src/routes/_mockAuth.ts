/**
 * Sdílený mock AuthContext pro CELOU appku, dokud M1 nepřinese reálné
 * přihlášení. Firestore/Auth emulátor na tomhle stroji nejde spustit
 * (viz CURRENT_STATE.md), takže RequireAuth nemá jak ověřit skutečného
 * uživatele — uživatel by se bez tohohle mocku nedostal na žádnou
 * obrazovku k review (Dodatek 12: reálně se to stalo, "/" skončilo na
 * /login bez použitelných přihlašovacích údajů). Používá se pro "/" i
 * /nastaveni/* — pak se tenhle soubor i jeho použití smaže a stránky se
 * vrátí pod RequireAuth (soubor zůstává nedotčený, viz App.tsx).
 */
export const MOCK_AUTH_VALUE = {
  firebaseUser: null,
  loading: false,
  userDoc: {
    uid: 'preview',
    role: 'org_admin' as const,
    displayName: 'Jana Málková',
    email: 'jana@example.com',
    organizationId: 'preview-org',
    createdAt: 'preview',
  },
}
