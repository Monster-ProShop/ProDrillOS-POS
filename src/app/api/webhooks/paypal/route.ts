import { db } from "@/lib/db";
import { endpoint, HttpError } from "@/lib/http";
import { paypal, syncPaypal } from "@/lib/gateways";
export const POST = endpoint(async (r) => {
  if (!process.env.PAYPAL_WEBHOOK_ID)
    throw new HttpError(503, "Webhook is not configured");
  const event = await r.json();
  const verified = await paypal("/v1/notifications/verify-webhook-signature", {
    auth_algo: r.headers.get("paypal-auth-algo"),
    cert_url: r.headers.get("paypal-cert-url"),
    transmission_id: r.headers.get("paypal-transmission-id"),
    transmission_sig: r.headers.get("paypal-transmission-sig"),
    transmission_time: r.headers.get("paypal-transmission-time"),
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
    webhook_event: event,
  });
  if (verified.verification_status !== "SUCCESS")
    throw new HttpError(401, "Invalid PayPal signature");
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const id = event.resource?.supplementary_data?.related_ids?.order_id;
    if (typeof id === "string") {
      const sale = await db.transaction.findUnique({
        where: { provider_id: id },
      });
      if (!sale)
        throw new HttpError(
          409,
          "Payment order not yet recorded; retry webhook",
        );
      await syncPaypal(sale.receipt_token);
    }
  }
  return Response.json({ received: true });
});
