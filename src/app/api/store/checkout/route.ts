import { endpoint, HttpError } from "@/lib/http";
import { checkoutInput } from "@/lib/validation";
import { createSale } from "@/lib/checkout";
import { checkGateway, setupGateway } from "@/lib/gateways";
import { verifyCheckoutChallenge } from "@/lib/turnstile";
export const POST = endpoint(async (r) => {
  const body = await r.json();
  const input = checkoutInput.parse(body);
  if (
    !["PAYPAL", "MERCADOPAGO"].includes(input.payment_method) ||
    input.customer_id ||
    input.items.some((i) => i.service_id)
  )
    throw new HttpError(400, "Invalid online checkout");
  checkGateway(input.payment_method);
  await verifyCheckoutChallenge(body.challenge);
  const sale = await createSale(input);
  const result = await setupGateway(sale.id);
  return Response.json({
    id: result.id,
    provider_id: result.provider_id,
    receipt_token: result.receipt_token,
    payment_url: result.payment_url,
    status: result.status,
  });
});
