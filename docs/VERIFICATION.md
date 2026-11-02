# Verification — 2 November 2026

The connected MVP is implemented and verified locally. No live production deployment was performed, and the remote CI run has not been independently confirmed.

| Check | Result |
| --- | --- |
| Client ESLint | Passed without warnings |
| Client TypeScript and production build | Passed |
| Server type-aware lint and production build | Passed |
| Unit tests | 3 passed |
| Real Postgres API acceptance | 19 passed |
| Chromium browser acceptance against standalone production client | Passed |
| Client dependency audit | 0 vulnerabilities |
| Server dependency audit | 0 vulnerabilities |
| API Docker image build and runtime smoke | Passed |
| Client Docker image build and runtime smoke | Passed |
| Empty-database migrations and demo seed | Passed |
| Repeated demo seed preserves existing data | Passed |

The API suite verifies public readiness, owner registration, strict DTO validation, tenant injection rejection, cross-organization reads and references, exact document totals, repeated conversion, partial/full payment allocations, partial receipts, over-receipt rejection, shipping, negative-stock rejection, dashboard math, valuation, audit history, vendor bills, one-use invitations, role changes and removal, draft editing, notes, templates, number prefixes, concurrent payment safety, refresh rotation and active workspace persistence.

The browser scenario registers a workspace through the UI, creates a product and customer, downloads and checks a CSV, creates and edits a quote, converts it to an order and invoice, issues the invoice, records payment, creates a vendor and PO, receives goods in two stages, records a vendor bill payment, adds a contact note, searches through the keyboard palette, persists light theme and compact density across reload, opens reports, and navigates at a 390px mobile viewport. It checks visible dashboard text is at least 14px, verifies no mobile page overflow, and asserts there are no uncaught page errors. Test fixtures are removed after the scenario.

API Docker smoke verification includes anonymous `/health`, bcrypt login, Secure/HttpOnly production cookie attributes and authenticated `/me`. Client Docker smoke verification includes statically prerendered marketing HTML, CSS delivery and the branded icon. Both runtime containers run as the non-root Node user.

A separate empty database applied all four committed migrations and seeded 12 products, 8 contacts and 14 quotes. Seeded dashboard results matched: revenue **$2,629.00**, open AR **$2,247.30**, **3** stock alerts and **4** pending quotes. Running the seed again kept the existing workspace. The temporary bootstrap database and earlier browser fixtures were removed afterward.

## Operating boundaries

Email delivery, Stripe, manufacturing, FX and full double-entry accounting remain the specification's stretch scope. Browser printing is available; server-generated PDF delivery is not enabled. Templates are saved for future delivery integration. Vendor bill payment records an external payment. Reports use the documented simplified accounting and current-cost assumptions.

Production requires an operator-selected HTTPS host, real secrets, database backups and monitoring. Money and stock requests return a conflict when concurrent writes cannot safely commit; inspect current state before manually retrying an uncertain payment or adjustment. See [deployment guidance](DEPLOYMENT.md).
