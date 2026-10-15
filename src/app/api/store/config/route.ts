export async function GET() {
  return Response.json(
    {
      paypal: process.env.PAYPAL_CLIENT_ID ?? null,
      mercadopago: process.env.MERCADOPAGO_PUBLIC_KEY ?? null,
      turnstile: process.env.TURNSTILE_SITE_KEY ?? null,
      currency: (process.env.SHOP_CURRENCY ?? "mxn").toUpperCase(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
