import { db } from "@/lib/db";
import { endpoint, HttpError } from "@/lib/http";
import { productInput } from "@/lib/validation";
import { z } from "zod";
export const runtime = "nodejs";
export const GET = endpoint(async () => Response.json(await db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } })));
export const POST = endpoint(async request => {
  const data = productInput.parse(await request.json());
  return Response.json(await db.product.create({ data }), { status: 201 });
});
export const PATCH = endpoint(async request => {
  const { id, version, ...data } = productInput.extend({ id: z.uuid(), version: z.number().int().nonnegative() }).parse(await request.json());
  const result = await db.product.updateMany({ where: { id, version, active: true }, data: { ...data, version: { increment: 1 } } });
  if (!result.count) throw new HttpError(409, "Product changed. Refresh before editing again.");
  return Response.json({ updated: true });
});
export const DELETE = endpoint(async request => {
  const { id, version } = z.object({ id: z.uuid(), version: z.number().int().nonnegative() }).parse(await request.json());
  // Archive instead of deleting the product behind historic sale lines.
  const result = await db.product.updateMany({ where: { id, version, active: true }, data: { active: false, version: { increment: 1 } } });
  if (!result.count) throw new HttpError(409, "Product changed. Refresh and retry.");
  return Response.json({ archived: true });
});
