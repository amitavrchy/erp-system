# ERP System — Project Build Spec (Agent-Ready)

> Product brand: **Ledgerflow**  
> Stack locked: `Client/` Next.js App Router + TS + Tailwind + Redux Toolkit + React Query + axios + RHF/zod + framer-motion + lucide-react + @tanstack/react-table + recharts + date-fns + react-day-picker + radix dialog/dropdown/tabs + sonner + clsx/tailwind-merge. `Server/` NestJS ESM (`.js` import suffixes) + Prisma 6 + Postgres 16 (Docker) + JWT/passport + bcrypt + @nestjs/config + class-validator + @nestjs/swagger. No zustand.  
> Recommended extras (exact names): `cmdk`, `class-variance-authority`, `nuqs`, `@dnd-kit/core`, `@dnd-kit/sortable`, `xlsx`, `papaparse`, `zod` (already), `stripe` (optional stretch for invoices), `pdfkit` or `@react-pdf/renderer` (stretch).

---

## 1. Vision & Personas

**Vision:** A modern SMB ERP that feels like Linear × Notion for operations — not Odoo’s form forest or NetSuite’s enterprise chrome. One calm workspace for CRM → Quotes → Orders → Inventory → Invoices → Payments, with keyboard-first tables, command palette, and instant dashboards. Multi-tenant org model from day one.

**Brand promise:** “Run the business without fighting the software.” Dense where power users need it, empty-state warm for day-one teams.

**Personas**
| Persona | Goals | Pain today |
|---------|-------|------------|
| Founder / Owner (10–80 emp) | Cash visibility, one source of truth | Spreadsheets + QuickBooks + WhatsApp |
| Ops / Warehouse | Accurate stock, receiving, picking | Double entry, stockouts |
| Sales | Quotes → orders fast | CRM disconnected from inventory |
| Accountant | Clean AR/AP, audit trail | Month-end chaos |
| Org Admin | Roles, branches, tax settings | Permission nightmares |

---

## 2. Competitive Research (what to beat)

| Product | Strength | Weakness to exploit | Link |
|---------|----------|---------------------|------|
| **Odoo** | Broad app suite, kanban/chatter, ~$25/user, consumer-friendlier since v16 | Still “ERP app sprawl”; Studio complexity; UI density inconsistent across apps | https://www.odoo.com · compare https://www.erpresearch.com/compare/odoo-vs-erpnext |
| **ERPNext** | Fully open source, opinionated, cheap/self-host | Utilitarian UI, slower SMB adoption, thinner partner UX polish | https://erpnext.com · https://tatvamasilabs.com/odoo-vs-erpnext/ |
| **NetSuite** | Multi-entity finance, consolidation, SuiteCloud | Dated UI, heavy implementation, cost | https://www.netsuite.com · https://www.nimblechapps.com/insights/erpnext-vs-odoo-vs-sap-business-one-vs-netsuite |
| **SAP Business One** | Product/manufacturing depth for established SMBs | Rigid stack, modernisation lag | https://www.sap.com/products/erp/business-one.html |
| **Linear / Notion (UX bar)** | Keyboard, density, progressive disclosure, cmd-K | Not ERPs — steal patterns only | https://linear.app/now/behind-the-latest-design-refresh · https://www.notion.com |

**Beat them by:** (1) single coherent IA instead of 30 bolted apps, (2) Linear-grade table + filters + cmd-K everywhere, (3) document flow that auto-links Quote→SO→Invoice→Payment with visual timeline, (4) dark mode + skeleton loading as default craft, (5) 15-minute “demo company” seed so value appears before config hell.

---

## 3. Design System

### Color (hex)
| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#0B0C0E` | App background (dark-first) |
| `--surface` | `#14161A` | Panels, cards |
| `--surface-2` | `#1C1F26` | Elevated |
| `--border` | `#2A2F3A` | Hairlines |
| `--text` | `#ECEEF2` | Primary |
| `--muted` | `#8B93A7` | Secondary |
| `--accent` | `#5B8CFF` | Primary actions (Linear-like blue) |
| `--accent-soft` | `#1A2744` | Accent bg |
| `--success` | `#3DDC97` | Paid / in stock |
| `--warn` | `#F5C542` | Low stock / overdue soft |
| `--danger` | `#FF6B6B` | Overdue / error |
| `--info` | `#7DD3FC` | Draft / info |

Light mode alternate: `--bg #F7F8FA`, `--surface #FFFFFF`, `--text #0B0C0E`, `--border #E6E8EE`, same accent.

