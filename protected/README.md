# Protected books — 0.1.1 review checkpoint

Start with [the release boundary and remaining work](../RELEASE-NOTES-0.1.1.md). Both normal local frontends (ports 5173 and 5174) now use protected catalogue controls, and local Digital books administration opens protected publishing. Legacy full-PDF link rendering/publication is retired in this source. Existing public Drive files still need owner-controlled permission changes; this code cannot revoke already distributed links by hiding them. The new 200-credit title is not yet migrated and remains locked.

The complete backend source is included for review, but it is **not deployed**. The Pages build excludes the protected reader, and normal nonlocal catalogues remain locked until a hosted API/private store is configured. Do not merge expecting purchases to run on Pages without that setup. The following dated implementation notes preserve local prototype history; newer notes supersede earlier emulator-only and public-link descriptions.

## Reader credit purchase workflow — 22 November 2026

The catalogue now links to protected.html#credits. Readers use their existing Google session. bKash/Nagad require a transaction ID, USDT requires a full transaction hash on the configured BNB Smart Chain (BEP-20) network, and Dutch-Bangla requests require the sending account number with a transfer reference when available. No screenshot/file evidence upload. Submitted text is a claim requiring independent verification, not proof.

Founder-confirmed receiving details live only in payment-methods.json under the private local data directory, outside this repository/static build. Do not copy them into public source or docs. API returns details only to authenticated readers. Current fixed policy is 1 USDT = 130 BDT = 130 BW Credits, until explicitly changed. The supplied book's 8-USDT reference is now 1040 BDT/credits; existing licenses survive. USDT requests snapshot the quote in integer millionths and round upward once; 1040 credits quote exactly 8.000000 USDT. The receiving screenshot minimum requires more than 0.01 USDT; the UI/server require at least two credits for USDT.

New requests cannot be submitted without required text evidence and go straight to pending-review. Older pre-change awaiting-payment requests remain completable; no history was deleted. Owner-scoped lists, direct next-step focus, duplicate-request continuation, pending status refresh and approved Return to catalogue complete the reader journey. Existing Google admin dashboard has a local-only credit queue notice, refreshed every 30 seconds. Protected page exposes the review queue before publishing controls, with exact reference/amount and independent-receipt confirmation required. Bank requests without a transfer reference require an administrator's independently verified unique statement reference before approval. Rejections have reasons; approval writes wallet, immutable receipt, reviewed request and ledger atomically. Replays/concurrent approvals cannot double-credit; receipt reuse across accounts is denied. Reviewed cards remain visible after the decision.

Reports distinguish confirmed credit sales, book-credit spending, discretionary grants, BDT and USDT receipts; they are local operational reports, not production accounting. Gateway verification remains unconnected. Approval adds credits automatically only after a human confirms receipt. PaymentService remains the future verified-provider adapter boundary. No claim of automatic payment-ID verification is made.

Checks are recorded in canonical docs/WORKLOG.md. Normal Google sign-in controls now display name/email/UID and replace Sign in with Sign out after authentication. Cache improvements were discussed only; no whole-browser cache clearing or update/reload mechanism was added.

## Google authentication update — 22 November 2026

Normal local catalogue and protected reader use the existing Firebase Google sign-in, not the Auth emulator or a test email/password form. Start with GCLOUD_PROJECT=demo-book-warehouse, FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 and BW_PROTECTED_AUTH_MODE=google (default). The host deletes any Auth-emulator environment setting before creating the real identity verifier. Google ID-token signature/audience/issuer/expiry are verified by Firebase Admin; live accounts:lookup validates account status/revocation. Existing adminGrants are read through Firestore REST with the same user's bearer token and existing rules, and rechecked by service admin guards. No service-account key or production writes are needed for identity/role reads.

The physical catalogue and borrowing use the existing connected Firebase data, as before. New digital wallets/licenses/credit grants and encrypted files remain local only. Real Google UIDs have independent local balances starting at zero; old fictional balances/licenses are not transferred. Sign into protected.html to see your UID/balance; an existing Google Super Admin can grant local test credits. No real top-ups. Never describe this as a production protected-content deployment.

Automated Auth-emulator API tests require a separately started host with BW_PROTECTED_AUTH_MODE=emulator and FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099, and explicit ?emulator=1 frontend entry. This is opt-in test tooling. Do not point emulator tokens at Google mode. npm run test:protected-google checks the real-identity boundary (unset the Auth emulator variable).

Four Google identity tests and eight protected tests passed; real Google sign-in and purchase in the external browser remain user acceptance checks. The chat browser displayed the Google button but its popup did not complete; no success claimed. Historical emulator-only notes below describe the earlier milestone and are superseded by this update.

# Protected books and credit prototype

Founder scope clarification, 22 November 2026: real payment providers are deferred. Review the local test-credit flow now; merchant setup, API keys and conversion-rate decisions do not block this stage. Future payment integration must still verify actual receipt before issuing purchased credits.

