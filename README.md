# ProDrillOS POS

```powershell
# Git initialization and remote setup (already done in this workspace).
git init
git remote add origin https://github.com/Monster-ProShop/ProDrillOS-POS.git
# If origin already exists, inspect it with git remote -v instead of adding it again.

# For a fresh clone of this generated starter:
git clone https://github.com/Monster-ProShop/ProDrillOS-POS.git
cd ProDrillOS-POS
npm install
Copy-Item .env.example .env
# Edit .env: database URL, a strong staff password, Stripe test keys, currency, and timezone.
docker compose up -d
npx prisma generate
npx prisma migrate deploy
npm run dev

# Publish local changes after reviewing them:
git add .
git commit -m "Build ProDrillOS POS starter"
git push -u origin HEAD

# To generate an empty equivalent framework project elsewhere:
npx create-next-app@latest prodrillos-pos --ts --tailwind --app --src-dir --import-alias "@/*" --use-npm
cd prodrillos-pos
npm install @prisma/client@7 @prisma/adapter-pg@7 pg stripe@20 csv-parse@6 zod@4 qrcode.react dotenv
npm install -D prisma@7 @types/pg tsx
npx prisma init --datasource-provider postgresql
# Then copy this repository's schema, migration, configuration, and src files.
```

Use Node.js 22.12+ or 24 LTS. This repository includes a pnpm lockfile; for reproducible installation use pnpm 11.19.0 and `pnpm install --frozen-lockfile`. npm commands are provided because they are widely available; npm install resolves the package.json ranges independently. The PostgreSQL container credentials are for local development only.

