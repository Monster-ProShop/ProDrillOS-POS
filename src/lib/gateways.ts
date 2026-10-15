import { createHmac, timingSafeEqual } from "node:crypto";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { toCents } from "@/lib/validation";

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new HttpError(503, `Payment configuration missing: ${name}`);
  return v;
}
export function checkGateway(method: string) {
  if (method === "PAYPAL") {
    required("PAYPAL_CLIENT_ID");
    required("PAYPAL_CLIENT_SECRET");
  } else if (method === "MERCADOPAGO") {
    required("MERCADOPAGO_ACCESS_TOKEN");
    required("MERCADOPAGO_WEBHOOK_SECRET");
    required("MERCADOPAGO_PUBLIC_KEY");
  }
}
const paypalBase = () =>
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
export async function paypal(path: string, body?: unknown, key?: string) {
  const auth = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${required("PAYPAL_CLIENT_ID")}:${required("PAYPAL_CLIENT_SECRET")}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  if (!auth.ok) throw new HttpError(502, "PayPal authentication unavailable");
  const { access_token } = (await auth.json()) as { access_token: string };
  const response = await fetch(`${paypalBase()}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
      ...(key ? { "PayPal-Request-Id": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new HttpError(
      502,
      "PayPal request failed. Keep the same checkout request and retry.",
    );
  return response.json();
}
const mp = () =>
  new MercadoPagoConfig({
    accessToken: required("MERCADOPAGO_ACCESS_TOKEN"),
    options: { timeout: 15000 },
  });

export async function setupGateway(id: string) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`gateway:${id}`},0))`;
      const sale = await tx.transaction.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });
      if (sale.provider_id || sale.status !== "PENDING") return sale;
      const base = new URL(required("APP_URL")).origin;
      if (sale.payment_method === "PAYPAL") {
        // PayPal's retry key has a finite lifetime. Never recreate an old ambiguous order.
        if (Date.now() - sale.timestamp.getTime() > 5 * 60 * 60 * 1000)
          throw new HttpError(
            409,
            "Payment setup requires staff reconciliation",
          );
        const result = await paypal(
          "/v2/checkout/orders",
          {
            intent: "CAPTURE",
            purchase_units: [
              {
                reference_id: sale.id,
                custom_id: sale.id,
                invoice_id: sale.id,
                amount: {
                  currency_code: sale.currency.toUpperCase(),
                  value: (sale.total_amount / 100).toFixed(2),
                },
              },
            ],
            payment_source: {
              paypal: {
                experience_context: {
                  shipping_preference: "NO_SHIPPING",
                  return_url: `${base}/receipt/${sale.receipt_token}`,
                  cancel_url: `${base}/receipt/${sale.receipt_token}`,
                },
              },
            },
          },
          sale.id,
        );
        return tx.transaction.update({
          where: { id },
          data: { provider_id: result.id },
        });
      }
      if (sale.payment_method !== "MERCADOPAGO")
        throw new HttpError(400, "Unsupported gateway");
      // Search by stable reference to recover a preference after an interrupted response.
      const preferences = new Preference(mp());
      const previous = await preferences.search({
        options: { external_reference: sale.id },
      });
      let preference: { id?: string; init_point?: string } | undefined =
        previous.elements?.[0]?.id
          ? await preferences.get({ preferenceId: previous.elements[0].id })
          : undefined;
      if (!preference) {
        preference = await preferences.create({
          body: {
            external_reference: sale.id,
            items: sale.items.map((i) => ({
              id: i.id,
              title: i.name_at_sale,
              quantity: i.quantity,
              unit_price: i.price_at_sale / 100,
              currency_id: sale.currency.toUpperCase(),
            })),
            back_urls: {
              success: `${base}/receipt/${sale.receipt_token}`,
              failure: `${base}/receipt/${sale.receipt_token}`,
              pending: `${base}/receipt/${sale.receipt_token}`,
            },
            auto_return: "approved",
            notification_url: `${base}/api/webhooks/mercadopago`,
          },
          requestOptions: { idempotencyKey: sale.id },
        });
      }
      if (!preference.id)
        throw new HttpError(502, "MercadoPago did not return a preference");
      return tx.transaction.update({
        where: { id },
        data: {
          provider_id: preference.id,
          payment_url: preference.init_point,
        },
      });
    },
    { timeout: 60000, maxWait: 10000 },
  );
}

