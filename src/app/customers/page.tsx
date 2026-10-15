"use client";
import { useEffect, useState } from "react";
import { Users, Plus } from "lucide-react";
import { api, json } from "@/lib/client";
import type { Customer } from "@/lib/commerce-types";
import { Button } from "@/components/ui/button";
const empty = {
  full_name: "",
  email: "",
  phone_whatsapp: "",
  notes: "",
  spec: "",
};
export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]),
    [selected, setSelected] = useState(""),
    [form, setForm] = useState(empty),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const load = () => api<Customer[]>("/api/customers").then(setCustomers);
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  function choose(c: Customer) {
    setSelected(c.id);
    setForm({
      full_name: c.full_name,
      email: c.email ?? "",
      phone_whatsapp: c.phone_whatsapp ?? "",
      notes: c.notes,
      spec: "",
    });
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Relationships / Player profiles</p>
        <h1>Know every bowler.</h1>
        <p className="muted">
          Contact details, fitting notes, and a lasting spec history.
        </p>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="space-y-4">
          <input
            aria-label="Search customers"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or phone"
          />
          {customers
            .filter((c) =>
              `${c.full_name} ${c.email} ${c.phone_whatsapp}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((c) => (
              <button
                key={c.id}
                onClick={() => choose(c)}
                className="panel !text-left !text-slate-200 w-full"
              >
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-brand" />
                  <div>
                    <h2>{c.full_name}</h2>
                    <p className="muted text-sm font-normal">
                      {c.email || c.phone_whatsapp || "No contact details"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          {!customers.length && (
            <p className="panel muted">Create your first customer profile.</p>
          )}
        </section>
        <form
          className="panel space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(
                "/api/customers",
                json(selected ? "PATCH" : "POST", {
                  ...form,
                  ...(selected ? { id: selected } : {}),
                }),
              );
              await load();
              setMessage("Customer saved.");
              setForm(empty);
              setSelected("");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="flex justify-between">
            <h2>{selected ? "Edit profile" : "New customer"}</h2>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSelected("");
                setForm(empty);
              }}
            >
              <Plus size={18} />
              New
            </Button>
          </div>
          {(
            [
              ["full_name", "Full name"],
              ["email", "Email"],
              ["phone_whatsapp", "WhatsApp (+ country code)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required={key === "full_name"}
                type={key === "email" ? "email" : "text"}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            Customer notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          {selected && (
            <>
              <label>
                Add fitting / spec history
                <textarea
                  value={form.spec}
                  onChange={(e) => setForm({ ...form, spec: e.target.value })}
                  placeholder="Span, pitches, grip sizes, ball and drilling notes"
                />
              </label>
              <div className="space-y-2">
                {customers
                  .find((c) => c.id === selected)
                  ?.specs.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg bg-black/15 p-3 text-sm"
                    >
                      <p className="muted text-xs">
                        {new Date(s.created_at).toLocaleDateString()}
                      </p>
                      <p className="whitespace-pre-wrap">{s.notes}</p>
                    </div>
                  ))}
              </div>
            </>
          )}
          <Button disabled={busy} className="w-full">
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}
