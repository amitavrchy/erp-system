# Ledgerflow

A connected ERP workspace for small and growing teams. Built with Next.js 16, React 19, NestJS 12, Prisma 6 and PostgreSQL 16. The build follows [the project specification](docs/PROJECT_SPEC.md); all interface text is at least **14px**, including compact tables.

## What works

- Organization registration, sign-in, rotating HTTP-only refresh sessions, workspace switching, invitations and roles.
- CRM companies and contacts, tags, connected documents, notes and activity.
- A connected [CRM suite](docs/CRM_SUITE.md): leads, multiple deal pipelines, tasks, calendar, campaigns, segments, support tickets, custom fields, task automation and analytics.
- Products with text attributes, warehouses, stock adjustments, low stock and a movement ledger.
- Quotes → sales orders → invoices → partial/full payments, plus order shipping.
- Purchase orders → partial/full receiving → stock movements → vendor bills and recorded bill payment.
- Dashboard with real KPIs, attention items and activity; sales by period, AR aging, stock valuation, simplified accounts and estimated gross margin.
- Draft editing, automatic document numbering, print views, CSV export, command search, dark/light theme and density preferences.
- Role checks and tenant isolation in the API, audit records for business mutations, exact decimal document totals and serializable money/stock transactions.

## Run locally

Requirements: Node.js 24, npm and Docker Desktop. Run these commands from the repository root:

```powershell
node scripts/setup-local.mjs
cd Server
npm ci
docker compose up -d
npm run db:migrate
npm run seed
npm run seed:crm
npm run start:dev
```

Open a second terminal:

```powershell
cd Client
npm ci
npm run dev
```

Open **http://localhost:3000**. The API runs at **http://localhost:4000**, Swagger at **http://localhost:4000/api/docs**, and the database readiness probe at **http://localhost:4000/health**.

Postgres binds to `127.0.0.1:55434`, separate from other local projects. Demo sign-in is `owner@ledgerflow.demo`; use `DEMO_PASSWORD` from your local `Server/.env`. The seed runs atomically, refuses production, and preserves an existing demo workspace. You can also register a fresh workspace without seeding.

If port 3000 is occupied, use `node scripts/setup-local.mjs --client-port=3001` on first setup, then `npm run dev -- --port 3001`. For existing env files, update `Server/.env` to `CLIENT_ORIGIN=http://localhost:3001` and restart the API. The setup helper never overwrites existing env files.

## Verification

With Postgres running and `Server/.env` configured:

```powershell
cd Server
npm run lint
npm test
npm run test:integration
npm audit
```

The integration suites start isolated API ports (4101 for ERP, 4102 for CRM), create their own tenants, test validation, cross-tenant access, sales and support workflows, document conversion, partial payments and receipts, stock, roles, session rotation, settings and concurrent payments, then remove their fixtures. `npm run test:e2e` is an alias for those suites.

With the API and client running at the origins above:

```powershell
cd Client
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Browser tests default to `http://localhost:3001`; set `PLAYWRIGHT_BASE_URL` if you use another port. They create temporary Browser QA workspaces, exercise the actual UI, and clean up their fixtures. Screenshots and failure traces go to ignored `Client/test-results/`. CI runs both builds and browser tests against Postgres.

## Structure

- `Client/src/app`: marketing, auth and workspace routes.
- `Client/src/components`: shell, tables, forms, document screens and reports.
- `Client/src/store`: auth, organization and UI state. Access tokens stay in memory.
- `Client/src/hooks`: organization-scoped React Query hooks.
- `Server/src/auth`: authentication, membership lookup and role guard.
- `Server/src/erp`: catalog, transactional workflows, reports and REST controllers.
- `Server/src/crm`: sales, campaign planning, support, custom fields and task automation.
- `Server/prisma`: schema, committed migrations and demo seed.
- `docs`: specification, acceptance results and deployment guidance.

## Scope

This is the specification's connected MVP, with simplified accounts and vendor bills. Email delivery, server-generated PDFs, Stripe, manufacturing, FX and full double-entry accounting are stretch integrations and are not enabled. Issuing an invoice changes its accounting status; it does not send an email. Printing uses the browser print dialog. Vendor bill payment records an external payment; it does not move money.

The CRM has been expanded beyond the original contacts/companies MVP. Campaign drafts and recorded support replies are available; external delivery providers remain unconnected. See the [CRM feature matrix and boundaries](docs/CRM_SUITE.md).

See [deployment guidance](docs/DEPLOYMENT.md) before operating a production instance and [verification notes](docs/VERIFICATION.md) for the tested release.
