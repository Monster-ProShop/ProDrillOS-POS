# ProDrillOS POS development plan

1. Preserve the existing Next.js application and historical transactions. Add an additive PostgreSQL migration for product attributes, customers, services, proposals and payment references. Keep money in integer cents.
2. Centralize official brand assets and colors. Add accessible, reusable UI components and separate public shopping from staff navigation.
3. Configure Neon serverless connectivity, Cloudflare Workers through OpenNext, and GitHub Actions. Never put credentials in Wrangler or source control.
4. Add barcode receiving, service pricing and bundles, customer/spec records, stock alerts and reorder exports.
5. Extend atomic checkout to services and customers, with immutable receipt snapshots and idempotent retries.
6. Add proposals with private approval tokens, explicit lifecycle transitions and customer tracking pages.
7. Add in-stock storefront filters and server-created PayPal/MercadoPago payment sessions. Verify provider amounts and currency before completion.
8. Verify type safety, database constraints, stock concurrency, public/staff access boundaries and production builds. Test provider sandbox payments and Cloudflare runtime before enabling live sales.

The existing PostgreSQL table names and legacy product categories are retained for compatibility. New category details attach to the same Product rows; both storefront and POS deduct the same stock.
