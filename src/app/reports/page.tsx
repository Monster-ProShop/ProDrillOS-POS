"use client";
import { useState } from "react";
import { api, money } from "@/lib/client";
type Report = { date:string; timezone:string; rows:{payment_method:string; currency:string;sales:number;total_amount:string}[] };
export default function Reports() {
  const [date,setDate]=useState(""),[report,setReport]=useState<Report|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function load(){setBusy(true);setError("");try{setReport(await api<Report>(`/api/reports/daily?date=${date}`));}catch(e){setError((e as Error).message);setReport(null);}finally{setBusy(false);}}
  return <div className="space-y-6"><div><p className="eyebrow">Close of day / Conciliation</p><h1>Every sale accounted for.</h1><p className="muted mt-2">Daily completed sales, grouped by payment method and currency.</p></div>
    <form className="panel flex flex-wrap items-end gap-4" onSubmit={e=>{e.preventDefault();load();}}><label>Business date<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><button disabled={busy}>{busy?"Loading…":"Generate report"}</button></form>
    {error&&<p role="alert" className="notice">{error}</p>}
    {report&&<section className="panel"><div className="flex flex-wrap justify-between gap-3"><h2>{report.date}</h2><p className="muted text-sm">{report.timezone} · Payment completion date</p></div>
      <table><thead><tr><th>Payment method</th><th>Currency</th><th>Sales</th><th>Gross sales</th></tr></thead><tbody>
        {report.rows.map(r=><tr key={r.payment_method+r.currency}><td>{r.payment_method==="CASH"?"Cash":"Stripe"}</td><td>{r.currency.toUpperCase()}</td><td>{r.sales}</td><td className="text-brand font-bold">{money(Number(r.total_amount),r.currency)}</td></tr>)}</tbody></table>
      {!report.rows.length&&<p className="muted py-8">No completed sales for this business date.</p>}
    </section>}
    <p className="muted text-sm">This is a gross sales summary. Cash drawer counts, Stripe fees, payouts, refunds, disputes, and tax reconciliation require additional modules.</p>
  </div>;
}