### Typography
- **UI:** `Inter` or `Geist Sans` — 12/13/14 dense tables, 16 body.
- **Display:** `Geist Sans` semibold for page titles.
- **Mono:** `JetBrains Mono` — document numbers, SKUs, money.
- Density: **comfortable** default; toggle **compact** (row h 36→28) in table prefs (persist Redux + localStorage).

### Layout & motion
- Shell: collapsible left nav (220→64 icon) + top bar (org switcher, cmd-K, notifications, avatar).
- Content max fluid; tables full-bleed in main pane.
- Motion: 150ms ease for menus; 200ms page fade; row highlight 100ms; prefer reduced-motion media query.
- Radius: 6px controls, 8px cards. Shadows minimal (border-first like Linear).

### Dark mode
- Class on `<html>` via Redux `ui.theme`; system preference on first visit.

---

## 4. Information Architecture & Pages

### App shell `/app`
Modules in sidebar (icons + labels): Dashboard, CRM, Sales, Inventory, Purchasing, Finance, Reports, Settings. Badge counts for overdue invoices / low stock.

### `/` Marketing (light)
Hero “ERP that feels like a product”, feature grid, pricing stub, CTA → `/register`.

### Auth
`/login` `/register` `/invite/[token]` — org creation on register (creates Org + OWNER membership).

### `/app` Dashboard
- KPI cards: Revenue MTD, Open AR, Orders today, Stock alerts (Recharts sparklines).
- “Needs attention” list (overdue invoices, pending quotes, low SKUs).
- Activity feed (last 20 audit events).
- Quick actions: New Quote, New Invoice, Receive Stock.

### `/app/crm/contacts` · `/app/crm/contacts/[id]` · `/app/crm/companies`
- TanStack Table: search, status filter, assignee, tags.
- Contact detail: activity timeline, linked deals/orders, notes.
- Interaction: inline edit name; cmd-K “Go to contact”.

### `/app/sales/quotes` · `orders` · detail routes
- Pipeline kanban (quotes) + list toggle.
- Quote builder: line items table (SKU typeahead, qty, price, tax), totals live, Convert → Sales Order.
- SO: fulfill / ship status chips; generate Invoice.

### `/app/inventory/products` · `warehouses` · `movements` · `adjustments`
- Product: SKU, variants (simple JSON attrs MVP), reorder point, qty on hand per warehouse.
- Movements ledger; stock adjustment modal with reason codes.
- Low-stock banner + filter.

### `/app/purchasing/vendors` · `pos` (purchase orders)
- PO create → receive (partial) → increase stock; link bill (AP).

### `/app/finance/invoices` · `bills` · `payments` · `accounts`
- Invoice statuses: DRAFT → SENT → PARTIAL → PAID → VOID.
- Record payment modal (amount, method, date); allocate to invoice.
- Chart of accounts simplified list (seed COA); journal entries stretch.

### `/app/reports`
- Sales by period, Inventory valuation, AR aging (0–30/31–60/61–90/90+), P&L lite (seed mapping).
- Export CSV (papaparse/xlsx).

### `/app/settings`
- Org profile, tax rates, currencies (single currency MVP + multi stretch), number sequences, members & roles, warehouses, document templates (email subject/body), theme/density, API keys stretch.

**Signature interactions:** Global `cmdk` palette (nav + create + search docs); document number copy-to-clipboard; linked document breadcrumb trail Quote › SO › INV › PAY.

---

## 5. Features Priority

### MVP
- Multi-tenant Org + Membership RBAC
- Auth JWT (access) + refresh
- Contacts, Companies
- Products, Warehouses, Stock levels, Adjustments, Movements
- Quotes → Sales Orders → Invoices → Payments (happy path)
- Purchase Orders → Receive stock
- Dashboard KPIs + AR aging + low stock
- Audit log on mutations
- Seed demo org
- Swagger at `/api/docs`

### Stretch
- Multi-currency & FX
- Manufacturing BOMs / work orders
- Full double-entry GL + bank reconcile
- Barcode scanning UI
- PDF invoice generation + email send
- Stripe payment links on invoices
- Custom fields / views
- Approval workflows
- Mobile-responsive polish for warehouse receive

---

## 6. RBAC & Multi-tenancy

**Tenancy:** Every business row has `organizationId`. NestJS guard resolves org from JWT claim `orgId` (active org). Never trust client org header alone.

