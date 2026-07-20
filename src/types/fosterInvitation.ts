/**
 * foster_invitations/{email} — ZADANI §6 A6 "Pozvání pěstouna (magic
 * link)". Dokument ID JE e-mail (ne náhodné ID) — `firestore.rules` na
 * tom staví self-bootstrap `users/{uid}` create pravidlo (stejný sekvenční
 * vzor jako M1 org_admin self-registrace: pozvánka musí existovat DŘÍV,
 * než si nově přihlášený pěstoun smí sám založit profil).
 *
 * Magic link samotný jede přes Firebase Auth Email Link (passwordless)
 * sign-in — `sendSignInLinkToEmail`/`signInWithEmailLink`, viz
 * fosterInvitationService.ts. Firebase e-mail ODESÍLÁ SÁM (vlastní šablona,
 * server-side), žádná Cloud Function ani vlastní e-mailový systém — stejný
 * princip jako A5 "notifikace zakládá klient" (§10 "žádné Cloud Functions").
 *
 * `consumedAt`/`consumedByUid` — nastaví se AŽ při reálném dokončení
 * bootstrapu (po kliknutí na odkaz), ne při odeslání pozvánky. Brání
 * druhému použití STEJNÉ pozvánky pro založení druhého profilu (rules
 * `users/{uid}` create navíc vyžaduje `consumedAt == null` v okamžiku
 * zápisu).
 */
export interface FosterInvitationDoc {
  email: string
  organizationId: string
  familyId: string
  fosterPersonRef: string
  /** Jméno pěstouna z `FosterPersonDoc` v okamžiku pozvánky — uložené TADY,
   * ne dočtené z `fosterPersons/{fosterPersonRef}` až při dokončení
   * přihlášení, protože profil-less nově přihlášený uživatel `fosterPersons`
   * ještě nesmí číst (rules `isFoster()` vyžaduje JIŽ existující `users/{uid}`
   * profil — kruh, který by jinak dokončení přihlášení zablokoval). */
  fosterPersonDisplayName: string
  invitedByUid: string
  invitedByDisplayName: string
  createdAt: string
  consumedAt?: string | null
  consumedByUid?: string | null
}
