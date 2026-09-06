import { parse } from "csv-parse/sync";
import { z } from "zod";
export function parseInvoice(text: string) {
  const records = parse(text, { columns: true, bom: true, skip_empty_lines: true, trim: true, max_record_size: 10_000 }) as unknown[];
  const rows = z.array(z.object({
    sku: z.string().trim().min(1).max(80).transform(s => s.toUpperCase()),
    quantity: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(1_000_000)),
  })).min(1).max(5000).parse(records);
  const combined = new Map<string, number>();
  for (const row of rows) {
    const quantity = (combined.get(row.sku) ?? 0) + row.quantity;
    if (quantity > 1_000_000) throw new Error("Invoice quantity is too large");
    combined.set(row.sku, quantity);
  }
  return [...combined].sort(([a], [b]) => a.localeCompare(b)).map(([sku, quantity]) => ({ sku, quantity }));
}
