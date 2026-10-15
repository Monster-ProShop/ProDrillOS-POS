import { z } from "zod";
export const customerInput = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z
    .union([z.email().max(254), z.literal("")])
    .transform((v) => v || null),
  phone_whatsapp: z
    .union([z.string().regex(/^\+[1-9]\d{7,14}$/), z.literal("")])
    .transform((v) => v || null),
  notes: z.string().max(5000).default(""),
});
export const serviceInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000).default(""),
    price: z.number().int().min(1).max(100_000_000),
    components: z
      .array(
        z.object({
          service_id: z.uuid(),
          quantity: z.number().int().min(1).max(100),
        }),
      )
      .max(30)
      .default([]),
  })
  .refine(
    (v) =>
      new Set(v.components.map((c) => c.service_id)).size ===
      v.components.length,
    "Duplicate bundle components",
  );
export const catalogDetails = z.object({
  barcode: z.string().trim().max(100).nullable().optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  model: z.string().trim().max(100).nullable().optional(),
  supplier: z.string().trim().max(100).nullable().optional(),
  ball: z
    .object({
      weight: z.number().int().min(6).max(16),
      oil_category: z.enum(["Heavy", "Medium", "Light"]),
      rg_category: z.enum(["High", "Medium", "Low"]),
    })
    .nullable()
    .optional(),
  shoe: z
    .object({
      size: z.string().min(1).max(20),
      style: z.string().min(1).max(60),
      tier: z.enum(["Pro", "Competitive", "Entry_Level"]),
    })
    .nullable()
    .optional(),
  bag: z
    .object({
      ball_capacity: z.number().int().min(1).max(6),
      bag_type: z.enum(["Tote", "Wheeled"]),
    })
    .nullable()
    .optional(),
});
export const proposalInput = z
  .object({
    customer_id: z.uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().min(1).max(5000),
    total_amount: z.number().int().min(1).max(99_999_999),
    deposit_amount: z.number().int().nonnegative(),
  })
  .refine(
    (v) => v.deposit_amount <= v.total_amount,
    "Deposit cannot exceed total",
  );
export const proposalStatuses = [
  "Draft",
  "Sent",
  "Approved",
  "Deposit_Paid",
  "In_Progress",
  "Shipped",
  "Fulfilled",
] as const;
export function canTransition(from: string, to: string, deposit: number) {
  const transitions: Record<string, string[]> = {
    Draft: ["Sent"],
    Sent: ["Approved"],
    Approved: deposit ? ["Deposit_Paid"] : ["In_Progress"],
    Deposit_Paid: ["In_Progress"],
    In_Progress: ["Shipped", "Fulfilled"],
    Shipped: ["Fulfilled"],
    Fulfilled: [],
  };
  return transitions[from]?.includes(to) ?? false;
}
export function trackingUrl(carrier: string | null, number: string | null) {
  if (!carrier || !number) return null;
  const roots: Record<string, string> = {
    DHL: "https://www.dhl.com/mx-en/home/tracking.html?tracking-id=",
    FedEx: "https://www.fedex.com/fedextrack/?trknbr=",
    UPS: "https://www.ups.com/track?tracknum=",
    USPS: "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
  };
  return roots[carrier] ? roots[carrier] + encodeURIComponent(number) : null;
}
