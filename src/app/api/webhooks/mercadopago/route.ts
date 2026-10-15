import { endpoint, HttpError } from "@/lib/http";
import { syncMercado, verifyMercadoSignature } from "@/lib/gateways";
export const POST = endpoint(async (r) => {
  const id = new URL(r.url).searchParams.get("data.id"),
    secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, "Webhook is not configured");
  if (
    !id ||
    !verifyMercadoSignature(
      r.headers.get("x-signature") ?? "",
      r.headers.get("x-request-id") ?? "",
      id,
      secret,
    )
  )
    throw new HttpError(401, "Invalid signature");
  const body = await r.json();
  if (body.type === "payment") await syncMercado(id);
  return Response.json({ received: true });
});
