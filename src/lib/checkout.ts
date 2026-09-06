import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkoutInput } from "@/lib/validation";
import { HttpError } from "@/lib/http";
export async function createSale(input: z.infer<typeof checkoutInput>) {
  const items = [...input.items].sort((a, b) => a.product_id.localeCompare(b.product_id));
  const currency = (process.env.SHOP_CURRENCY ?? "usd").toLowerCase();
  if (!["usd", "mxn", "cad", "eur", "gbp"].includes(currency)) throw new HttpError(503, "Configure a supported two-decimal currency");
  const request_hash = createHash("sha256").update(JSON.stringify({ items, method: input.payment_method, currency })).digest("hex");
  return db.$transaction(async tx => {
    // Serialize duplicate requests across application instances.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.idempotency_key}, 0))`;
    const existing = await tx.transaction.findUnique({ where: { idempotency_key: input.idempotency_key } });
    if (existing) {
      if (existing.request_hash !== request_hash) throw new HttpError(409, "Idempotency key was used for a different cart");
      return existing;
    }
    const lines: { product_id: string; quantity: number; price_at_sale: number; name_at_sale: string }[] = [];
    let total_amount = 0;
    for (const item of items) {
      // Conditional UPDATE obtains a row lock and cannot oversell, even under concurrent requests.
      const reserved = await tx.product.updateMany({
        where: { id: item.product_id, active: true, stock_quantity: { gte: item.quantity } },
        data: { stock_quantity: { decrement: item.quantity }, version: { increment: 1 } },
      });
      if (!reserved.count) throw new HttpError(409, "Insufficient stock or unavailable product; no items were deducted");
      const product = await tx.product.findUniqueOrThrow({ where: { id: item.product_id } });
      total_amount += product.price * item.quantity;
      lines.push({ ...item, price_at_sale: product.price, name_at_sale: product.name });
    }
    if (!Number.isSafeInteger(total_amount) || total_amount > 99_999_999) throw new HttpError(400, "Sale total exceeds the supported limit");
    const cash = input.payment_method === "CASH";
    return tx.transaction.create({ data: {
      idempotency_key: input.idempotency_key, request_hash, currency,
      payment_method: input.payment_method, total_amount,
      status: cash ? "COMPLETE" : "PENDING",
      completed_at: cash ? new Date() : null,
      // Fixed expiry makes Stripe retries deterministic. Never release stock by local time alone.
      expires_at: cash ? null : new Date(Math.floor(Date.now() / 1000) * 1000 + 60 * 60 * 1000),
      items: { create: lines },
    } });
  }, { timeout: 20_000 });
}