**Roles (Membership.role)**
| Role | Access |
|------|--------|
| OWNER | Full + billing settings + delete org |
| ADMIN | All modules except delete org |
| SALES | CRM + Sales + read Inventory + own docs |
| INVENTORY | Inventory + Purchasing receive |
| FINANCE | Finance + Reports + read Sales |
| VIEWER | Read-all |

Enforce with `@Roles()` decorator + module-level checks (e.g. only FINANCE/ADMIN/OWNER post payments).

---

## 7. Frontend Architecture

```
Client/src/
  app/
    (marketing)/page.tsx
    (auth)/login/register/...
    (app)/app/layout.tsx          # AppShell
    (app)/app/page.tsx            # Dashboard
    (app)/app/crm/...
    (app)/app/sales/...
    (app)/app/inventory/...
    (app)/app/purchasing/...
    (app)/app/finance/...
    (app)/app/reports/...
    (app)/app/settings/...
  components/
    layout/ (AppShell, Sidebar, Topbar, CommandPalette, OrgSwitcher)
    data/ (DataTable, FilterBar, Pagination, EmptyState, Skeleton)
    docs/ (DocumentHeader, LineItemsEditor, StatusBadge, LinkedTrail)
    charts/ (KpiCard, Sparkline, AgingBars)
    ui/ (Button, Input, Select, Dialog, Dropdown, Tabs, Badge — cva)
  features/
    auth/authSlice.ts
    ui/uiSlice.ts                 # theme, density, sidebarCollapsed
    org/orgSlice.ts               # activeOrg, memberships
  lib/ (api.ts axios+interceptors, cn.ts, money.ts, queryKeys.ts)
  hooks/ (useContacts, useProducts, useInvoices, ...)
  store/index.ts
```

**Redux:** `auth`, `ui`, `org` only — no server lists in Redux.  
**React Query keys:** `['org', orgId, 'contacts', filters]`, `['org', orgId, 'invoice', id]`, etc. Always scope by orgId.  
**Forms:** RHF + zod; mirror Nest DTOs.

---

## 8. Prisma Schema (authoritative)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum MembershipRole { OWNER ADMIN SALES INVENTORY FINANCE VIEWER }
enum DocStatus { DRAFT OPEN SENT PARTIAL PAID VOID CANCELLED }
enum MovementType { ADJUST RECEIVE SHIP TRANSFER RETURN }
enum PaymentMethod { CASH CARD BANK OTHER }
enum ActivityType { NOTE EMAIL CALL MEETING SYSTEM }

model Organization {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  currency     String   @default("USD")
  timezone     String   @default("UTC")
  logoUrl      String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  members      Membership[]
  contacts     Contact[]
  companies    Company[]
  products     Product[]
  warehouses   Warehouse[]
  quotes       Quote[]
  salesOrders  SalesOrder[]
  invoices     Invoice[]
  payments     Payment[]
  vendors      Vendor[]
  purchaseOrders PurchaseOrder[]
  stockMoves   StockMovement[]
  taxRates     TaxRate[]
  auditLogs    AuditLog[]
  sequences    NumberSequence[]
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  avatarUrl    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  memberships  Membership[]
  auditLogs    AuditLog[]
}

model Membership {
  id             String         @id @default(cuid())
  organizationId String
  userId         String
  role           MembershipRole @default(VIEWER)
  organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt      DateTime       @default(now())
  @@unique([organizationId, userId])
}

model NumberSequence {
  id             String @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  key            String // quote, so, invoice, po
  prefix         String
  nextValue      Int    @default(1)
  @@unique([organizationId, key])
}

model TaxRate {
  id             String  @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  rateBps        Int     // 1000 = 10.00%
  isDefault      Boolean @default(false)
}

