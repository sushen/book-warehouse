# Book Warehouse 0.1.2 — shared Firebase reading and credits

The normal website now uses the same persistent Firebase records from local development and GitHub Pages. The digital shelf no longer waits for a local API or temporary application database.

## Changes

- Reuse the two existing digitalBooks records with confirmed prices: 1040 and 200 BW Credits.
- Load catalogue, wallet, licenses, payment methods and requests directly through Firebase Auth and Firestore rules.
- Run atomic purchases, manual credit-receipt approval, grants and revocation as JavaScript transactions validated by paired Firestore rules. No Cloud Functions or billing-plan change is required for this workflow.
- Serve separate preview pages, licensed pages and original download chunks from rule-protected Firestore documents. A download is reconstructed only after authorization and checked against its original SHA-256 fingerprint.
- Include protected.html in the GitHub Pages build; use relative navigation and the existing public Firebase project configuration.
- Keep physical borrowing and existing Google sign-in on the same project. Readers receive Preview/Buy before purchase and Read/Download when an active version-matched license exists.

## Data and deployment

The two existing PDF records have already been migrated by the signed-in owner through the local admin UI. Originals are stored in bounded private chunks; page images preserve the page layout, while the licensed download preserves original PDF bytes. Prices and payment methods are Firebase data, not title-specific frontend conditions. No historic temporary-database purchases or balances were reconstructed.

This PR contains code and security rules, not PDFs, private receiving account values, local credentials, or database exports. The rules must be deployed to the existing Firebase project before the new frontend. The matching rule set was tested with isolated emulator fixtures. The GitHub Actions Pages workflow builds on PR review and deploys only after the PR is manually merged to main.

For this initial implementation, book assets are Firestore documents rather than Firebase Storage objects. Bounded page/chunk writes avoid the document and request size limits; reader page turns load only the current page. This keeps one shared service but consumes Firestore storage/read/write quota; review that model before a large library migration. PDF preparation is a local Python publishing task, not a reader-facing backend. New books need a prepared package before protected publication.

Manual top-up review remains manual: transaction IDs are claims, not automatic payment-provider verification. Reports distinguish grants, verified credit receipts and book-credit spending. Original legacy Drive URLs were previously shared publicly and must be restricted by the owner separately; removing website links cannot recall copies already distributed. This PR does not claim to revoke those links.

## Validation

Clean npm ci, 55 standard tests, the Firestore transaction/security integration, and both standard/Pages builds passed. The actual built site under /book-warehouse/ displayed both books and opened the second book’s free preview from Firebase without a signed-in account. Matching Firestore rules deployed successfully on 23 November 2026. Pages publishing was switched from raw repository mode to the existing Actions workflow. The PR itself is not merged and no new frontend was deployed by this checkpoint. The emulator integration covers purchase debit/license atomicity, duplicate payment protection, admin-only approval and grants, preview limits, private download denial and revocation. Browser acceptance has verified both actual books and their free previews from Firebase. Actual real-money receipts were not submitted or approved during release preparation.
