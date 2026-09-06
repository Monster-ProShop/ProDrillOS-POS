"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, json, money, type Product } from "@/lib/client";
import { categories, toCents } from "@/lib/validation";
export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [edit, setEdit] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  async function load() { setProducts(await api<Product[]>("/api/products")); }
  useEffect(() => { load().catch(e => setMessage(e.message)); }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const f = new FormData(event.currentTarget);
      const body = { ...(edit ? { id: edit.id, version: edit.version } : {}),
        name: f.get("name"), sku: f.get("sku"), category: f.get("category"),
        price: toCents(String(f.get("price"))), cost: toCents(String(f.get("cost"))),
        stock_quantity: Number(f.get("stock_quantity")), low_stock_threshold: Number(f.get("low_stock_threshold")) };
      await api("/api/products", json(edit ? "PATCH" : "POST", body));
      setEdit(null); setFormKey(k => k + 1); await load(); setMessage("Product saved.");
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function archive(product: Product) {
    if (!confirm(`Archive ${product.name}? Existing sale history will be retained.`)) return;
    setBusy(true);
    try { await api("/api/products", json("DELETE", { id: product.id, version: product.version })); if (edit?.id === product.id) setEdit(null); await load(); setMessage("Product archived."); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  const low = products.filter(p => p.stock_quantity <= p.low_stock_threshold);
  return <div className="space-y-6">
    <div><p className="eyebrow">Stockroom / Inventory</p><h1>Everything on your shelves.</h1><p className="muted mt-2">Manage bowling balls, grips, tape, and shop essentials.</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
      {[["Active SKUs", products.length], ["Units available", products.reduce((a,p) => a+p.stock_quantity,0)], ["Low-stock SKUs", low.length]].map(([label,value]) =>
        <div className="panel" key={label}><p className="muted text-sm">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}
    </div>
    {message && <p role="status" className="notice">{message}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_310px]">
      <section className="panel min-w-0"><label>Find a product<input placeholder="Search name or SKU" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <div className="overflow-x-auto"><table><thead><tr><th>Product / SKU</th><th>Price</th><th>Cost</th><th>Stock</th><th>Actions</th></tr></thead>
          <tbody>{products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase())).map(p =>
            <tr key={p.id}><td><strong>{p.name}</strong><p className="muted text-xs mt-1">{p.sku} · {p.category.replaceAll("_"," ")}</p></td><td>{money(p.price)}</td><td>{money(p.cost)}</td>
              <td><span className={p.stock_quantity <= p.low_stock_threshold ? "text-amber-300" : ""}>{p.stock_quantity}</span>{p.stock_quantity <= p.low_stock_threshold && <p className="text-xs text-amber-300">Reorder · min {p.low_stock_threshold}</p>}</td>
              <td><div className="flex gap-2"><button disabled={busy} className="secondary" onClick={() => { setEdit(p); setFormKey(k=>k+1); }}>Edit</button><button disabled={busy} className="secondary" onClick={() => archive(p)}>Archive</button></div></td></tr>)}</tbody></table></div>
        {!products.length && <p className="muted py-10 text-center">Add your first product to start building inventory.</p>}
      </section>
      <form key={formKey} onSubmit={save} className="panel space-y-4">
        <h2>{edit ? "Edit product" : "Add product"}</h2>
        <label>Product name<input name="name" required maxLength={200} defaultValue={edit?.name} /></label>
        <label>SKU<input name="sku" required maxLength={80} defaultValue={edit?.sku} /></label>
        <label>Category<select name="category" defaultValue={edit?.category ?? "REACTIVE_RESIN"}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">{[["price","Sale price"],["cost","Unit cost"]].map(([name,label])=>
          <label key={name}>{label}<input name={name} type="number" min={name==="price" ? ".01" : "0"} max="1000000" step=".01" required defaultValue={edit ? (edit[name as "price"|"cost"]/100).toFixed(2) : ""} /></label>)}</div>
        <div className="grid grid-cols-2 gap-3"><label>Stock<input name="stock_quantity" type="number" min="0" max="1000000" step="1" required defaultValue={edit?.stock_quantity ?? 0} /></label>
          <label>Low-stock threshold<input name="low_stock_threshold" type="number" min="0" max="1000000" step="1" required defaultValue={edit?.low_stock_threshold ?? 3} /></label></div>
        <button disabled={busy} className="w-full">{busy ? "Saving…" : "Save product"}</button>
        {edit && <button type="button" className="secondary w-full" onClick={()=>{setEdit(null);setFormKey(k=>k+1);}}>Cancel edit</button>}
      </form>
    </div>
  </div>;
}