Local-only prototype on the `codex/patch-0.1.1` worktree. The production v0.1.0 reader/admin application and its existing public Drive books have not been migrated or changed by this prototype.

## Run locally

Use the existing npm dependencies plus Python with PyMuPDF. Start Firebase Auth/Firestore emulators for `demo-book-warehouse` on 9099/8080; seed only fictional users using `scripts/seed-emulator.cjs` with its required local environment guards. Never point this seed at a real project.

The protected service refuses startup unless these are explicit:

```powershell
$env:GCLOUD_PROJECT='demo-book-warehouse'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
npm.cmd run protected:serve
```

Run the patch frontend on port 5174 and open `http://127.0.0.1:5174/protected.html`. Its API accepts only those local frontend origins and listens on loopback port 8787. The original development server on 5173 is separate and is not restarted by this workflow.

This UI explicitly labels balances and grants as test credits and real payment processing as disabled. The seed has fictional reader/admin accounts; supply the seed password through its environment variable. Never use production passwords in this local emulator.

## Actual protection boundary

- Private original PDFs are AES-256-GCM encrypted outside the website tree, under the local user's AppData BookWarehouse/protected-prototype folder by default. The master key stays there too; it is not sent to clients or placed in Git. This local key file is not production key management.
- The processing helper is Python automation; the website remains static JavaScript and a separate Node service handles authorization. Source PDFs are temporarily decrypted only into private temporary processing directories and removed afterward.
- Upload is a private draft until an admin publishes it. Source SHA-256, page count, declared ownership claim/claimant and initial version are recorded. These records do not legally establish copyright or verify the claim.
- Preview PDFs are separate documents containing only the first floor(10% × page count) pages. A one-page/very short book can have zero preview pages; never expose the whole file to satisfy a minimum preview. Links/annotations and inherited source metadata are omitted from the preview.
- Browser reading uses server-rendered page images. Each protected-page request verifies the current Firebase identity and license; revocation is checked again before sending a rendered protected page. The original PDF is not sent by the reading endpoint.
- Full original bytes are delivered only through an authorized download endpoint, subject to the saved download policy. Users can still photograph/screenshot page images or retain already delivered images/downloads. Revocation affects future server requests, not copies already received.
- Public previews and licensed pages use no-store responses. There is no private-file static directory or permanent full-file bearer URL.

## Credit, purchase and revenue records

The backend owns wallet/ledger/license writes. The deployed browser rules' default-deny matches also cover the new collections, and emulator checks explicitly verify direct browser forgery/read denial. Server authorization is still mandatory because Admin SDK writes bypass Firestore rules.

Purchases verify server price/version and atomically write the debit, entitlement and ledger entry. Both repeated operation IDs and concurrent different IDs for the same active entitlement avoid duplicate charges. Insufficient balance, mismatched offers and revoked licenses fail without debiting again. Admin grants are separate immutable test-grant entries; they are not reported as cash revenue.

The trusted-ledger method for verified payment events checks an existing server-priced/provider-bound intent, exact provider order/amount/currency, and event/intent replay before atomically adding credits. It is tested with fictional payment evidence. **No real payment adapter, verified webhook endpoint, paid top-up checkout or monetary conversion rate is connected yet.** No browser-provided “payment successful” flag is accepted.

The admin report separates credit grants, book-credit spending and verified top-up money by currency. Spending credits on a book must not be added again to cash collected from credit top-ups. This is an operational ledger view, not completed accounting/revenue-recognition policy, settlement or royalty distribution.

## Verification commands

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run build:pages
# Isolated local Firestore emulator:
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8186'
npm.cmd run test:protected
# Running local protected service with fictional emulator users:
$env:BW_TEST_PROTECTED_API='local-only'
npm.cmd run test:protected-api
```

The API integration test creates only fictional emulator users/books. It verifies unlicensed denial, preview limit, one-time license charge, original-byte-preserving authorized download, page authorization, encryption-at-rest check, download-policy denial and revocation. Ledger tests independently exercise concurrent purchases and top-up replay.

## Incomplete scope and production gates

Real payments require the founder's payment provider/merchant account, currency and credit price, verified webhook rules, refund/chargeback/dispute behavior and hosting choice. Real credit sale price, book prices, partners or provider success cannot be invented. The local server intentionally cannot run against production.

Production requires separately deployed trusted API/private storage/key management and review of rate limits, malware/PDF processing isolation, backup/key rotation, operational monitoring, data retention, session policies and applicable commercial terms. No new paid services or billing are enabled here. The prototype is English-only; final Bangla-first UI/accessibility and mobile acceptance remain follow-up work. It records initial-version evidence, but does not yet provide a full author submission/rights dispute workflow or multi-version editorial UI. Preview percentage is currently fixed at 10% for uploads; broader preview policy editing is future work.

The protected page is excluded from the GitHub Pages build until this backend exists. The original public Drive flow remains separate; it must be deliberately migrated and public full-file permission removed before a real book is advertised as protected. Files already downloaded cannot be recalled.
