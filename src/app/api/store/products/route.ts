import { db } from "@/lib/db";
import { endpoint } from "@/lib/http";
export const dynamic = "force-dynamic";
export const GET = endpoint(async () =>
  Response.json(
    await db.product.findMany({
      where: { active: true, stock_quantity: { gt: 0 } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        price: true,
        stock_quantity: true,
        brand: true,
        model: true,
        ball: true,
        shoe: true,
        bag: true,
      },
    }),
    { headers: { "Cache-Control": "no-store" } },
  ),
);
