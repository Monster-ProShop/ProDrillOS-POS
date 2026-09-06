"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, json, money, type Product, type Sale } from "@/lib/client";
type Attempt = { idempotency_key: string; payment_method: "CASH"|"STRIPE"; items: {product_id:string;quantity:number}[] };
export default function POS() {
  const [products,setProducts] = useState<Product[]>([]), [cart,setCart] = useState<Record<string,number>>({});
  const [search,setSearch] = useState(""), [message,setMessage] = useState(""), [busy,setBusy] = useState(false);
  const [sale,setSale] = useState<Sale|null>(null), [pending,setPending] = useState<Sale[]>([]);
  const [attempt,setAttempt] = useState<Attempt|null>(null);
  const lock = useRef(false);
  async function load() {
    const [p,s] = await Promise.all([api<Product[]>("/api/products"), api<Sale[]>("/api/payments")]);
    setProducts(p); setPending(s);
  }
  useEffect(()=>{
    try { const saved = localStorage.getItem("pos-checkout-attempt"); if(saved) {setAttempt(JSON.parse(saved));setMessage("An unfinished checkout request was recovered. Retry it before starting another sale.");} }
    catch {setMessage("Could not restore the last checkout request.");}
    load().catch(e=>setMessage(e.message));
  },[]);
  function clearAttempt() { localStorage.removeItem("pos-checkout-attempt"); setAttempt(null); }
  async function checkout(method: "CASH"|"STRIPE") {
    if(lock.current) return; lock.current=true; setBusy(true); setMessage("");
    const request = attempt ?? {idempotency_key:crypto.randomUUID(), payment_method:method,
      items:Object.entries(cart).map(([product_id,quantity])=>({product_id,quantity}))};
    try {
      // Persist BEFORE the network request so refreshes and timeouts do not duplicate cash sales.
      localStorage.setItem("pos-checkout-attempt",JSON.stringify(request)); setAttempt(request);
      const result = await api<Sale>("/api/checkout",json("POST",request));
      setSale(result); setCart({}); clearAttempt();
      setMessage(result.payment_setup_error ?? (result.status==="COMPLETE" ? "Sale complete." : "Payment pending. Ask the customer to scan the QR code."));
      await load();
    } catch(e) {setMessage((e as Error).message);} finally {setBusy(false);lock.current=false;}
  }
  async function payment(id:string, action:"link"|"sync") {
    setBusy(true);setMessage("");
    try {const result=await api<Sale>("/api/payments",json("POST",{id,action}));setSale(result);setMessage(`Payment status: ${result.status}`);await load();}
    catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  const lines = products.filter(p=>cart[p.id]);
  const total = lines.reduce((sum,p)=>sum+p.price*cart[p.id],0);
  const frozen = busy || !!attempt;
  return <div className="space-y-6">
    <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">Counter / Point of sale</p><h1>Ready for the next frame.</h1><p className="muted mt-2">Build a sale. Take cash or send a secure card checkout.</p></div><span className="hidden rounded-full border border-white/20 px-3 py-1 text-xs sm:block">PRO SHOP POS</span></div>
    {message && <p role="status" className="notice">{message}</p>}
    {attempt && <div className="panel space-y-3"><p>A checkout request is awaiting resolution. Retry uses the same cart and request ID.</p>
      <button disabled={busy} onClick={()=>checkout(attempt.payment_method)}>Retry {attempt.payment_method.toLowerCase()} checkout</button>
      <button disabled={busy} className="secondary ml-3" onClick={()=>{if(confirm("Only discard after confirming the server rejected this request or after reviewing the transaction in the database. An ambiguous cash request may already be paid.")){clearAttempt();setMessage("");}}}>Discard resolved request</button>
      <p className="muted text-xs">Request ID: {attempt.idempotency_key}</p></div>}
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4"><label>Find products<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or SKU"/></label>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{products.filter(p=>`${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase())).map(p=>
          <button className="panel !text-left !font-normal !text-[var(--text)]" key={p.id} disabled={frozen || p.stock_quantity <= (cart[p.id]??0)}
            onClick={()=>setCart(c=>({...c,[p.id]:(c[p.id]??0)+1}))}>
            <p className="eyebrow">{p.category.replaceAll("_"," ")}</p><p className="my-3 text-lg font-bold">{p.name}</p><p className="muted text-xs">{p.sku}</p>
            <div className="mt-5 flex items-center justify-between"><strong>{money(p.price)}</strong><span className="muted text-xs">{p.stock_quantity} available</span></div></button>)}</div>
        {!products.length && <div className="panel muted py-12 text-center">Your shelves are empty. <a className="text-brand underline" href="/inventory">Add inventory</a> to start a sale.</div>}
      </section>
      <aside className="panel space-y-5"><div className="flex items-center justify-between"><h2>Current sale</h2><span className="muted text-sm">{Object.values(cart).reduce((a,b)=>a+b,0)} items</span></div>
        {!lines.length && <p className="muted py-8 text-center">Select a product to add it.</p>}
        {lines.map(p=><div key={p.id} className="border-b border-white/10 pb-4"><p className="font-bold">{p.name}</p><div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3"><button aria-label={`Remove one ${p.name}`} className="secondary" disabled={frozen} onClick={()=>setCart(c=>{const n={...c};if(n[p.id]===1)delete n[p.id];else n[p.id]--;return n;})}>−</button><span>{cart[p.id]}</span>
          <button aria-label={`Add one ${p.name}`} className="secondary" disabled={frozen || cart[p.id]>=p.stock_quantity} onClick={()=>setCart(c=>({...c,[p.id]:c[p.id]+1}))}>+</button></div><strong>{money(p.price*cart[p.id])}</strong></div></div>)}
        <div className="flex items-center justify-between text-2xl font-bold"><span>Total</span><span>{money(total)}</span></div>
        <p className="muted text-xs">Prices are confirmed by the server at checkout. Tax and discounts are outside this starter.</p>
        <button className="w-full" disabled={frozen || !lines.length} onClick={()=>checkout("STRIPE")}>Create card payment / QR</button>
        <button className="secondary w-full" disabled={frozen || !lines.length} onClick={()=>{if(confirm(`Confirm you received ${money(total)} in cash?`))checkout("CASH");}}>Record cash received</button>
      </aside>
    </div>
    {sale && <section className="panel flex flex-wrap items-center gap-6">
      {sale.payment_url && sale.status==="PENDING" && <div className="rounded-xl bg-white p-4"><QRCodeSVG value={sale.payment_url} size={168} title="Scan to pay with Stripe"/></div>}
      <div className="space-y-3"><p className="eyebrow">Sale {sale.id.slice(0,8)}</p><h2>{money(sale.total_amount,sale.currency)} · {sale.status}</h2>
        {sale.status==="PENDING" && <><p className="muted">Stock is reserved. Completion is verified with Stripe.</p><div className="flex flex-wrap gap-3">
          {sale.payment_url ? <a className="button" href={sale.payment_url} target="_blank" rel="noreferrer">Open payment link</a> : <button disabled={busy} onClick={()=>payment(sale.id,"link")}>Retry payment setup</button>}
          <button className="secondary" disabled={busy} onClick={()=>payment(sale.id,"sync")}>Check payment status</button></div></>}
      </div></section>}
    {!!pending.length && <section className="panel"><h2>Pending card payments</h2><p className="muted text-sm mt-1">Recover a sale, check a payment, or release an expired reservation after Stripe verification.</p>
      <div className="overflow-x-auto"><table><thead><tr><th>Sale</th><th>Created</th><th>Total</th><th>Action</th></tr></thead><tbody>{pending.map(p=><tr key={p.id}><td>{p.id.slice(0,8)}</td><td>{new Date(p.timestamp).toLocaleString()}</td><td>{money(p.total_amount,p.currency)}</td>
        <td><div className="flex gap-2"><button className="secondary" disabled={busy} onClick={()=>setSale(p)}>View</button><button className="secondary" disabled={busy} onClick={()=>payment(p.id,"sync")}>Check status</button></div></td></tr>)}</tbody></table></div></section>}
  </div>;
}
