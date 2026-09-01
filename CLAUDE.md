# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

KAIDEEDER — a multi-tenant restaurant/bar POS + stock management SaaS (Next.js 15 App Router,
single deployment serving many stores). Primary market is Laos (currency LAK, Lao/Thai UI text
throughout the codebase — variable comments and enum labels are frequently in Thai). Every store
is a `Tenant`; a separate `AdminUser` hierarchy runs the SaaS platform itself (billing, tenant
suspension, plan config) outside of any tenant.

## Commands

```bash
npm run dev              # Next.js dev server
npm run build            # prisma generate && next build
npm run start            # start built app (standalone output)
npm run lint             # next lint

npm run db:generate      # prisma generate
npm run db:migrate       # prisma migrate dev (local schema changes)
npm run db:push          # prisma db push (no migration history — used in prod deploys)
npm run db:studio        # Prisma Studio
npm run db:seed          # tsx prisma/seed.ts — seeds one tenant ("store-001") with locations/categories/users
```

There is no automated test suite (no `test` script, no Jest/Vitest config). `qa-test-runner.js`
and the various `fix-*.js` / `reset-*.js` / `patch-*.js` scripts in the repo root are ad-hoc,
one-off ops scripts run manually with `node <file>.js` against a live DB — they are not part of
`npm run build`/CI and most are single-use artifacts from past data fixes. Don't treat them as
reusable utilities or wire them into the app; check with the user before running one, since they
mutate production-shaped data directly.

`scripts/` (run with `tsx` or `node`) contains similar one-off seeding/backfill/migration
utilities (e.g. `backfill-tenant.ts`, `seed-bom.ts`, `import-stock-pack.ts`) — same caveat.

## Database

- **Source of truth: MySQL/MariaDB.** `prisma/schema.prisma` has `provider = "mysql"`, and both
  `.env.example` and `DEPLOY.md` configure a `mysql://` `DATABASE_URL`. Production runs on
  MariaDB via Plesk (see `DEPLOY.md`).
- `docker-compose.yml` at the repo root spins up **Postgres** — this is stale/unused for the
  current schema and will not work with `prisma db push`/migrations as-is. Don't use it for local
  DB setup; point `DATABASE_URL` at a local MySQL/MariaDB instance instead.
- `prisma/migrations/` exists but production deploys use `prisma db push` (no migration
  history applied on the server) — see `DEPLOY.md` step 6 and the `db:push:prod` script.
- `src/lib/prisma.ts` wraps `PrismaClient` with a retry middleware for dropped idle connections
  (`$use`), a leftover concern from an earlier Railway-hosted deployment (`railway.json` and its
  comment about "Railway TCP proxy" still reference that setup even though prod is now Plesk).

## Multi-tenancy — the one rule that matters everywhere

Nearly every model in `prisma/schema.prisma` carries a `tenantId` and every store-facing query
**must** be scoped by it. There are two completely separate auth systems, and mixing them up is
the most common way to break tenant isolation:

- **Store users** (`User` model, roles below) — JWT in the `token` cookie, signed/verified via
  `src/lib/auth.ts`. Payload always includes `tenantId`.
- **Platform admins** (`AdminUser` model — SUPERADMIN/ADMIN1-3) — JWT in a *separate*
  `admin_token` cookie, signed/verified via `src/lib/admin-auth.ts`. Never mix the two cookies or
  secrets (`JWT_SECRET` vs `ADMIN_JWT_SECRET`).

All store API routes wrap their handler in `withAuth` from `src/lib/api.ts`:

```ts
export const GET = withAuth<any>(async (req, context) => {
  const { tenantId } = context   // always inject this into every prisma where-clause
  ...
}, ['OWNER', 'MANAGER'])          // optional: role list, or { permission: 'PRODUCT_EDIT' }
```