model Company {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  website        String?
  notes          String?
  contacts       Contact[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([organizationId, name])
}

model Contact {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  companyId      String?
  company        Company? @relation(fields: [companyId], references: [id])
  name           String
  email          String?
  phone          String?
  title          String?
  tags           String[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  quotes         Quote[]
  salesOrders    SalesOrder[]
  invoices       Invoice[]
  @@index([organizationId, name])
}

model Product {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  sku            String
  name           String
  description    String?
  unitPrice      Decimal  @db.Decimal(14, 2)
  costPrice      Decimal  @db.Decimal(14, 2) @default(0)
  reorderPoint   Int      @default(0)
  isActive       Boolean  @default(true)
  attrsJson      Json?
  stockLevels    StockLevel[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([organizationId, sku])
}

model Warehouse {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  code           String
  isDefault      Boolean  @default(false)
  stockLevels    StockLevel[]
  @@unique([organizationId, code])
}

model StockLevel {
  id          String    @id @default(cuid())
  productId   String
  warehouseId String
  quantity    Int       @default(0)
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)
  @@unique([productId, warehouseId])
}

model StockMovement {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  productId      String
  warehouseId    String
  type           MovementType
  quantity       Int          // signed: +in / -out
  reason         String?
  referenceType  String?
  referenceId    String?
  createdAt      DateTime     @default(now())
  createdById    String?
  @@index([organizationId, createdAt])
}

model Quote {
  id             String     @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  number         String
  contactId      String?
  contact        Contact?   @relation(fields: [contactId], references: [id])
  status         DocStatus @default(DRAFT)
  currency       String     @default("USD")
  subtotal       Decimal    @db.Decimal(14, 2)
  taxTotal       Decimal    @db.Decimal(14, 2)
  total          Decimal    @db.Decimal(14, 2)
  notes          String?
  validUntil     DateTime?
  lines          QuoteLine[]
  salesOrder     SalesOrder?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  @@unique([organizationId, number])
}

model QuoteLine {
  id          String  @id @default(cuid())
  quoteId     String
  quote       Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  productId   String?
  description String
  quantity    Int
  unitPrice   Decimal @db.Decimal(14, 2)
  taxBps      Int     @default(0)
  sortOrder   Int     @default(0)
}

model SalesOrder {
  id             String     @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  number         String
  quoteId        String?    @unique
  quote          Quote?     @relation(fields: [quoteId], references: [id])
  contactId      String?
  contact        Contact?   @relation(fields: [contactId], references: [id])
  status         DocStatus @default(OPEN)
  subtotal       Decimal    @db.Decimal(14, 2)
  taxTotal       Decimal    @db.Decimal(14, 2)
  total          Decimal    @db.Decimal(14, 2)
  lines          SalesOrderLine[]
  invoices       Invoice[]
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  @@unique([organizationId, number])
}

model SalesOrderLine {
  id            String     @id @default(cuid())
  salesOrderId  String
  salesOrder    SalesOrder @relation(fields: [salesOrderId], references: [id], onDelete: Cascade)
  productId     String?
  description   String
  quantity      Int
  unitPrice     Decimal    @db.Decimal(14, 2)
  taxBps        Int        @default(0)
  sortOrder     Int        @default(0)
}

model Invoice {
  id             String     @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  number         String
  salesOrderId   String?
  salesOrder     SalesOrder? @relation(fields: [salesOrderId], references: [id])
  contactId      String?
  contact        Contact?   @relation(fields: [contactId], references: [id])
  status         DocStatus @default(DRAFT)
  issueDate      DateTime   @default(now())
  dueDate        DateTime?
  subtotal       Decimal    @db.Decimal(14, 2)
  taxTotal       Decimal    @db.Decimal(14, 2)
  total          Decimal    @db.Decimal(14, 2)
  amountPaid     Decimal    @db.Decimal(14, 2) @default(0)
  lines          InvoiceLine[]
  allocations    PaymentAllocation[]
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  @@unique([organizationId, number])
  @@index([organizationId, status, dueDate])
}

model InvoiceLine {
  id          String  @id @default(cuid())
  invoiceId   String
  invoice     Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  productId   String?
  description String
  quantity    Int
  unitPrice   Decimal @db.Decimal(14, 2)
  taxBps      Int     @default(0)
  sortOrder   Int     @default(0)
}

model Payment {
  id             String        @id @default(cuid())
  organizationId String
  organization   Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  amount         Decimal       @db.Decimal(14, 2)
  method         PaymentMethod @default(BANK)
  paidAt         DateTime      @default(now())
  reference      String?
  allocations    PaymentAllocation[]
  createdAt      DateTime      @default(now())
}

model PaymentAllocation {
  id        String  @id @default(cuid())
  paymentId String
  invoiceId String
  amount    Decimal @db.Decimal(14, 2)
  payment   Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  invoice   Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
}

model Vendor {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  email          String?
  phone          String?
  purchaseOrders PurchaseOrder[]
  createdAt      DateTime @default(now())
}

model PurchaseOrder {
  id             String     @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  number         String
  vendorId       String
  vendor         Vendor     @relation(fields: [vendorId], references: [id])
  status         DocStatus @default(DRAFT)
  subtotal       Decimal    @db.Decimal(14, 2)
  taxTotal       Decimal    @db.Decimal(14, 2)
  total          Decimal    @db.Decimal(14, 2)
  lines          PurchaseOrderLine[]
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  @@unique([organizationId, number])
}

model PurchaseOrderLine {
  id              String        @id @default(cuid())
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  productId       String?
  description     String
  quantity        Int
  quantityReceived Int          @default(0)
  unitPrice       Decimal       @db.Decimal(14, 2)
  sortOrder       Int           @default(0)
}

model AuditLog {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String?
  user           User?    @relation(fields: [userId], references: [id])
  action         String
  entityType     String
  entityId       String?
  metaJson       Json?
  createdAt      DateTime @default(now())
  @@index([organizationId, createdAt])
}
```

---

## 9. NestJS Modules & REST Endpoints

**Modules:** `AuthModule`, `OrgsModule`, `CrmModule`, `CatalogModule`, `InventoryModule`, `SalesModule`, `PurchasingModule`, `FinanceModule`, `ReportsModule`, `AuditModule`, `PrismaModule` (global).

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| POST | `/auth/register` | public | creates User+Org+OWNER |
| POST | `/auth/login` | public | returns access + refresh |
| POST | `/auth/refresh` | public | |
| GET | `/me` | auth | user + memberships |
| GET/PATCH | `/orgs/current` | MEMBER+ | |
| GET/POST | `/orgs/current/members` | ADMIN+ | |
| CRUD | `/contacts` `/companies` | SALES+ | list paginated `?q=&page=` |
| CRUD | `/products` `/warehouses` | INVENTORY+/ADMIN | |
| GET | `/stock` | INVENTORY+ | levels + low filter |
| POST | `/stock/adjustments` | INVENTORY+ | writes StockMovement |
| CRUD | `/quotes` | SALES+ | |
| POST | `/quotes/:id/convert` | SALES+ | → SalesOrder |
| CRUD | `/sales-orders` | SALES+ | |
| POST | `/sales-orders/:id/invoice` | FINANCE+/SALES | |
| CRUD | `/invoices` | FINANCE+ | |
| POST | `/invoices/:id/send` | FINANCE+ | status SENT |
| POST | `/payments` | FINANCE+ | + allocations |
| CRUD | `/vendors` `/purchase-orders` | INVENTORY+/ADMIN | |
| POST | `/purchase-orders/:id/receive` | INVENTORY+ | partial OK |
| GET | `/reports/dashboard` | VIEWER+ | |
| GET | `/reports/ar-aging` | FINANCE+/VIEWER | |
| GET | `/reports/sales` | VIEWER+ | `?from=&to=` |
| GET | `/audit-logs` | ADMIN+ | |

All list endpoints: pagination `{ data, meta: { page, pageSize, total } }`. Validation via class-validator DTOs. Swagger tags per module.

---

## 10. Reporting / Dashboards

- Dashboard: MTD revenue (sum paid allocations), open AR, orders count, low-stock count; 7-day sales sparkline.
- AR aging buckets by dueDate vs today.
- Inventory valuation: `qty * costPrice` sum.
- Sales report: group by day/week; top products.

---

## 11. Security, Perf, A11y, i18n

- **Security:** bcrypt cost ≥10; JWT short TTL; org-scoped queries mandatory; rate-limit auth; audit every money/stock mutation; no mass assignment of organizationId from body.
- **Perf:** DB indexes above; select only needed fields; React Query staleTime 30s lists; virtualize tables >100 rows (stretch `@tanstack/react-virtual`).
- **A11y:** focus rings, dialog focus trap (radix), table headers scope, contrast AA, skip link.
- **i18n:** English MVP; structure copy in `messages/en.json` for later; dates via date-fns; money via `Intl.NumberFormat`.

---

## 12. Build Milestones

1. Auth + Org + AppShell + cmd-K stub  
2. Products + Warehouses + Stock adjust  
3. CRM contacts/companies  
4. Quote → SO → Invoice → Payment  
5. Purchasing receive  
6. Dashboard + AR aging + seed  
7. RBAC polish + audit + Swagger  
8. Density/theme + CSV export + empty states  

---

## 13. Acceptance Checklist

- [ ] Register creates org; second user can be invited/added with role  
- [ ] Quote converts to SO preserving lines; SO invoices correctly  
- [ ] Payment allocates and flips invoice to PAID/PARTIAL  
- [ ] PO receive increments StockLevel and logs StockMovement  
- [ ] Low-stock filter works from reorderPoint  
- [ ] Cross-org ID access returns 404/403  
- [ ] Dashboard KPIs match seeded math  
- [ ] Dark/light + compact density persist  
- [ ] Keyboard: `/` or Cmd-K opens palette; Esc closes dialogs  
- [ ] `docker compose up -d` + migrate + seed works on clean machine  
