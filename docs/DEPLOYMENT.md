# Production deployment

## Target

- Cloudflare Worker: `prodrillos-pos`
- Custom domain: `pos.prodrillos.com` (configured in `wrangler.toml`)
- GitHub: `Monster-ProShop/ProDrillOS-POS`, deployments on `main`
- Currency: MXN; timezone: America/Mexico_City
- Neon project: `cool-glitter-16609092` (ProDrillOS POS)
- Production branch: `br-mute-firefly-b4ctfqvh`
- Development branch: `br-mute-band-b4dafcfe`

The local ignored `.env` points at development. Never run tests against production. Both branches have the migrations applied. Production has no sample inventory, customers, services, or transactions.

## Cloudflare account and custom domain

1. Sign in using `pnpm exec wrangler login`. Use the Cloudflare account containing the active `prodrillos.com` zone.
2. Set Worker secrets with `pnpm exec wrangler secret put NAME` or the Cloudflare dashboard. Use a production **pooled** Neon URL for `DATABASE_URL`, and distinct strong `POS_USERNAME` / `POS_PASSWORD` credentials.
3. Build on Linux: `pnpm build:cloudflare`. The GitHub workflow does this. Windows builds of the Next.js application work, but OpenNext's package tracing requires directory symlinks; Windows hosts without symlink permissions must use Linux CI or WSL.
4. Deploy with `pnpm deploy:cloudflare`. The custom-domain route in Wrangler asks Cloudflare to provision domain routing and managed TLS. It does not require a manually invented CNAME target. Inspect any existing record before replacing it.
5. Verify HTTPS at `https://pos.prodrillos.com/store`, public inventory, staff authentication at `/pos`, and authenticated mutations. A configured route is not proof that DNS/TLS is live.

This application uses Workers with OpenNext because it includes server routes; it is not a static Pages export. The deprecated `middleware.ts` filename is intentional for OpenNext's supported edge middleware path; Next.js `proxy.ts` uses an experimental Node middleware path in this adapter. APIs independently enforce authorization as well.

## GitHub Actions

The workflow tests migrations against PostgreSQL 17, runs tests/type checking, builds the Worker on Ubuntu, and uploads the build artifact. Deployment is enabled only when repository variable `CLOUDFLARE_DEPLOY_ENABLED=true`; this prevents an incompletely configured account from being treated as a working production deployment. Once enabled, pushes to `main` deploy automatically.

Set production environment secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | CI token restricted to the target account's Workers deployment and zone routing |
| `CLOUDFLARE_ACCOUNT_ID` | Account owning the Worker and domain |
| `DATABASE_URL_UNPOOLED` | Direct production URL used only by migrations |

Worker secrets are separate from GitHub secrets. Set `DATABASE_URL`, `POS_USERNAME`, `POS_PASSWORD`, provider credentials, and email secrets on the Worker. `SHOP_CURRENCY=mxn` in Wrangler must match build-time `NEXT_PUBLIC_SHOP_CURRENCY=MXN`; CI defaults to MXN.

## Payments and email

| Integration | Worker configuration |
| --- | --- |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`; `PAYPAL_ENV=sandbox` or `live` |
| MercadoPago | `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`; `MERCADOPAGO_ENV=sandbox` or `live` |
| Turnstile | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`; allow `pos.prodrillos.com`; checkout action is `checkout` |
| Email | `RESEND_API_KEY`, verified-domain `EMAIL_FROM` |
| Existing Stripe checkout | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

Register PayPal `PAYMENT.CAPTURE.COMPLETED` at `/api/webhooks/paypal` and MercadoPago payment notifications at `/api/webhooks/mercadopago`. The server verifies signatures, re-fetches provider records, and checks amount/currency/reference before completing a sale. Return URLs cannot mark an order paid. Turnstile is mandatory for production online checkout and rejects hostname/action mismatches.

No real payments or emails have been sent during development. Run provider sandbox transactions, interrupted-payment recovery, duplicate callbacks, and webhook retry tests before switching live credentials. Use Cloudflare rate limiting for staff authentication and checkout endpoints.

## Operational limits before live launch

- Staff access preserves the existing shared Basic Auth mechanism. HTTPS is mandatory; provision per-user roles and audit trails if several employees need distinct privileges.
- Online checkout is explicitly pro-shop pickup. Shipping quotes/addresses, tax calculation, discounts, returns/refunds, and fiscal CFDI invoicing are not implemented. Receipts are purchase notes.
- PayPal/MercadoPago pending orders conservatively retain reserved stock. There is no automatic reservation expiry/reconciliation job yet. Staff must reconcile abandoned/ambiguous payments with the provider before releasing stock. Never release merely because local time expired.
- Proposal deposits are recorded by staff against a verified reference; the proposal portal does not charge deposits. Proposal tracking refreshes shop events every 10 seconds and links to carrier tracking; carrier event APIs are not integrated.
- Inventory refreshes every 15 seconds in the storefront. Deductions are transactional and immediate in PostgreSQL; browser updates use polling, not a WebSocket stream.
- Barcode camera scanning depends on browser BarcodeDetector support and camera permission. USB keyboard scanners and manual SKU entry are the fallback.
- Email links are bearer links; anyone with a receipt/proposal URL can view that document. Public responses omit customer contacts and notes. Avoid forwarding links to unintended recipients.
- Run operational backup/restore and monitoring checks, and confirm provider sandbox + Cloudflare runtime behavior before accepting live sales.

References: [Cloudflare OpenNext](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/), [Neon driver](https://neon.com/docs/serverless/serverless-driver), [PayPal Checkout](https://developer.paypal.com/checkout/integrate), [Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Resend idempotency](https://resend.com/changelog/idempotency-keys).
