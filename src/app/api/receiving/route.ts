import { db } from "@/lib/db";
import { endpoint, HttpError } from "@/lib/http";
import { z } from "zod";
export const POST = endpoint(async (r) => {
  const input = z
    .object({
      code: z.string().trim().min(1).max(100),
      quantity: z.number().int().min(1).max(10000),
      reference: z.string().trim().min(1).max(200),
      request_id: z.uuid(),
    })
    .parse(await r.json());
  return Response.json(
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.request_id},0))`;
      const product = await tx.product.findFirst({
        where: {
          active: true,
          OR: [{ barcode: input.code }, { sku: input.code.toUpperCase() }],
        },
      });
      if (!product)
        throw new HttpError(
          404,
          "Unknown barcode / SKU. Create this product in Inventory first.",
        );
      const previous = await tx.stockMovement.findUnique({
        where: { request_id: input.request_id },
      });
      if (previous) {
        if (
          previous.product_id !== product.id ||
          previous.quantity !== input.quantity ||
          previous.reference !== input.reference
        )
          throw new HttpError(409, "Receiving request was already used");
        return product;
      }
      const updated = await tx.product.updateMany({
        where: {
          id: product.id,
          active: true,
          stock_quantity: { lte: 1_000_000 - input.quantity },
        },
        data: {
          stock_quantity: { increment: input.quantity },
          version: { increment: 1 },
        },
      });
      if (!updated.count)
        throw new HttpError(409, "Product unavailable or stock limit reached");
      await tx.stockMovement.create({
        data: {
          product_id: product.id,
          quantity: input.quantity,
          reference: input.reference,
          request_id: input.request_id,
        },
      });
      return tx.product.findUniqueOrThrow({ where: { id: product.id } });
    }),
  );
});