The repository is private: [Monster-ProShop/ProDrillOS-POS](https://github.com/Monster-ProShop/ProDrillOS-POS). No database, Stripe account, or production deployment is created by this starter.

## Database schema

The complete schema is in [prisma/schema.prisma](prisma/schema.prisma); the generated migration plus PostgreSQL CHECK constraints is in [prisma/migrations/20260906000000_init/migration.sql](prisma/migrations/20260906000000_init/migration.sql). Apply the migration with `prisma migrate deploy`, not `db push`, to retain the custom constraints.

- **Product**: requested fields, unique normalized SKU, category enum, plus active flag and optimistic version. Prices and costs are integer cents: 19999 means 199.99 in the configured currency. Archive is the delete operation so historic sale lines retain their product relationship.
- **Transaction**: requested fields plus currency, payment completion date, idempotency key and request hash, Stripe session ID/URL, and reservation expiry.
- **TransactionItem**: required product and transaction foreign keys with RESTRICT deletion; positive quantity, price snapshot, name snapshot, and unique transaction/product pair.
- **InvoiceLog**: requested fields plus invoice number, canonical content hash, and imported SKU count. Unique vendor/invoice and vendor/content pairs prevent accidental double receiving. Only successful imports are logged; invalid imports return an error and roll back completely.

`PENDING → COMPLETE` and `PENDING → EXPIRED` are terminal payment transitions in application code. Cash transactions complete immediately. The database rejects negative money/stock and invalid quantities; the checkout service computes the total from server-owned prices in the same transaction as the sale lines.

## Five core modules

1. **Inventory dashboard** — [UI](src/app/inventory/page.tsx), [API](src/app/api/products/route.ts). GET, POST, PATCH, DELETE at /api/products. Form validation, low-stock indicators, search, and archive. PATCH/DELETE require the version the cashier read; inventory changes increment it so a stale edit cannot overwrite receiving or checkout.
2. **Invoice importer** — [UI](src/app/invoices/page.tsx), [API](src/app/api/invoices/route.ts), [parser](src/lib/invoices.ts). Multipart POST includes file, vendor, invoice_number. Accepts sku,quantity CSV headers, combines duplicate SKU rows, normalizes SKUs, and atomically increments stock. Unknown/inactive SKUs, invalid quantities, duplicate invoices, or stock limits roll back the entire file. Adapt vendor-specific exports to this documented format before uploading.
3. **POS checkout** — [UI](src/app/pos/page.tsx), [API](src/app/api/checkout/route.ts), [service](src/lib/checkout.ts). POST receives product IDs/quantities and CASH or STRIPE. The server uses conditional UPDATE statements inside a Prisma database transaction to reserve available stock, reads authoritative prices, and creates the sale and lines. Row locks are taken in sorted product order. An advisory transaction lock serializes retries with the same idempotency key, and a changed request with a reused key is rejected. The browser saves the request before sending it.
4. **Stripe link and QR** — [service](src/lib/stripe.ts), [payment recovery API](src/app/api/payments/route.ts), [webhook](src/app/api/stripe/webhook/route.ts). A single-use Stripe Checkout Session supplies the payment URL rendered as a QR code. This intentionally uses the Checkout Sessions API rather than reusable Stripe Payment Links, so the same reserved cart cannot be purchased multiple times. Signature verification uses the untouched raw request body. Paid webhooks validate sale ID, session, currency, and amount before marking COMPLETE; expiry restores reserved stock once.
5. **Daily conciliation** — [UI](src/app/reports/page.tsx), [API](src/app/api/reports/daily/route.ts), [query service](src/lib/reports.ts), [standalone SQL](sql/daily-conciliation.sql). GET /api/reports/daily?date=YYYY-MM-DD groups completed sales by CASH/STRIPE and currency, using local midnight boundaries in SHOP_TIMEZONE. Completion time, rather than cart creation time, determines the business date.

### Checkout request example

```json
{
  "idempotency_key": "11111111-1111-4111-8111-111111111111",
  "payment_method": "STRIPE",
  "items": [
    { "product_id": "22222222-2222-4222-8222-222222222222", "quantity": 1 }
  ]
}
```

Use a real product UUID and a fresh UUID for each new sale. Repeat the same body and key on ambiguous network failures. Never make a new sale to retry payment setup for an existing reservation.

### Stripe local setup

```powershell
stripe login
stripe listen --events checkout.session.completed,checkout.session.expired --forward-to localhost:3000/api/stripe/webhook
# Copy the displayed whsec_ value into STRIPE_WEBHOOK_SECRET in .env and restart Next.js.
```

Set STRIPE_SECRET_KEY to a test-mode secret key. Use a real test checkout created by the POS to exercise the webhook: generic Stripe CLI fixtures do not carry the application's transaction ID and amounts. Use Stripe's documented test card 4242 4242 4242 4242 with a future expiry and any three-digit CVC in test mode only.

For deployment, configure an HTTPS endpoint at /api/stripe/webhook with the same two event types and the endpoint's own signing secret. APP_URL must be the public HTTPS origin. The webhook authenticates by Stripe signature; other staff screens and APIs require the credentials in POS_USERNAME/POS_PASSWORD.

A failed Stripe request returns the existing reserved sale and recovery instructions; stock is not blindly restored because Stripe may already have created a payable session. Retry setup uses the same Stripe idempotency key and fixed expiry. Setup retries stop when fewer than 30 minutes remain. Pending payments remain visible after refresh. **Check payment status** retrieves the authoritative session; it can recover an unrecorded session ID or release an orphan only after the fixed expiry plus five minutes and a successful Stripe session lookup. No background sweep is scheduled by this starter. Configure an authenticated operational job or use the pending-payment screen to recover missed expiry webhooks. Very old completions without an available Stripe event timestamp require manual review.

Cashiers should confirm the server-returned total and payment status before releasing goods. Discard a saved checkout request only after confirming it failed or reviewing the resulting sale; an ambiguous cash request may already have completed.

## ProDrillOS branding

The official website could not be retrieved, and no existing brand files were present. The text wordmark and lime/dark-green palette are **provisional**, not a claimed match to ProDrillOS.com.

- Put the official logo in public/brand/ and set NEXT_PUBLIC_BRAND_LOGO.
- Replace --brand, --brand-ink, --canvas, --surface, --border, --text, and --muted in src/app/globals.css with the official palette.
- Configure SHOP_CURRENCY and NEXT_PUBLIC_SHOP_CURRENCY consistently before the first sale. This starter assumes a single shop and a two-decimal currency (USD, MXN, CAD, EUR, GBP).

## File structure

```text
prisma/
  schema.prisma
  migrations/20260906000000_init/migration.sql
src/
  app/
    inventory/page.tsx
    invoices/page.tsx
    pos/page.tsx
    reports/page.tsx
    payment-return/page.tsx
    api/
      products/route.ts
      invoices/route.ts
      checkout/route.ts
      payments/route.ts
      stripe/webhook/route.ts
      reports/daily/route.ts
    layout.tsx
    globals.css
    page.tsx
  components/nav.tsx
  lib/
    db.ts
    http.ts
    validation.ts
    invoices.ts
    checkout.ts
    stripe.ts
    reports.ts
    client.ts
  proxy.ts
sql/daily-conciliation.sql
examples/invoice.csv
tests/validation.test.ts
tests/database.test.ts
compose.yaml
prisma.config.ts
.env.example
```

## Verification

```powershell
npx prisma validate
npx prisma generate
npm run typecheck
npm test
npm run build

# Integration tests MUST target a separate disposable PostgreSQL database.
# Apply the migration to that database first, then:
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/prodrillos_test"
npm test
```

The database integration suite is skipped when TEST_DATABASE_URL is absent. It checks concurrent stock contention, rollback of a partially reserved cart, idempotent retry behavior, PostgreSQL constraints, and repeat webhook handling.

This is a functional single-shop starter, not the full ProDrillOS production platform. Staff protection uses HTTP Basic Auth and must run over HTTPS; replace it with ProDrillOS session auth and roles when integrating. Configure reverse-proxy upload limits (about 2 MB plus multipart overhead) and rate limits. Audit logs for staff mutations, returns/refunds, sales tax, discounts, cash drawer balancing, Stripe fee/payout matching, multi-location inventory, automated expiry recovery, and multi-tenant isolation are not implemented. The daily report is gross sales, not a bank/payout reconciliation.

References: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Prisma 7 configuration](https://docs.prisma.io/docs/orm/reference/prisma-config-reference), [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create), [Stripe fulfillment/webhooks](https://docs.stripe.com/checkout/fulfillment).
