# Wedding Gift Register

Khmer responsive PC web app. Groom is blue, bride is red. Each guest record has an editable name, optional name suffix, side, note, and 0–20 payment entries. Each entry records cash or ABA, USD or KHR, and an amount. Mixed cash/ABA and mixed currencies are supported in one guest record. The F2F button adds F2F to the note.

## Run
Requires Node.js 18+. Double-click start.bat or run npm start. Open http://localhost:3000 on this computer. Ctrl+C stops the server. Android online access/offline installation are not part of this PC update.

## Save and backup
Changes save on the PC in data/gifts.json. Existing legacy records are loaded compatibly and saved in the new payments-array format on the next mutation. Source and data were backed up in backups/before-update-* before this upgrade. Run one server against the data file. The Backup button downloads all records as JSON. CSV exports the current filtered payments, with one row per payment and the same guest ID for split payments. An automatic import UI is not included.

## Print / Save PDF
Choose side, receipt method, currency or search text, then click the Print / PDF button. In the browser print dialog choose Save as PDF. The A4 landscape report uses large Khmer text, separate cash/ABA columns, separate USD/KHR amounts, notes and per-side totals. It prints exactly the filtered payment entries; dashboard cards always show totals for all saved records. Browser headers/footers can be switched off in print settings.

## Tests
npm test runs the isolated API suite including legacy records, split payments and restart persistence. node ui-test.js uses installed Chrome and Playwright to test editing, filters, CSV, backup, mobile layout and a sample PDF. Test records are isolated from real records. print-test-sample.pdf contains generated test data only.

ABA records are entered manually; there is no bank verification. The server listens on 127.0.0.1. Khmer font: Preahvihear via Google Fonts with installed Khmer fallbacks.

## Accounts (shared wedding book)

On first launch at http://localhost:3000, create your own Admin account (prefer a Cambodian phone number such as `012345678` or `+85512345678`; legacy usernames remain accepted for compatibility, password 12–128 characters). There is no public registration after setup. Admin can create Admin/staff/owner accounts, disable/re-enable other accounts and reset their passwords. Owner accounts are view-only and see totals by USD/KHR and groom/bride side without the guest ledger. Users can update their phone number/name and change their own password from “គណនីខ្ញុំ”. Profile/password changes invalidate all sessions for that account. Sessions expire after 12 hours and on server restart.

All active users share the same wedding records. Staff can view, add, edit, filter, print and export CSV. Owner can only view the aggregate dashboard. Only Admin can delete gifts and manage accounts; these checks are enforced on the server. The full JSON Backup button is shown to Admin. Staff already has read access to the shared register. Passwords use salted scrypt hashes in data/users.json. Session cookies are HttpOnly and SameSite=Strict. Login attempts are rate limited. createdBy/updatedBy record the account ID on new saves.

Back up data/users.json together with data/gifts.json while the server is stopped; both contain private information. Never publish backups or data files. The current app continues to bind only to localhost over HTTP; public hosting requires a separate HTTPS deployment. npm test now runs API and authentication suites; npm run test:ui tests the gift workflow after authentication, using isolated test accounts and data.

## Guest list before payment
Use បន្ថែមភ្ញៀវ to save a name, groom/bride side and optional note without receiving money. The optional editable name suffix suggests ព្រមទាំង ភរិយា, ព្រមទាំង ស្វាមី and ព្រមទាំង ក្រុមគ្រួសារ; leave it empty for a guest alone. Existing names stay unchanged. Edit a guest and use បន្ថែមជួរប្រាក់ when money arrives; the same record is updated. Removing all payment rows returns the record to pending. Blank payment rows must be completed or removed.
Payment status filters distinguish guests with no recorded payment from guests with recorded money; this does not track attendance or count family members. USD/KHR totals include received entries only. CSV and printed reports include pending guests when no payment-method/currency filter excludes them. Pending amounts are blank in CSV and dashes in print. JSON backups use version 3 and retain nameSuffix and empty payments arrays. Data remains compatible with previous paid records. Run node guest-test.js for the isolated guest-first workflow suite.
