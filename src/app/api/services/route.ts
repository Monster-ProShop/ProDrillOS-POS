import { db } from "@/lib/db";
import { endpoint, HttpError } from "@/lib/http";
import { serviceInput } from "@/lib/commerce-validation";
import { z } from "zod";
export const GET = endpoint(async () =>
  Response.json(
    await db.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { components: { include: { service: true } } },
    }),
  ),
);
export const POST = endpoint(async (r) => {
  const { components, ...data } = serviceInput.parse(await r.json());
  // Bundles contain standalone services only, preventing recursive/cyclic pricing.
  const count = await db.service.count({
    where: {
      id: { in: components.map((c) => c.service_id) },
      active: true,
      components: { none: {} },
    },
  });
  if (count !== components.length)
    throw new HttpError(
      400,
      "Bundle components must be active standalone services",
    );
  return Response.json(
    await db.service.create({
      data: { ...data, components: { create: components } },
    }),
    { status: 201 },
  );
});
export const PATCH = endpoint(async (r) => {
  const data = z
    .object({
      id: z.uuid(),
      price: z.number().int().min(1).max(100_000_000),
      active: z.boolean().optional(),
    })
    .parse(await r.json());
  return Response.json(
    await db.service.update({
      where: { id: data.id },
      data: { price: data.price, active: data.active },
    }),
  );
});
