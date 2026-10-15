"use client";
import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { api, json, money } from "@/lib/client";
import { toCents } from "@/lib/validation";
import type { Service } from "@/lib/commerce-types";
import { Button } from "@/components/ui/button";
export default function Services() {
  const [services, setServices] = useState<Service[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [components, setComponents] = useState<string[]>([]);
  const load = () => api<Service[]>("/api/services").then(setServices);
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Workshop / Service catalog</p>
        <h1>Precision has a price.</h1>
        <p className="muted">
          Drilling, resurfacing, detox, grips, labor add-ons, and complete
          packages.
        </p>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <article key={s.id} className="panel space-y-3">
              <Wrench className="text-brand" size={22} />
              <h2>{s.name}</h2>
              <p className="muted text-sm">{s.description}</p>
              {s.components.map((c) => (
                <p key={c.service_id} className="text-xs muted">
                  {c.quantity} × {c.service.name}
                </p>
              ))}
              <strong className="text-xl">{money(s.price)}</strong>
              <Button
                variant="outline"
                className="ml-3"
                disabled={busy}
                onClick={async () => {
                  const price = prompt("New price", (s.price / 100).toFixed(2));
                  if (price === null) return;
                  setBusy(true);
                  try {
                    await api(
                      "/api/services",
                      json("PATCH", { id: s.id, price: toCents(price) }),
                    );
                    await load();
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Edit price
              </Button>
            </article>
          ))}
          {!services.length && (
            <p className="panel muted">
              Add your shop services to start building packages.
            </p>
          )}
        </div>
        <form
          className="panel space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const el = e.currentTarget,
              f = new FormData(el);
            setBusy(true);
            try {
              await api(
                "/api/services",
                json("POST", {
                  name: f.get("name"),
                  description: f.get("description"),
                  price: toCents(String(f.get("price"))),
                  components: components.map((service_id) => ({
                    service_id,
                    quantity: 1,
                  })),
                }),
              );
              await load();
              el.reset();
              setComponents([]);
              setMessage("Service saved.");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Create a service or bundle</h2>
          <label>
            Name
            <input name="name" required placeholder="Plug & re-drill" />
          </label>
          <label>
            Description
            <textarea name="description" placeholder="What's included" />
          </label>
          <label>
            Price
            <input
              name="price"
              required
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>
          <p className="muted text-sm">
            Optional: select services to include in this fixed-price bundle.
          </p>
          {services
            .filter((s) => !s.components.length)
            .map((s) => (
              <label key={s.id} className="!flex items-center gap-2">
                <input
                  className="!w-auto"
                  type="checkbox"
                  checked={components.includes(s.id)}
                  onChange={(e) =>
                    setComponents(
                      e.target.checked
                        ? [...components, s.id]
                        : components.filter((id) => id !== s.id),
                    )
                  }
                />
                {s.name}
              </label>
            ))}
          <Button disabled={busy} className="w-full">
            Save service
          </Button>
        </form>
      </div>
    </div>
  );
}
