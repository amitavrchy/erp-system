# Verification — 3 November 2026

The connected ERP and expanded CRM suite are implemented and verified locally. No live production deployment was performed, and the remote CI run has not been independently confirmed.

| Check | Result |
| --- | --- |
| Client ESLint | Passed without warnings |
| Client TypeScript and production build | Passed |
| Server type-aware lint and production build | Passed |
| Unit tests | 3 passed |
| Real Postgres API acceptance | 34 passed across ERP and CRM suites |
| Chromium browser acceptance against standalone production client | 2 scenarios passed |
| Client dependency audit | 0 vulnerabilities |
| Server dependency audit | 0 vulnerabilities |
| API Docker image build and runtime smoke | Passed |
| Client Docker image build and runtime smoke | Passed |
| Empty-database migrations and demo seed | Passed |
| Repeated demo seed preserves existing data | Passed |

The API suite verifies public readiness, owner registration, strict DTO validation, tenant injection rejection, cross-organization reads and references, exact document totals, repeated conversion, partial/full payment allocations, partial receipts, over-receipt rejection, shipping, negative-stock rejection, dashboard math, valuation, audit history, vendor bills, one-use invitations, role changes and removal, draft editing, notes, templates, number prefixes, concurrent payment safety, refresh rotation and active workspace persistence.

The browser scenario registers a workspace through the UI, creates a product and customer, downloads and checks a CSV, creates and edits a quote, converts it to an order and invoice, issues the invoice, records payment, creates a vendor and PO, receives goods in two stages, records a vendor bill payment, adds a contact note, searches through the keyboard palette, persists light theme and compact density across reload, opens reports, and navigates at a 390px mobile viewport. It checks visible dashboard text is at least 14px, verifies no mobile page overflow, and asserts there are no uncaught page errors. Test fixtures are removed after the scenario.

API Docker smoke verification includes anonymous `/health`, bcrypt login, Secure/HttpOnly production cookie attributes and authenticated `/me`. Client Docker smoke verification includes statically prerendered marketing HTML, CSS delivery and the branded icon. Both runtime containers run as the non-root Node user.

A separate empty database applied all five committed migrations and both demo seeds. The CRM seed produced **12 leads**, **10 deals** and **4 support tickets**. Repeating the CRM seed preserved existing data. The demo CRM summary matched **8 open deals**, **$84,400** pipeline value, **$34,525** weighted forecast, **$18,900** won value and **50%** win rate. Base ERP money and stock were preserved. The temporary bootstrap database and interrupted browser fixtures were removed afterward.

## CRM expansion verification

The CRM API suite checks tenant and role restrictions, pipeline configuration, immutable historical stages, required custom fields, transactional task automation, repeat-safe lead conversion and quote handoff, loss reasons, task completion/reopening, calendar ranges, support deadlines and resolutions, audience segments, campaign persistence, duplicate-safe CSV imports, analytics and audit records. It also checks required fields during import/conversion and conversion retries when earlier opportunities already exist.

The CRM browser scenario creates a pipeline, required field and automation; converts a lead; creates a quote; moves the deal; completes an automated task; schedules an activity; creates a segment and campaign; resolves a ticket; and imports contacts. It checks white text on light-mode primary buttons, mobile overflow and uncaught page errors. Both this scenario and the original ERP scenario passed against the standalone production client.

Both updated Docker images built successfully. Runtime smoke checks passed for API readiness, bcrypt login, Secure/HttpOnly cookies, authenticated workspace and CRM endpoints, and client HTML/CSS/icon delivery. Both containers use the non-root Node user. Smoke containers were removed; the local preview remains available at `http://localhost:3001` with the API at `http://localhost:4000`.

## Operating boundaries

Email delivery, Stripe, manufacturing, FX and full double-entry accounting remain the specification's stretch scope. Browser printing is available; server-generated PDF delivery is not enabled. Templates are saved for future delivery integration. Vendor bill payment records an external payment. Reports use the documented simplified accounting and current-cost assumptions.

CRM campaigns plan work and support replies record conversations. External messaging, telephony, calendar synchronization, scheduled sequences and advanced SLA escalation are not connected. See the [CRM feature matrix](CRM_SUITE.md) for the implemented scope and integration boundaries.

Production requires an operator-selected HTTPS host, real secrets, database backups and monitoring. Money and stock requests return a conflict when concurrent writes cannot safely commit; inspect current state before manually retrying an uncertain payment or adjustment. See [deployment guidance](DEPLOYMENT.md).
