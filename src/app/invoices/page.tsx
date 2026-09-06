"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client";
type Log = { id: string; vendor: string; invoice_number: string; upload_date: string; rows_imported: number; status: string };
export default function Invoices() {
  const [logs, setLogs] = useState<Log[]>([]), [message, setMessage] = useState(""), [busy,setBusy] = useState(false);
  async function load() { setLogs(await api<Log[]>("/api/invoices")); }
  useEffect(()=>{load().catch(e=>setMessage(e.message));},[]);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const form = e.currentTarget;
    try { await api("/api/invoices", {method:"POST", body:new FormData(form)}); form.reset(); await load(); setMessage("Invoice imported. Stock updated."); }
    catch(e) { setMessage((e as Error).message); } finally {setBusy(false);}
  }
  return <div className="space-y-6"><div><p className="eyebrow">Receiving / Vendor invoices</p><h1>From delivery to shelf.</h1><p className="muted mt-2">Import a vendor invoice to increase stock for existing SKUs.</p></div>
    {message && <p role="status" className="notice">{message}</p>}
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]"><form onSubmit={upload} className="panel space-y-4">
      <h2>Import CSV</h2><label>Vendor<input name="vendor" placeholder="Storm or Brunswick" required maxLength={100}/></label>
      <label>Invoice number<input name="invoice_number" required maxLength={100}/></label>
      <label>Invoice file<input name="file" type="file" accept=".csv,text/csv" required/></label>
      <p className="muted text-sm">Required headers: <code>sku,quantity</code>. Quantities must be positive whole numbers. Limit: 2 MB / 5,000 rows.</p>
      <pre className="rounded bg-canvas p-3 text-sm">{"sku,quantity\nSTORM-001,3\nGRIP-001,12"}</pre>
      <p className="muted text-sm">Unknown SKUs reject the entire import. Duplicate invoice numbers or identical contents are blocked.</p>
      <button disabled={busy} className="w-full">{busy ? "Importing…" : "Import invoice"}</button>
    </form><section className="panel min-w-0"><h2>Recent imports</h2><div className="overflow-x-auto"><table><thead><tr><th>Vendor / Invoice</th><th>Uploaded</th><th>SKUs</th><th>Status</th></tr></thead>
      <tbody>{logs.map(l=><tr key={l.id}><td>{l.vendor}<p className="muted text-xs">{l.invoice_number}</p></td><td>{new Date(l.upload_date).toLocaleString()}</td><td>{l.rows_imported}</td><td className="text-brand">{l.status}</td></tr>)}</tbody></table></div>
      {!logs.length && <p className="muted py-10">Imported invoices will appear here.</p>}</section></div></div>;
}
