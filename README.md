# ProDrillOS POS

Next.js App Router + TypeScript, Tailwind, shadcn-style Radix components and Lucide. Neon PostgreSQL provides one inventory ledger for the staff POS and public storefront. Deployment targets Cloudflare Workers at **pos.prodrillos.com**. Currency is **MXN**.

## Start locally

Use Node 22.12+ or Node 24 and the pinned pnpm version.

```powershell
pnpm install --frozen-lockfile
# For a new clone, copy .env.example to .env and configure credentials.
# This workspace already has an ignored .env connected to Neon's development branch.
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Open `/store` for the public shop or `/pos` for staff checkout. Local staff credentials are in the ignored `.env`; they are not committed or displayed in logs.

## Modules

| Route | Function |
| --- | --- |
| `/store` | In-stock equipment, category-specific filters, cart, PayPal and MercadoPago SDK checkout |
| `/pos` | USB/camera scanning, products and services, customer assignment, cash/card recording, existing Stripe links |
| `/inventory` | Product creation/editing, stock thresholds, archive |
| `/receiving` | Idempotent barcode receiving, variant attributes, low-stock list, supplier reorder CSV |
| `/services` | Service pricing, labor add-ons, fixed-price service bundles |
| `/customers` | Contacts, notes and append-only fitting/spec history |
| `/proposals` | Draft packages, public approval links, deposits, fulfillment and tracking |
| `/proposal/[token]` | Customer approval and automatically refreshed shop progress |
| `/receipt/[token]` | Branded printable purchase note and WhatsApp/email sharing |
| `/invoices` | Existing supplier CSV import |
| `/reports` | Completed sales by payment method and business date |

Staff can send branded receipt/proposal emails after configuring Resend. Email drafts and WhatsApp share links also work without an email service.

## Schema and branding

The additive SQL migration is `prisma/migrations/20261014000000_commerce/migration.sql`; the complete schema is `prisma/schema.prisma`. Existing Product and Transaction table names and historical categories are retained. Products use `name` for title, `cost` for cost price, and `low_stock_threshold` for the minimum-stock threshold. Monetary values are integer cents. Each sellable variant has its own SKU/barcode and stock row.

The schema adds bowling-ball/shoe/bag details, service bundles, customers and spec history, proposal events, receiving movements, and payment/receipt references. SQL CHECK constraints guard nonnegative stock, valid amounts, and exactly one product or service per sale line. Receipt tokens are backfilled for existing sales.

Shared branding: `src/lib/brand.ts`, `src/app/globals.css`, and the official `public/brand/prodrillos-logo.png` asset retained from the prior verified starter.

## Verification

```powershell
pnpm typecheck
pnpm test
pnpm build
# With TEST_DATABASE_URL set to a disposable, migrated database:
pnpm test
# With a running server on the same disposable database:
$env:TEST_API_BASE = 'http://localhost:3000'
pnpm exec tsx --test tests/api-flow.test.ts
# On Linux / CI:
pnpm build:cloudflare
```

Tests cover migration of an existing sale, constraints, concurrent inventory contention, checkout retries and rollback, services/customer assignment, provider settlement validation, signature checks, access boundaries, barcode receiving, receipt privacy, and idempotent proposal approval. Database tests skip without TEST_DATABASE_URL; HTTP tests skip without TEST_API_BASE. The HTTP test creates and removes only its own test records.

See [the development plan](docs/DEVELOPMENT.md) and [deployment configuration, account setup and remaining launch requirements](docs/DEPLOYMENT.md). Provider sandbox tests and a real Cloudflare deployment are required before live sales. The earlier starter documentation is retained in `docs/LEGACY-STARTER.md` for the existing Stripe/import behavior.
