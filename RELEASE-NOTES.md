# v0.1.0 — Connected Book Warehouse pilot

First versioned checkpoint of the connected reader and Super Admin application. This is a pilot release from the review branch, not a declaration that GitHub Pages deployment or every live-account flow is verified.

## Included

- Bangla-first catalogue with English switching and one card per edition/library, while each physical copy remains separately tracked and reserved.
- Reader request-to-return journeys, private collection/return notices, live in-app admin inbox and authorized approval, checkout and return confirmation.
- Exact-request admin review with persistent selection and clearer approval/rejection feedback.
- On-page borrower confirmation, safe cancellation, active/history views and stable journey cards.
- Google Drive PDF upload, private drafts, reviewed public-link publication and separate digital reading cards.
- Reversible catalogue archiving that preserves inventory and request history.
- GitHub Pages build and workflow with an allowlisted public browser configuration; no administrative credentials or tokens included.

## Validation

- 33 Node tests passed.
- GitHub Pages production build passed.
- Local Firestore emulator checks covered authorization, concurrent reservations, transitions, reader signals, private data, digital metadata and reversible archiving.
- Browser checks covered the full fictional emulator journey and the latest borrower/admin UX through memory-only fixtures. Real catalogue/PDF and read-only admin review were checked separately.

## Before public deployment

- Merge the pull request only after review; configure GitHub Pages to use GitHub Actions instead of the legacy raw-source main branch.
- Firebase already authorizes the GitHub Pages domain. Saving the Google Drive OAuth origin for https://sushen.github.io still awaits the founder's action-time confirmation.
- Verify hosted Google sign-in, admin access, real reader submission and Drive connection after deployment. Local sign-in does not carry over to another website origin.
- Mobile acceptance of the latest confirmation/review flow is incomplete. Existing dependency audit advisories remain; no forced SDK downgrade was applied.

The public client configuration deliberately identifies the existing staging project. This release does not create partners, grant public admin access, change billing, or promise closed-browser notifications. Physical stock and circulation records remain in Firebase; PDFs remain in Drive.
