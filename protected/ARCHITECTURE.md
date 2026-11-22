# Reusable protected-books module

This module is independent of Book Warehouse HTML, Google Drive, and the book-making software. Importing `protected/index.cjs` starts no server, initializes no Firebase application and loads no key. The host supplies adapters and composes one system instance.

## Layers and chosen patterns

| Layer | Responsibility | Pattern |
| --- | --- | --- |
| `core/CreditLicenseService` | Credit grants, verified top-up application, atomic purchase/license and revocation | Domain service + repository transaction/Unit of Work |
| `core/PublishingService` | Intake validation, authorized immutable draft identity, PDF/evidence workflow and publishing policy | Application service |
| `core/ReadingService` | Public-preview boundary, current-license checks before protected page delivery, controlled originals | Application service |
| `core/ReportingService` | Separate operational credit/cash totals | Read-model service |
| `core/TakaCreditPricePolicy` | Integer-based currency-reference conversion and whole-credit rounding | Pricing Strategy |
| `core/PaymentService` | Verify a provider notification before applying credit | Gateway Strategy/Adapter; no real gateway configured |
| `adapters/FirestoreRightsRepository` | Opaque references, reads, lists and atomic transactions | Repository/Adapter |
| `adapters/FirebaseIdentity` | Verify identities and active administrator grants | Identity Adapter |
| `adapters/EncryptedFileStore` | Authenticated encryption, private files and tamper detection | Storage Adapter |
| `adapters/PdfProcessor` | Bounded Python preview/page processing and temporary-file lifecycle | Processor Adapter |
| `adapters/ProtectedBooksHttpController` | HTTP methods, parsing, CORS, identity boundary and response DTOs | Controller |
| `system.cjs` | Construct and connect services from supplied dependencies | Composition Factory |
| `ProtectedBooksClient` | Browser transport, token handling and identity-change protection | Frontend API Adapter |
| BW catalogue/reader modules | Display offers and license-confirmed actions | Presentation adapters; pure stateless helpers stay functions |

`server.cjs` is only the local host/bootstrap: environment guards, actual Firebase SDK instances, private storage/key setup and listening socket. Other applications use `createProtectedSystem()` with their own adapters instead of importing that bootstrap.

## Required contracts

The repository supplies `ref(collection,id?)`, `read(collection,id)`, `list(collection,filters)`, `append(collection,data)` and `runTransaction(work)`. References are opaque to core. Transaction work receives `get/create/set/update`; a read returns `exists` and `data()`. Any replacement adapter must provide real atomic/serializable transaction semantics, including retries, not just emulate these names with unrelated writes. All transaction reads precede writes.

The identity adapter supplies `identify(authorization)` and `requireAdmin(authorization)`, returning a verified principal UID. Never substitute a browser-provided UID or decode a token without verification. Publishing also rechecks the active admin grant in its final transaction so a revoked administrator cannot complete an in-flight upload/policy commit.

The file adapter supplies `writeOriginal/readOriginal`, `writePreview/readPreview`; it must never publish full-file URLs or encryption keys. The PDF adapter accepts byte buffers and returns a separate preview plus page metadata, or a rendered-page image. Its processing paths are outside the static website; lifecycle cleanup belongs to the adapter. `clock()` is injected so core has no Firebase timestamp dependency.

The payment gateway supplies `verify(notification)`, which must independently authenticate provider evidence and normalize the merchant-bound intent/order/amount/currency/status. Only then can `PaymentService` apply the verified event through the credit service. No real gateway or webhook route is exposed in this milestone.

## Money and offers

The host's current local policy is 1 BW Credit = ৳1. Fractional conversion uses integer micro-units and taka minor units, rounds up once to a whole credit, and locks the saved server offer. The founder-approved local offer for the supplied book is 992 credits, based on an indicative 8-USDT reference at 123.99 BDT/USDT (991.92 BDT rounded). The checked source is recorded in `pricing-reference.json`; this is not a continuously updating settlement quote and does not enable USDT payments. Changing a book's credit price clears stale reference metadata.

The frontend asks the server for the current user's license before displaying full-read/download actions. Before purchase it offers preview and purchase only; browser actions are convenience controls, not the security boundary. Each protected-page/download request is authorized again by the backend. The existing production public-Drive catalogue is not silently migrated; only the separate local patch shelf uses these protected offers.

## Refactoring protocol used

1. Preserve the passing ledger/security/API tests as characterization checks.
2. Extract one responsibility, keep the `createRightsLedger` construction facade compatible, and rerun behavior checks.
3. Move platform dependencies to adapters and compose them explicitly.
4. Add focused tests for tamper detection, pricing, payment verification strategy, import side effects, UI action gating and account-change response discard.
5. Verify actual before/after purchase UI using local test credits. Keep real provider integration and production deployment outside this refactor.

Initial API retest was interrupted by the local Auth emulator exiting; restored only the local test sign-in service and reran successfully. Browser checks found an older preview cache and a fetch receiver-binding problem; refreshed the separate patch preview, corrected the adapter binding and added a regression test. Do not treat these initially failed checks as passes.

## Reuse sketch

```js
const {createProtectedSystem} = require('./protected');
const system = createProtectedSystem({
  repository, files, pdf, identity, clock,
  origins: new Set(['https://your-frontend.example'])
});
// The host chooses its HTTP framework and forwards a request to system.http,
// or calls the application services after establishing verified principals.
```

This documents dependency boundaries, not production readiness. Key management, HTTPS, processing isolation, real payment adapters, account/payment terms, migration, localization/accessibility and operational controls still need the separate production work described in README.md.

## Connected identity, isolated local rights data

GoogleFirebaseIdentity uses the Firebase Admin SDK plus accounts:lookup for existing Google identities. It reads the authenticated user's existing administrator grant through Firestore REST, under deployed rules. The injected adminGuard port rechecks that permission in publishing and credit administration instead of trusting locally mirrored grants. AsyncLocalStorage scopes the bearer to the current HTTP request; tokens are neither logged nor persisted. The Google host clears the Auth-emulator variable before initialization, while private persistence remains in the local Firestore emulator. Emulator identity remains explicitly opt-in for automated tests.

## Credit purchase request boundary

TopupRequestService owns evidence validation, fixed method quote snapshots, ownership, review authorization and one-time receipt reconciliation. CreditTopupView owns presentation and next-step focus; CreditTopupInbox adapts the normal admin dashboard to the local queue. Sensitive receiving configuration is injected privately by the local host. Text references do not mint credits. Existing Google role guards authorize manual receipt verification; future gateway adapters must verify actual receipt before trusted financial mutation. Payment reference uniqueness is keyed by method plus normalized verified reference; manual and provider verification remain distinct ledger kinds.

## Focused reading presentation

FocusedBookReader owns dialog, image lifecycle, bounded navigation, keyboard controls and device-local numeric position. It takes API/getUser and navigation/unlock callbacks; it contains no payment/provider/authorization rules. Full open verifies /read and every page uses the server endpoint. Request generation and identity checks discard late images after close/account changes; object URLs are revoked. The host routes separate Books/Credits/Requests/Manage panels and owns finance/account refreshes, which do not run on a reader page turn. A fit-page viewport keeps navigation stationary; user-selected magnification scrolls only the canvas.
