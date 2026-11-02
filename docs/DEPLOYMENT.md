# Operating Ledgerflow

## Configuration

Use Node.js 24 and Postgres 16. Keep DATABASE_URL and JWT_SECRET in the host secret manager. JWT_SECRET must contain at least 32 random characters and cannot use the example placeholder. Production refresh cookies are HTTP-only, Secure and SameSite=Strict. Host the web client and API under the same site over HTTPS, for example app.example.com and api.example.com. Set CLIENT_ORIGIN to the exact web origin without a trailing slash. Set NEXT_PUBLIC_API_URL to the public API origin when building the client.

The local Compose file is a development database: it deliberately binds only to loopback on port 55434 and uses development credentials. Production needs a dedicated database, managed credentials, TLS where appropriate, backups and restore exercises. Do not expose the development database to the Internet. Run a single migration job before starting a new API release.

## Build and migrate

From the repository root:

```sh
docker build --target build -t ledgerflow-migrate Server
docker build -t ledgerflow-api Server
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t ledgerflow-client Client
```

The API runtime image has no development dependencies. Use the build image for the migration job:

```sh
docker run --rm --env-file /secure/path/server.env ledgerflow-migrate npx --no-install prisma migrate deploy
```

The environment file must point to the production database from inside the container network. It must not be checked into Git or copied into an image. Start the API image with DATABASE_URL, JWT_SECRET, CLIENT_ORIGIN and PORT=4000. Start the client image on port 3000. Put both behind HTTPS, and route readiness checks to GET /health. The health endpoint runs SELECT 1 against Postgres. Expose Swagger only as permitted by your deployment policy.

For a process deployment, run `npm ci`, `npm run db:migrate`, `npm run build`, then `npm run start:prod` inside Server. Run `npm ci`, `npm run build`, then `npm start` inside Client. Environment values prefixed NEXT_PUBLIC are embedded at client build time.

## Data integrity and recovery

- Money/stock workflows use serializable transactions. A concurrent conflict returns HTTP 409; reload current state before retrying. UI requests are not automatically retried after a network failure. Confirm the document or stock ledger before manually repeating a payment or adjustment after an uncertain response.
- Conversion, invoice generation and bill creation return the linked document on repeated requests. Receipt quantities cannot exceed the remaining order quantity. Repeating an already completed receipt, shipment or payment is rejected by lifecycle/balance checks.
- Stock is never allowed below zero. Clear remaining units before archiving a product. Referenced contacts, companies and vendors cannot be deleted while documents rely on them.
- Audit entries commit in the same transaction as stock and money mutations. Access checks query the current membership for every request; membership removal prevents further API access, and role changes apply immediately.
- Access tokens expire in 15 minutes; refresh cookies expire after 7 days and rotate on use. Keep JWT_SECRET stable across replicas. Rotating it invalidates active access tokens.
- The built-in auth rate limit is per process and per direct client IP. With multiple replicas or a reverse proxy, add a shared gateway rate limit and configure trusted proxy handling at the gateway. Do not blindly trust forwarded headers.
- Configure structured application logs, metrics, error monitoring, database alerts and backup retention for the chosen host. The repository does not provision a monitoring account or claim an external production environment has been observed.

## Accounting boundaries

Invoice status SENT means issued, not emailed. Quote/order/invoice amounts are calculated from quantity, price and tax basis points using decimal arithmetic. Partial allocations update invoice status to PARTIAL, and a zero remaining balance becomes PAID. PO PAID is rendered as Received; sales-order PAID is rendered as Shipped, following the specification's shared enum.

The MVP has one currency per organization; changing currency is blocked once documents exist. Reporting periods and dashboard day/month boundaries use UTC. Displayed dates use the browser locale. The organization timezone is saved for future scheduling integrations.

AR aging has a Current bucket plus overdue 1-30, 31-60, 61-90 and 90+ day buckets. Stock valuation uses current product cost prices. The lite profit report estimates cost of goods using current cost prices and excludes operating expenses, payroll, taxes and historical inventory cost layers. Simplified accounts are operational balances, not a double-entry general ledger.

Vendor bills are created from received purchase orders and represent the full purchase-order amount, including partially received orders. Recording a bill as paid marks an external full payment; it does not initiate a bank transfer. Customer payments allocate to one invoice per request. Partial bill settlement and batch multi-invoice allocations are not provided by the current UI.

## Release gates

Run client/server lint, unit tests, API integration tests, production builds and npm audit. Run the browser suite against the production client build and a real Postgres database. CI defines these steps in `.github/workflows/checks.yml`. Review the deployed origin/cookie settings, migration result, readiness response, backups and access roles before routing live customer traffic. Production deployment is an operator action; no live environment was published by this build task.

Demo seeding is blocked when NODE_ENV=production. Never deploy the demo workspace or test credentials as a live customer environment.
