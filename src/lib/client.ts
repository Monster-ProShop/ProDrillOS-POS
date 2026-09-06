export type Product = {
  id: string; name: string; sku: string; category: string; price: number; cost: number;
  stock_quantity: number; low_stock_threshold: number; version: number;
};
export type Sale = { id: string; timestamp: string; status: string; total_amount: number; currency: string;
  payment_url?: string | null; payment_setup_error?: string };
export function money(cents: number, currency = process.env.NEXT_PUBLIC_SHOP_CURRENCY ?? "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(text || "Server unavailable"); }
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}
export const json = (method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
