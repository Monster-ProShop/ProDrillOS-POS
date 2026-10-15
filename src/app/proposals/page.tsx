"use client";
import { useEffect, useState } from "react";
import { api, json, money } from "@/lib/client";
import { toCents } from "@/lib/validation";
import { canTransition, proposalStatuses } from "@/lib/commerce-validation";
import type { Customer, Proposal } from "@/lib/commerce-types";
import { Button } from "@/components/ui/button";
import { EmailDocument } from "@/components/email-document";
import { ShareLinks } from "@/components/share-links";
export default function Proposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]),
    [customers, setCustomers] = useState<Customer[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [origin, setOrigin] = useState("");
  async function load() {
    const [p, c] = await Promise.all([
      api<Proposal[]>("/api/proposals"),
      api<Customer[]>("/api/customers"),
    ]);
    setProposals(p);
    setCustomers(c);
  }
  useEffect(() => {
    setOrigin(location.origin);
    load().catch((e) => setMessage(e.message));
    const t = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(t);
  }, []);
  async function advance(p: Proposal, status: string) {
    const data: Record<string, string> = {
      id: p.id,
      expected_status: p.status,
      status,
    };
    if (status === "Deposit_Paid") {
      const ref = prompt(
        "Verified deposit receipt / reference (record only after funds are received)",
      );
      if (!ref) return;
      data.deposit_reference = ref;
    }
    if (status === "Shipped") {
      const carrier = prompt("Carrier: DHL, FedEx, UPS, USPS, or Other"),
        tracking = prompt("Tracking number");
      if (!carrier || !tracking) return;
      data.carrier = carrier;
      data.tracking_number = tracking;
    }
    setBusy(true);
    try {
      await api("/api/proposals", json("PATCH", data));
      await load();
      setMessage("Proposal updated.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Special orders / Quotes & approvals</p>
        <h1>From idea to first strike.</h1>
        <p className="muted">
          Create packages, collect approval, and keep customers informed.
        </p>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          {proposals.map((p) => (
            <article key={p.id} className="panel space-y-4">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="eyebrow">{p.customer.full_name}</p>
                  <h2 className="mt-1">{p.title}</h2>
                </div>
                <span className="status-pill">
                  {p.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="muted text-sm whitespace-pre-wrap">
                {p.description}
              </p>
              <div className="flex gap-6">
                <strong>{money(p.total_amount, p.currency)}</strong>
                <span className="muted text-sm">
                  Deposit {money(p.deposit_amount, p.currency)}
                </span>
              </div>
              {p.tracking_number && (
                <p className="text-sm">
                  {p.carrier} · {p.tracking_number}
                </p>
              )}
              {p.status !== "Draft" && (
                <EmailDocument kind="proposal" id={p.id} />
              )}
              {p.status !== "Draft" && (
                <ShareLinks
                  title={p.title}
                  url={`${origin}/proposal/${p.approval_token}`}
                  phone={p.customer.phone_whatsapp}
                  email={p.customer.email}
                />
              )}
              <div className="flex flex-wrap gap-2">
                {proposalStatuses
                  .filter(
                    (s) =>
                      canTransition(p.status, s, p.deposit_amount) &&
                      s !== "Approved",
                  )
                  .map((s) => (
                    <Button
                      disabled={busy}
                      variant="outline"
                      key={s}
                      onClick={() => advance(p, s)}
                    >
                      {s === "Sent"
                        ? "Publish approval link"
                        : `Mark ${s.replaceAll("_", " ")}`}
                    </Button>
                  ))}
              </div>
            </article>
          ))}
          {!proposals.length && (
            <p className="panel muted">
              No special orders yet. Build your first proposal.
            </p>
          )}
        </section>
        <form
          className="panel space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const el = e.currentTarget,
              f = new FormData(el);
            setBusy(true);
            try {
              await api(
                "/api/proposals",
                json("POST", {
                  customer_id: f.get("customer"),
                  title: f.get("title"),
                  description: f.get("description"),
                  total_amount: toCents(String(f.get("total"))),
                  deposit_amount: toCents(String(f.get("deposit"))),
                }),
              );
              await load();
              el.reset();
              setMessage(
                "Draft created. Publish the approval link when ready.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>New proposal</h2>
          <label>
            Customer
            <select name="customer" required>
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              required
              name="title"
              placeholder="Ball + precision drilling package"
            />
          </label>
          <label>
            Items, services & terms
            <textarea
              name="description"
              required
              rows={5}
              placeholder="Describe the gear, drilling, expected timing and deposit terms."
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Total
              <input
                name="total"
                inputMode="decimal"
                required
                placeholder="0.00"
              />
            </label>
            <label>
              Deposit
              <input
                name="deposit"
                inputMode="decimal"
                required
                defaultValue="0.00"
              />
            </label>
          </div>
          <Button disabled={busy || !customers.length} className="w-full">
            Save draft
          </Button>
        </form>
      </div>
    </div>
  );
}
