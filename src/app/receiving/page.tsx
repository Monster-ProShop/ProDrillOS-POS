"use client";
import { useEffect, useState } from "react";
import { Download, PackageCheck } from "lucide-react";
import { api, json } from "@/lib/client";
import type { CatalogProduct } from "@/lib/commerce-types";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Button } from "@/components/ui/button";
type Receiving = {
  code: string;
  quantity: number;
  reference: string;
  request_id: string;
};
export default function Receiving() {
  const [products, setProducts] = useState<CatalogProduct[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [quantity, setQuantity] = useState(1),
    [reference, setReference] = useState(""),
    [attempt, setAttempt] = useState<Receiving | null>(null),
    [selected, setSelected] = useState("");
  const load = () => api<CatalogProduct[]>("/api/catalog").then(setProducts);
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
    try {
      const a = localStorage.getItem("receiving-attempt");
      if (a) setAttempt(JSON.parse(a));
    } catch {
      setMessage("Unable to recover receiving request");
    }
  }, []);
  async function receive(code: string) {
    if (busy) return;
    if (!reference.trim()) {
      setMessage("Enter a supplier / purchase reference before scanning.");
      return;
    }
    const input = attempt ?? {
      code,
      quantity,
      reference,
      request_id: crypto.randomUUID(),
    };
    setBusy(true);
    try {
      localStorage.setItem("receiving-attempt", JSON.stringify(input));
      setAttempt(input);
      const p = await api<CatalogProduct>(
        "/api/receiving",
        json("POST", input),
      );
      localStorage.removeItem("receiving-attempt");
      setAttempt(null);
      setMessage(
        `${p.name}: received ${input.quantity}. Now ${p.stock_quantity} in stock.`,
      );
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const low = products.filter((p) => p.stock_quantity <= p.low_stock_threshold),
    product = products.find((p) => p.id === selected);
  function download() {
    const cell = (s: unknown) =>
      `"${String(s ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const csv = [
      ["Supplier", "SKU", "Product", "Stock", "Minimum", "Order quantity"],
      ...low.map((p) => [
        p.supplier ?? "Unassigned",
        p.sku,
        p.name,
        p.stock_quantity,
        p.low_stock_threshold,
        Math.max(1, p.low_stock_threshold * 2 - p.stock_quantity),
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "prodrillos-supplier-reorder.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Stockroom / Receiving & replenishment</p>
        <h1>Keep the shop ready.</h1>
        <p className="muted">
          Scan incoming products. See what needs ordering next.
        </p>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel space-y-4">
          <div className="flex items-center gap-2">
            <PackageCheck className="text-brand" />
            <h2>Fast receiving</h2>
          </div>
          <label>
            Supplier / purchase reference
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={!!attempt}
              placeholder="Supplier + purchase order number"
            />
          </label>
          <label>
            Quantity per scan
            <input
              type="number"
              min="1"
              max="10000"
              value={quantity}
              disabled={!!attempt}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <BarcodeScanner disabled={busy || !!attempt} onScan={receive} />
          <p className="muted text-xs">
            USB scanners work as keyboard input. Focus the scan field and scan.
            Each successful scan records one receiving entry.
          </p>
          {attempt && (
            <div className="space-y-2">
              <p className="text-amber-300">
                Unresolved receiving request: {attempt.code}. Retry safely
                before scanning more.
              </p>
              <Button
                disabled={busy}
                onClick={() => {
                  setReference(attempt.reference);
                  void receive(attempt.code);
                }}
              >
                Retry same request
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    confirm(
                      "Discard only after confirming this receiving entry failed or was already recorded.",
                    )
                  ) {
                    localStorage.removeItem("receiving-attempt");
                    setAttempt(null);
                  }
                }}
              >
                Discard reviewed request
              </Button>
            </div>
          )}
          <a href="/invoices" className="text-sm text-brand underline">
            Import a supplier CSV instead →
          </a>
        </section>
        <section className="panel space-y-4">
          <h2>Product barcode & attributes</h2>
          <label>
            Product / variant
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.sku}
                </option>
              ))}
            </select>
          </label>
          {product && (
            <form
              key={product.id + product.version}
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  const data: Record<string, unknown> = {
                    id: product.id,
                    version: product.version,
                    barcode: f.get("barcode"),
                    brand: f.get("brand"),
                    model: f.get("model"),
                    supplier: f.get("supplier"),
                  };
                  if (f.has("weight"))
                    data.ball = {
                      weight: Number(f.get("weight")),
                      oil_category: f.get("oil"),
                      rg_category: f.get("rg"),
                    };
                  if (f.has("size"))
                    data.shoe = {
                      size: f.get("size"),
                      style: f.get("style"),
                      tier: f.get("tier"),
                    };
                  if (f.has("capacity"))
                    data.bag = {
                      ball_capacity: Number(f.get("capacity")),
                      bag_type: f.get("bagtype"),
                    };
                  await api("/api/catalog", json("PATCH", data));
                  await load();
                  setMessage("Product attributes saved.");
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                {(["barcode", "brand", "model", "supplier"] as const).map(
                  (k) => (
                    <label key={k} className="capitalize">
                      {k}
                      <input name={k} defaultValue={product[k] ?? ""} />
                    </label>
                  ),
                )}
              </div>
              {["BOWLING_BALLS", "REACTIVE_RESIN", "URETHANE"].includes(
                product.category,
              ) && (
                <div className="grid grid-cols-3 gap-2">
                  <label>
                    Weight (lbs)
                    <input
                      name="weight"
                      type="number"
                      min="6"
                      max="16"
                      defaultValue={product.ball?.weight ?? 15}
                    />
                  </label>
                  <label>
                    Oil
                    <select
                      name="oil"
                      defaultValue={product.ball?.oil_category ?? "Medium"}
                    >
                      {["Heavy", "Medium", "Light"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    RG
                    <select
                      name="rg"
                      defaultValue={product.ball?.rg_category ?? "Medium"}
                    >
                      {["High", "Medium", "Low"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {product.category === "SHOES" && (
                <div className="grid grid-cols-3 gap-2">
                  <label>
                    Size
                    <input
                      name="size"
                      required
                      defaultValue={product.shoe?.size}
                    />
                  </label>
                  <label>
                    Gender / style
                    <input
                      name="style"
                      required
                      defaultValue={product.shoe?.style ?? "Unisex"}
                    />
                  </label>
                  <label>
                    Tier
                    <select name="tier" defaultValue={product.shoe?.tier}>
                      {["Pro", "Competitive", "Entry_Level"].map((v) => (
                        <option key={v} value={v}>
                          {v.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {product.category === "BAGS" && (
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    Ball capacity
                    <input
                      name="capacity"
                      type="number"
                      min="1"
                      max="6"
                      defaultValue={product.bag?.ball_capacity ?? 2}
                    />
                  </label>
                  <label>
                    Type
                    <select name="bagtype" defaultValue={product.bag?.bag_type}>
                      <option>Tote</option>
                      <option value="Wheeled">Wheeled / roller</option>
                    </select>
                  </label>
                </div>
              )}
              <Button disabled={busy}>Save attributes</Button>
            </form>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{low.length} products need attention</p>
            <h2>To order</h2>
          </div>
          <Button onClick={download} disabled={!low.length}>
            <Download size={16} />
            Supplier summary
          </Button>
        </div>
        <div className="overflow-auto">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Supplier</th>
                <th>On hand</th>
                <th>Minimum</th>
                <th>Suggested order</th>
              </tr>
            </thead>
            <tbody>
              {low.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    <p className="muted text-xs">{p.sku}</p>
                  </td>
                  <td>{p.supplier ?? "Unassigned"}</td>
                  <td className="text-amber-300">{p.stock_quantity}</td>
                  <td>{p.low_stock_threshold}</td>
                  <td>
                    {Math.max(1, p.low_stock_threshold * 2 - p.stock_quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!low.length && (
            <p className="muted py-8 text-center">
              No products at or below their minimum stock.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
