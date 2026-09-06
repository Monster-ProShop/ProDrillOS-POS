import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { endpoint, HttpError } from "@/lib/http";
import { parseInvoice } from "@/lib/invoices";
export const runtime = "nodejs";
export const GET = endpoint(async () => Response.json(await db.invoiceLog.findMany({ orderBy: { upload_date: "desc" }, take: 30 })));
export const POST = endpoint(async request => {
  const maxSize = 2 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > maxSize + 16_384) throw new HttpError(413, "CSV limit is 2 MB");
  const form = await request.formData();
  const vendor = z.string().trim().min(1).max(100).transform(s => s.toUpperCase()).parse(form.get("vendor"));
  const invoice_number = z.string().trim().min(1).max(100).transform(s => s.toUpperCase()).parse(form.get("invoice_number"));
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) throw new HttpError(400, "Upload a .csv file");
  if (file.size > maxSize) throw new HttpError(413, "CSV limit is 2 MB");
  let rows;
  try { rows = parseInvoice(await file.text()); }
  catch { throw new HttpError(400, "CSV needs sku,quantity headers and positive integer quantities (maximum 5,000 rows)."); }
  const content_hash = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  const result = await db.$transaction(async tx => {
    const log = await tx.invoiceLog.create({ data: { vendor, invoice_number, content_hash, rows_imported: rows.length } });
    for (const row of rows) {
      const result = await tx.product.updateMany({
        where: { sku: row.sku, active: true, stock_quantity: { lte: 1_000_000 - row.quantity } },
        data: { stock_quantity: { increment: row.quantity }, version: { increment: 1 } },
      });
      if (!result.count) throw new HttpError(409, `Unknown/inactive SKU or stock limit exceeded: ${row.sku}. Nothing imported.`);
    }
    return log;
  }, { timeout: 30_000 });
  return Response.json(result, { status: 201 });
});
