import Stripe from "stripe";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
let instance: Stripe | undefined;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new HttpError(503, "Configure STRIPE_SECRET_KEY");
  return instance ??= new Stripe(process.env.STRIPE_SECRET_KEY);
}
export async function paymentLink(id: string) {
  const sale = await db.transaction.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { product_id: "asc" } } } });
  if (sale.payment_method !== "STRIPE") throw new HttpError(400, "This is a cash sale");
  if (sale.status !== "PENDING") return sale;
  if (sale.stripe_session_id && sale.payment_url) return sale;
  // An ambiguous Stripe timeout must be retried with the SAME key, not compensated blindly.
  if (!sale.expires_at || sale.expires_at.getTime() <= Date.now() + 30 * 60 * 1000)
    throw new HttpError(409, "Payment setup window elapsed. Use Check payment status to recover or release this reservation.");
  const base = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
  const session = await stripe().checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"],
    client_reference_id: sale.id, metadata: { transaction_id: sale.id },
    expires_at: Math.floor(sale.expires_at.getTime() / 1000),
    success_url: `${base}/payment-return?result=success`,
    cancel_url: `${base}/payment-return?result=cancelled`,
    line_items: sale.items.map(item => ({
      quantity: item.quantity,
      price_data: { currency: sale.currency, unit_amount: item.price_at_sale, product_data: { name: item.name_at_sale } },
    })),
  }, { idempotencyKey: `pos-checkout-${sale.id}` });
  if (!session.url) throw new HttpError(502, "Stripe did not return a payment URL");
  // Webhooks may already have completed this sale; do not overwrite status.
  return db.transaction.update({ where: { id }, data: { stripe_session_id: session.id, payment_url: session.url } });
}
export async function settleSession(session: Stripe.Checkout.Session, paidAt = new Date()) {
  const id = session.metadata?.transaction_id;
  if (!id) return;
  await db.$transaction(async tx => {
    const sale = await tx.transaction.findUnique({ where: { id }, include: { items: { orderBy: { product_id: "asc" } } } });
    if (!sale || sale.payment_method !== "STRIPE") throw new HttpError(409, "Unknown Stripe transaction");
    if (session.client_reference_id !== id || session.amount_total !== sale.total_amount || session.currency !== sale.currency ||
      (sale.stripe_session_id && sale.stripe_session_id !== session.id)) throw new HttpError(409, "Stripe session does not match sale");
    if (session.status === "complete" && session.payment_status === "paid") {
      const result = await tx.transaction.updateMany({ where: { id, status: "PENDING" },
        data: { status: "COMPLETE", completed_at: paidAt, stripe_session_id: session.id } });
      if (!result.count && sale.status === "EXPIRED") throw new HttpError(409, "Paid session conflicts with released stock; review required");
    } else if (session.status === "expired") {
      const result = await tx.transaction.updateMany({ where: { id, status: "PENDING" }, data: { status: "EXPIRED", stripe_session_id: session.id } });
      if (result.count) for (const item of sale.items) await tx.product.update({ where: { id: item.product_id },
        data: { stock_quantity: { increment: item.quantity }, version: { increment: 1 } } });
    }
  });
}
export async function syncPayment(id: string) {
  const sale = await db.transaction.findUniqueOrThrow({ where: { id } });
  if (sale.payment_method !== "STRIPE" || sale.status !== "PENDING") return sale;
  let session: Stripe.Checkout.Session | undefined;
  if (sale.stripe_session_id) session = await stripe().checkout.sessions.retrieve(sale.stripe_session_id);
  else {
    // Recovery for a crash after Stripe creation but before the session ID was stored.
    for await (const candidate of stripe().checkout.sessions.list({ created: { gte: Math.floor(sale.timestamp.getTime() / 1000) - 5 }, limit: 100 })) {
      if (candidate.metadata?.transaction_id === sale.id) { session = candidate; break; }
    }
    // Wait past fixed expiry, and verify absence at Stripe before releasing an orphan.
    if (!session && sale.expires_at && Date.now() > sale.expires_at.getTime() + 5 * 60_000) {
      await db.$transaction(async tx => {
        const changed = await tx.transaction.updateMany({ where: { id, status: "PENDING", stripe_session_id: null }, data: { status: "EXPIRED" } });
        if (changed.count) {
          const items = await tx.transactionItem.findMany({ where: { transaction_id: id }, orderBy: { product_id: "asc" } });
          for (const item of items) await tx.product.update({ where: { id: item.product_id },
            data: { stock_quantity: { increment: item.quantity }, version: { increment: 1 } } });
        }
      });
    }
  }
  if (session) {
    await db.transaction.update({ where: { id }, data: { stripe_session_id: session.id, payment_url: session.url } });
    // Prefer Stripe's completion event timestamp for correct business-day reporting.
    let paidAt: Date | undefined;
    if (session.payment_status === "paid") {
      for await (const event of stripe().events.list({ type: "checkout.session.completed", created: { gte: session.created }, limit: 100 })) {
        if ((event.data.object as Stripe.Checkout.Session).id === session.id) { paidAt = new Date(event.created * 1000); break; }
      }
      if (!paidAt) throw new HttpError(409, "Payment found. Completion timestamp needs webhook replay or manual review.");
    }
    await settleSession(session, paidAt);
  }
  return db.transaction.findUniqueOrThrow({ where: { id } });
}
