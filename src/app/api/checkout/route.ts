import { endpoint } from "@/lib/http";
import { checkoutInput } from "@/lib/validation";
import { createSale } from "@/lib/checkout";
import { paymentLink, stripe } from "@/lib/stripe";
export const runtime = "nodejs";
export const POST = endpoint(async request => {
  const input = checkoutInput.parse(await request.json());
  if (input.payment_method === "STRIPE") stripe(); // Fail before reserving if not configured.
  const sale = await createSale(input);
  if (sale.payment_method === "CASH" || sale.status !== "PENDING") return Response.json(sale);
  try { return Response.json(await paymentLink(sale.id)); }
  catch (error) {
    console.error("Stripe setup requires retry", error);
    return Response.json({ ...sale, payment_setup_error: "Stock is reserved. Retry payment setup using this sale; do not create another sale." }, { status: 202 });
  }
});