`withAuth` verifies the JWT, resolves `tenantId` from the token (never from a request param —
that would let one tenant query another's data), and optionally gates by role list or a
`Permission` from `src/lib/permissions.ts`. Use `ok(data)` / `err(message, status)` from the same
file for consistent JSON envelopes (`{ success, data }` / `{ success, error }`).

Admin-side routes use the equivalent `withAdminAuth` from `src/lib/admin-auth.ts` (supports a
`minRole` hierarchy: SUPERADMIN > ADMIN1 > ADMIN2 > ADMIN3).

Store roles (`Role` enum) and their permission sets live in `src/lib/permissions.ts`
(`can(role, permission)` / `ROLE_PERMISSIONS`) — this is the single source of truth for RBAC, used
both server-side (`withAuth({ permission: ... })`) and client-side (`usePermission` hook in
`src/hooks/usePermission.ts`).

Public/unauthenticated routes (QR menu, delivery pages, table QR ordering) live under
`src/app/api/public/**` and the `/q`, `/m`, `/d` route groups — these resolve the tenant from a
`tenantCode` route param or table token instead of a JWT, and `src/middleware.ts` explicitly
excludes them from the login-redirect guard.

## Domain model / core flows

The schema (`prisma/schema.prisma`) is organized in blocks (see its section comments) — read it
first when working on any domain area, it's the map of the whole system:

- **Master data**: `Category`, `Product` (a `Product` can be a sellable menu item, raw material,
  prep/semi-finished good, packaging, or "entertain" freebie — see `ProductType`), `Location`
  (physical/logical stock locations: warehouses, kitchen stock, bar stock, freezer — see
  `LocationType`).
- **Inventory**: `Inventory` is the current on-hand quantity per `(product, location)`.
  `StockMovement` is the append-only ledger of every quantity change (`MovementType`: PURCHASE,
  TRANSFER, SALE, ADJUSTMENT, WASTE, OPENING, RETURN, PRODUCTION_IN/OUT). Treat `StockMovement` as
  the audit trail — inventory balances should always be derivable from it.
- **Recipes / BOM**: `Recipe` + `RecipeBOM` define how much of each `Product` (ingredient) is
  consumed, from which `Location`, to produce one menu item. `PrepRecipe`/`PrepRecipeLine`/
  `PrepProduction` are a similar but separate concept for *prep* items (e.g. turning raw pork into
  "marinated pork" as its own trackable stock item) — don't conflate the two BOM systems.
- **Order → stock consumption**: closing a POS order (`POST /api/pos/orders/[id]/close`) is where
  BOM consumption actually happens — it walks each `OrderItem`'s `RecipeBOM`, tries to deduct
  ingredient stock from the right `Location`, and on any failure (no BOM defined, missing unit
  conversion, insufficient stock, wrong warehouse, etc.) writes a `ConsumeFailLog` row rather than
  blocking the sale, so managers can reconcile later (`/consume-fail` UI + `ConsumeFailType`/
  `FailLogStatus` enums). This "log and continue" pattern is intentional — POS checkout must never
  hard-fail because of a stock/BOM data problem.
- **Unit conversion**: `UomConversion` (per-`Product`) and the newer `ItemUnitConversion` (per-
  `InventoryItem`, Phase 1 catalog) both convert purchase units → usage units (e.g. 1 bag = 1000g).
  Two parallel systems exist because of an in-progress migration — see "Inventory Catalog" below.
- **Purchasing / transfers / adjustments**: `PurchaseOrder`→`PurchaseItem` (goods receipt),
  `StockTransfer`→`TransferItem` (location to location), `StockAdjustment`→`AdjustmentItem`
  (manual correction), `StockCount`→`StockCountItem` (physical count sessions: draft → in-progress
  snapshot → completed → approved/applied) — all four are variations on the same "stage items,
  then commit a `StockMovement` batch" pattern.
- **Sales import**: `SalesImport`/`SalesImportItem` ingest POS/Excel sales data from external
  systems and reconcile against recipes to retroactively deduct stock — a fallback path for stores
  not using the POS directly.
- **SKU master / dedup**: `ProductAlias` (alternate names for a product, used for import
  auto-matching), `SkuSuggestion` (approval queue for new/uncertain SKUs surfaced during import,
  scored by `src/lib/sku-matcher.ts`).
- **Inventory Catalog (Phase 1, newer, partially parallel to `Product`)**: `InventoryItem` is a
  richer raw-material master (role: RAW/PREP/SUPPLY/SERVICE; protein family, species, cut, form
  state, etc.) with its own aliasing (`ItemAlias`), unit conversions (`ItemUnitConversion`), AI
  classification suggestions (`AiItemClassification`, via `src/lib/inventory/ai-classifier.ts`),
  rule-engine validation issues (`ValidationIssue`), and AI recommendations
  (`AiRecommendation`) — all under `src/app/(dashboard)/inventory-catalog` and `src/app/api/items`.
  `Product.inventoryItemId` links a sellable product back to its catalog item. When touching stock
  logic, check whether you're in the legacy `Product`-only path or the newer `InventoryItem`
  catalog path — they coexist.
- **POS / kitchen / delivery**: `DiningTable` → `Order` → `OrderItem` (`KitchenStatus` per-item:
  PENDING→ACCEPTED→COOKING→READY→SERVED). `OrderType` (DINE_IN/DELIVERY/PICKUP) branches into
  `DeliveryInfo` (rider assignment, channel like GRAB/LINEMAN/WALKIN, status tracking). Real-time
  updates (new order alerts, kitchen queue, delivery status) go through an in-process
  `EventEmitter` singleton (`src/lib/events.ts`, stored on `globalThis` to survive dev HMR) fed to
  clients via `src/app/api/events` (SSE) — this is single-process pub/sub, not a message broker,
  so it won't fan out across multiple server instances/PM2 workers.
- **Business day boundary**: stores can close after midnight; `src/lib/businessDate.ts`
  (`getBusinessDate`/`getBusinessDayRange`) buckets orders into the correct "business day" using
  each tenant's `closingHour` (fixed UTC+7 assumption — Asia/Vientiane), not calendar midnight.
  Always use these helpers for daily reports/summaries instead of raw date-truncation.
- **SaaS billing** (separate from any tenant's own money): `Plan`, `Subscription`,
  `Wallet`/`WalletLedger` (immutable append-only ledger — **never UPDATE or DELETE a
  `WalletLedger` row**, balance is derived from summing it), `TopupRequest` (manual top-up
  approval queue reviewed by an `AdminUser`), `AuditLog` (every admin/significant tenant-user
  action should produce one row).

## Conventions

- **Path alias**: `@/*` → `src/*` (see `tsconfig.json`).
- **API routes**: co-located under `src/app/api/**/route.ts` following REST-ish verbs; wrap with
  `withAuth`/`withAdminAuth`, validate bodies with `zod`, respond with `ok()`/`err()`.
- **tenantId discipline**: when writing any new query/mutation touching a tenant-scoped model,
  filter/inject `tenantId` explicitly — never rely on a foreign key chain alone to enforce tenant
  isolation.
- **i18n**: `src/lib/i18n.ts` + `src/lib/i18n/translations.ts` provide a `getDict(lang)` →
  translation function (`Lang`: `th`/`lo`/`both`), exposed app-wide via `useT()` /
  `TenantContext` (`src/context/TenantContext.tsx`), which also carries per-tenant currency
  (`formatCurrency`/`currencySymbol` in `src/lib/currency.ts`, LAK vs THB) and store branding.
  Don't hardcode Thai/Lao/English strings in components that need to respect a tenant's chosen
  language — go through `t()`.
- **Route groups**: `src/app/(dashboard)/**` is the authenticated back-office (products,
  inventory, purchasing, reports, settings, etc.), gated by `src/middleware.ts` (redirects to
  `/login` if no `token` cookie — actual authorization happens per-API-route via `withAuth`).
  `src/app/admin/**` is the separate platform-admin panel (`admin_token` cookie). `q`/`m`/`d`
  route groups are public customer-facing (table QR ordering, QR menu, delivery tracking) and are
  explicitly excluded from the middleware's auth redirect.
- **Delivery subdomain routing**: `src/middleware.ts` also rewrites `delivery.<domain>` traffic to
  `/d/<tenantCode>` — currently hardcoded to a single default tenant (`DEFAULT_TENANT_CODE =
  'kaideeder'`), so this subdomain trick doesn't yet generalize to arbitrary tenants.
- **Database admin UI**: `/admin/database` mounts `@premieroctet/next-admin`
  (`src/lib/next-admin-options.ts`) as a generic CRUD browser over the Prisma schema — separate
  from the hand-built `/admin/**` platform pages.
- **AI features**: `src/lib/ai-router.ts` picks a model tier (cheap/mid/pro) by keyword-scoring
  the conversation (financial/complex/simple Thai+English keyword regexes) before calling out via
  `src/lib/ai-config.ts`; used by the AI chat assistant (`/ai-chat`, `src/app/api/ai/chat`) and
  the inventory catalog's item classifier (`src/lib/inventory/ai-classifier.ts`).

## Deployment

Production is a Plesk-managed Hostinger VPS running Node 20 + MariaDB behind PM2 and an nginx
reverse proxy — **`DEPLOY.md` is the authoritative, detailed deploy/redeploy/troubleshooting
runbook** (DNS, `.env.production` layout, `npx prisma db push`, `npm run build`, the standalone
static-asset copy step, PM2 commands, SSL, nginx config). Read it before making deployment-related
changes. Key points to know without opening it:

- Next.js `output: 'standalone'` (`next.config.js`) — after `next build`, static assets and
  `public/` must be manually copied into `.next/standalone/` (`npm run copy-static`, or the
  combined `npm run deploy` script) or the deployed site serves with no CSS/JS.
- Deployment itself is triggered by Plesk's Git integration pulling from `main` on push (webhook),
  *not* by `.github/workflows/deploy.yml` — that workflow is a no-op notification step only.
- `ecosystem.config.js` (PM2) has a hardcoded `cwd` that must match the real server path.
