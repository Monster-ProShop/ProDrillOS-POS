import { db } from "@/lib/db";
import { endpoint } from "@/lib/http";
import { customerInput } from "@/lib/commerce-validation";
import { z } from "zod";
export const GET = endpoint(async () =>
  Response.json(
    await db.customer.findMany({
      orderBy: { full_name: "asc" },
      include: { specs: { orderBy: { created_at: "desc" } } },
    }),
  ),
);
export const POST = endpoint(async (r) =>
  Response.json(
    await db.customer.create({ data: customerInput.parse(await r.json()) }),
    { status: 201 },
  ),
);
export const PATCH = endpoint(async (r) => {
  const { id, spec, ...data } = customerInput
    .extend({ id: z.uuid(), spec: z.string().max(5000).optional() })
    .parse(await r.json());
  return Response.json(
    await db.customer.update({
      where: { id },
      data: {
        ...data,
        ...(spec ? { specs: { create: { notes: spec } } } : {}),
      },
    }),
  );
});
