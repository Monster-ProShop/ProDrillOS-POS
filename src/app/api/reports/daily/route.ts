import { z } from "zod";
import { endpoint } from "@/lib/http";
import { dailyReport } from "@/lib/reports";
export const runtime = "nodejs";
export const GET = endpoint(async request => {
  const date = z.iso.date().parse(new URL(request.url).searchParams.get("date"));
  return Response.json({ date, timezone: process.env.SHOP_TIMEZONE ?? "America/Mexico_City", rows: await dailyReport(date) });
});
