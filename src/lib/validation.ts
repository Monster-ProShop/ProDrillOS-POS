import { z } from "zod";
export const categories = [
  "BOWLING_BALLS",
  "SHOES",
  "BAGS",
  "ACCESSORIES",
  "REACTIVE_RESIN",
  "URETHANE",
  "GRIPS",
  "TAPE",
  "OTHER",
] as const;
export const productInput = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform((s) => s.toUpperCase()),
  category: z.enum(categories),
  price: z.number().int().min(1).max(100_000_000),
  cost: z.number().int().min(0).max(100_000_000),
  stock_quantity: z.number().int().min(0).max(1_000_000),
  low_stock_threshold: z.number().int().min(0).max(1_000_000),
});
export const checkoutInput = z
  .object({
    idempotency_key: z.uuid(),
    payment_method: z.enum([
      "CASH",
      "STRIPE",
      "POS_CARD",
      "PAYPAL",
      "MERCADOPAGO",
    ]),
    customer_id: z.uuid().optional(),
    items: z
      .array(
        z
          .object({
            product_id: z.uuid().optional(),
            service_id: z.uuid().optional(),
            quantity: z.number().int().min(1).max(1000),
          })
          .refine(
            (v) => !!v.product_id !== !!v.service_id,
            "Choose a product or service",
          ),
      )
      .min(1)
      .max(100),
  })
  .superRefine((data, ctx) => {
    if (
      new Set(data.items.map((i) => i.product_id ?? i.service_id)).size !==
      data.items.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate products are not allowed",
      });
  });
export function toCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Enter an amount with at most two decimal places");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100_000_000)
    throw new Error("Amount is too large");
  return result;
}
