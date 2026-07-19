/**
 * Sdílený mock AuthContext pro DOČASNÉ review stránky, které ještě nemají
 * fungující backend k přihlášení (viz DesignPreviewPage.tsx). Používá se
 * i pro nové /nastaveni/* stránky, dokud M1 nepřinese reálné přihlášení —
 * pak se tenhle soubor i jeho použití smaže a stránky přejdou pod
 * RequireAuth jako zbytek appky.
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
