import { db } from "@/lib/db";
import { endpoint, HttpError } from "@/lib/http";
import { catalogDetails } from "@/lib/commerce-validation";
import { z } from "zod";
export const GET = endpoint(async () =>
  Response.json(
    await db.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { ball: true, shoe: true, bag: true },
    }),
  ),
);
export const PATCH = endpoint(async (r) => {
  const { id, version, ball, shoe, bag, ...data } = catalogDetails
    .extend({ id: z.uuid(), version: z.number().int().nonnegative() })
    .parse(await r.json());
  return Response.json(
    await db.$transaction(async (tx) => {
      const changed = await tx.product.updateMany({
        where: { id, version, active: true },
        data: {
          ...data,
          barcode: data.barcode || null,
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new HttpError(409, "Product changed. Refresh and retry.");
      const p = await tx.product.findUniqueOrThrow({ where: { id } });
      if (
        (ball &&
          !["BOWLING_BALLS", "REACTIVE_RESIN", "URETHANE"].includes(
            p.category,
          )) ||
        (shoe && p.category !== "SHOES") ||
        (bag && p.category !== "BAGS")
      )
        throw new HttpError(400, "Details do not match product category");
      if (ball)
        await tx.bowlingBallDetails.upsert({
          where: { product_id: id },
          create: { product_id: id, ...ball },
          update: ball,
        });
      if (shoe)
        await tx.shoeDetails.upsert({
          where: { product_id: id },
          create: { product_id: id, ...shoe },
          update: shoe,
        });
      if (bag)
        await tx.bagDetails.upsert({
          where: { product_id: id },
          create: { product_id: id, ...bag },
          update: bag,
        });
      return p;
    }),
  );
});
