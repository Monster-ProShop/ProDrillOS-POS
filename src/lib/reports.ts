import { db } from "@/lib/db";
export async function dailyReport(date: string) {
  const timezone = process.env.SHOP_TIMEZONE ?? "America/Mexico_City";
  return db.$queryRaw<{ payment_method: string; currency: string; sales: number; total_amount: string }[]>`
    SELECT payment_method::text, currency, COUNT(*)::int AS sales, SUM(total_amount)::text AS total_amount
    FROM "Transaction"
    WHERE status = 'COMPLETE'
      AND completed_at >= (${date}::date::timestamp AT TIME ZONE ${timezone})
      AND completed_at < (((${date}::date + 1)::timestamp) AT TIME ZONE ${timezone})
    GROUP BY payment_method, currency ORDER BY payment_method, currency
  `;
}
