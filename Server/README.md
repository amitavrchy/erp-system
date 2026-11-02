# Ledgerflow API

NestJS ESM API with Prisma 6 and PostgreSQL 16. Read the [root setup guide](../README.md) and [deployment guide](../docs/DEPLOYMENT.md).

- `npm ci`: install dependencies and generate Prisma Client.
- `npm run db:migrate`: apply committed migrations without generating new ones.
- `npm run db:dev`: create a development migration after a schema change.
- `npm run seed`: build and seed a demo workspace (local only; requires DEMO_PASSWORD).
- `npm run start:dev`: watch development server on port 4000.
- `npm run build` / `npm run start:prod`: compile and run `dist/main.js`.
- `npm run lint`, `npm test`, `npm run test:integration`: validation.

Swagger lives at `/api/docs`. `/health` checks database connectivity. Business endpoints require an access token; membership is revalidated on every request. The active organization comes from the signed token, never a client header or submitted organizationId. Refresh tokens are opaque, hashed in the database and rotated on use. Access tokens expire after 15 minutes.

Document totals use decimal arithmetic. Conversion preserves lines and totals. Receipts, shipping, adjustments and allocations run in serializable transactions, and mutations commit with their audit records. A concurrent write conflict returns 409 so the caller can refresh and retry. Invoice payments require SENT/PARTIAL status; overpayments, over-receipts and negative stock are rejected. Document links are idempotent for repeated conversion and bill creation. Stock-bearing products must be cleared before archival.

All list endpoints return `{ data, meta: { page, pageSize, total } }` with a maximum page size of 100. Financial document edits are restricted to unprocessed documents. PO status PAID means fully received and sales-order status PAID means shipped, following the shared status enum in the authoritative schema; the UI uses the corresponding operational labels.
