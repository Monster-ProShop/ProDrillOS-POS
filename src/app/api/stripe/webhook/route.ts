import { stripe, settleSession } from "@/lib/stripe";
import type Stripe from "stripe";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return new Response("Webhook not configured or missing signature", { status: 400 });
  let event: Stripe.Event;
  try { event = stripe().webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return new Response("Invalid signature", { status: 400 }); }
  try {
    if (["checkout.session.completed", "checkout.session.expired"].includes(event.type))
      await settleSession(event.data.object as Stripe.Checkout.Session, new Date(event.created * 1000));
    return Response.json({ received: true });
  } catch (error) { console.error(error); return new Response("Retry webhook delivery", { status: 500 }); }
}
