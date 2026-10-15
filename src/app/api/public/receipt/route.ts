import { db } from "@/lib/db";
import { endpoint, HttpError } from "@/lib/http";
import { syncPaypal } from "@/lib/gateways";
import { z } from "zod";
export const GET = endpoint(async (r) => {
  const token = z.uuid().parse(new URL(r.url).searchParams.get("token"));
  const sale = await db.transaction.findUnique({
    where: { receipt_token: token },
    select: {
      id: true,
      timestamp: true,
      total_amount: true,
      currency: true,
      status: true,
      payment_method: true,
      items: {
        select: {
          id: true,
          name_at_sale: true,
          quantity: true,
          price_at_sale: true,
        },
      },
    },
  });
  if (!sale) throw new HttpError(404, "Receipt unavailable");
  return Response.json(sale, {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
});
export const POST = endpoint(async (r) => {
  const { token } = z.object({ token: z.uuid() }).parse(await r.json());
  const sale = await syncPaypal(token, true);
  return Response.json({ status: sale.status });
});
