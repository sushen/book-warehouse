# Book Warehouse 0.1.1 — review checkpoint

This checkpoint adds protected digital-book services, a reader credit-purchase request flow, and a focused reading interface alongside the existing physical borrowing workflow.

## Included

- Reusable publishing, credit/license, reading, reporting and payment-verification interfaces, with separate persistence, identity, encrypted-file and PDF-processing adapters.
- Private AES-GCM PDF storage, separate default 10% preview, source fingerprints/ownership claims and server-checked reading/download access.
- Existing Google authentication; existing administrator roles checked independently from the local wallet/rights store.
- Atomic book purchase/licenses, credit grants, revocation, required text payment references and manual receipt review with duplicate-credit prevention.
- Configurable payment-method instructions loaded from a private local file, with separate credit-sale, book-spend and discretionary-grant reports. No screenshot proof uploads.
- Separate Books, Credits, Requests and Manage views; focused paginated reader, fit/zoom, keyboard controls and device-local numeric reading position.
- Both local development origins use the protected flow. Legacy full-file Drive reader links and public-Drive publication controls are retired; titles without protected publishing remain visibly locked.

## Deployment boundary

The protected API and encrypted files currently run locally. GitHub Pages can host the static site, but cannot run this API, local Firestore emulator or PDF processor. Protected reader entry is excluded from the Pages build and local API integrations are local-origin gated. On other origins the legacy digital shelf fails closed instead of exposing a full PDF link. This PR does not deploy a paid-book service or turn on real payment verification.

Before enabling purchases on GitHub Pages: choose and deploy a trusted API/private storage/key-management host, provision durable financial persistence, configure the allowed frontend origin and identity, migrate the PDFs and restrict their original public Drive permissions. Existing public Drive URLs remain an exposure until the owner changes sharing. No cloud permissions are changed by this commit.

Payment-provider APIs remain unconnected. An administrator must verify receipt independently; entered transaction IDs alone never mint credits. Receiving bank/mobile/wallet details, local master key, PDF bytes, balances, tokens and local database data are excluded from this repository. The configured local rate is 1 USDT = 130 BDT/credits. Book prices are runtime data, not title-specific frontend conditions.

## Known incomplete item

The new “পার্থক্য ও পুনরাবৃত্তি” title has a founder-selected price of 200 credits. Its owner PDF was downloaded for local processing, but protected upload/preview/publishing has not finished. It remains locked in the catalogue. This checkpoint must not be described as completing that migration.

## Review

Checkpoint validation: clean dependency installation, 54 default tests, eight protected emulator/component checks and three top-up tests passed. The four component checks overlap the default suite, giving 61 distinct passing tests. Standard and Pages builds passed. The historical Auth-emulator HTTP API suite was not rerun against the current real-Google-mode local server.

Run `npm ci`, `npm test`, `npm run build`, and `npm run build:pages`. Local Firestore security/transaction tests use the explicit emulator scripts documented in protected/README.md. The historical API integration test requires a separately started Auth-emulator-mode API and creates disposable test data; it is not a real-money/provider test.

No merge, GitHub Pages deployment, real payment or production migration is performed by this checkpoint.