export async function completeGateway(
  id: string,
  method: "PAYPAL" | "MERCADOPAGO",
  paymentId: string,
  amount: number,
  currency: string,
  paidAt: Date,
) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`settle:${id}`},0))`;
    const sale = await tx.transaction.findUniqueOrThrow({ where: { id } });
    if (
      sale.payment_method !== method ||
      sale.total_amount !== amount ||
      sale.currency !== currency.toLowerCase()
    )
      throw new HttpError(409, "Payment does not match the sale");
    if (sale.status === "COMPLETE") {
      if (sale.provider_payment_id !== paymentId)
        throw new HttpError(
          409,
          "Additional payment detected; staff refund review required",
        );
      return sale;
    }
    if (sale.status !== "PENDING")
      throw new HttpError(409, "Payment requires staff review");
    return tx.transaction.update({
      where: { id },
      data: {
        status: "COMPLETE",
        provider_payment_id: paymentId,
        completed_at: paidAt,
      },
    });
  });
}
export async function syncPaypal(token: string, capture = false) {
  const sale = await db.transaction.findUniqueOrThrow({
    where: { receipt_token: token },
  });
  if (sale.payment_method !== "PAYPAL" || !sale.provider_id)
    throw new HttpError(409, "PayPal order is not ready");
  if (sale.status === "COMPLETE") return sale;
  let order = await paypal(
    `/v2/checkout/orders/${encodeURIComponent(sale.provider_id)}`,
  );
  if (capture && order.status === "APPROVED")
    order = await paypal(
      `/v2/checkout/orders/${encodeURIComponent(sale.provider_id)}/capture`,
      {},
      `capture-${sale.id}`,
    );
  const unit = order.purchase_units?.[0],
    payment = unit?.payments?.captures?.[0];
  if (payment?.status !== "COMPLETED") return sale;
  if (
    order.id !== sale.provider_id ||
    unit.custom_id !== sale.id ||
    !payment.final_capture
  )
    throw new HttpError(409, "PayPal reference mismatch");
  return completeGateway(
    sale.id,
    "PAYPAL",
    payment.id,
    toCents(payment.amount.value),
    payment.amount.currency_code,
    new Date(payment.create_time),
  );
}
export async function syncMercado(paymentId: string) {
  const payment = await new Payment(mp()).get({ id: paymentId });
  if (payment.status !== "approved") return;
  if (
    !payment.external_reference ||
    !payment.id ||
    payment.transaction_amount === undefined ||
    !payment.currency_id ||
    !payment.date_approved
  )
    throw new HttpError(409, "Incomplete payment record");
  const live = process.env.MERCADOPAGO_ENV === "live";
  if (!!payment.live_mode !== live)
    throw new HttpError(409, "Payment environment mismatch");
  return completeGateway(
    payment.external_reference,
    "MERCADOPAGO",
    String(payment.id),
    toCents(payment.transaction_amount.toFixed(2)),
    payment.currency_id,
    new Date(payment.date_approved),
  );
}
export function verifyMercadoSignature(
  signature: string,
  requestId: string,
  id: string,
  secret: string,
) {
  const parts = Object.fromEntries(
    signature.split(",").map((s) => s.trim().split("=")),
  );
  if (
    !parts.ts ||
    !/^\d+$/.test(parts.ts) ||
    !/^[a-f0-9]{64}$/i.test(parts.v1 ?? "") ||
    !requestId
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(`id:${id.toLowerCase()};request-id:${requestId};ts:${parts.ts};`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, "hex"));
}
