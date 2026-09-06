import { z } from "zod";
import { db } from "@/lib/db";
import { endpoint } from "@/lib/http";
import { paymentLink, syncPayment } from "@/lib/stripe";
export const runtime = "nodejs";
export const GET = endpoint(async () => Response.json(await db.transaction.findMany({
  where: { payment_method: "STRIPE", status: "PENDING" }, orderBy: { timestamp: "asc" }, take: 100,
})));
export const POST = endpoint(async request => {
  const { id, action } = z.object({ id: z.uuid(), action: z.enum(["link", "sync"]) }).parse(await request.json());
  return Response.json(action === "link" ? await paymentLink(id) : await syncPayment(id));
});
