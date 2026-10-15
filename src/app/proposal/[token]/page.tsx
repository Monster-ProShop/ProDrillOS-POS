"use client";
import { use, useEffect, useState } from "react";
import { CheckCircle2, Package, Truck } from "lucide-react";
import { api, json, money } from "@/lib/client";
import type { Proposal } from "@/lib/commerce-types";
import { trackingUrl } from "@/lib/commerce-validation";
import { Button } from "@/components/ui/button";
export default function ProposalPortal({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params),
    [p, setP] = useState<Proposal | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const load = () =>
      api<Proposal>(`/api/public/proposal?token=${encodeURIComponent(token)}`)
        .then(setP)
        .catch((e) => setError(e.message));
    void load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [token]);
  const tracking = p ? trackingUrl(p.carrier, p.tracking_number) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="eyebrow">Your ProDrillOS special order</p>
      {error && (
        <p role="status" className="notice">
          {error}
        </p>
      )}
      {!p ? (
        <p className="panel muted">
          {error
            ? "This proposal could not be loaded."
            : "Loading your proposal…"}
        </p>
      ) : (
        <>
          <div className="panel space-y-5">
            <Package size={32} className="text-brand" />
            <h1>{p.title}</h1>
            <span className="status-pill">{p.status.replaceAll("_", " ")}</span>
            <p className="whitespace-pre-wrap leading-relaxed muted">
              {p.description}
            </p>
            <div className="grid grid-cols-2 border-y border-white/10 py-5">
              <div>
                <p className="muted text-sm">Package total</p>
                <strong className="text-2xl">
                  {money(p.total_amount, p.currency)}
                </strong>
              </div>
              <div>
                <p className="muted text-sm">Required deposit</p>
                <strong className="text-2xl">
                  {money(p.deposit_amount, p.currency)}
                </strong>
              </div>
            </div>
            {p.status === "Sent" && (
              <>
                <p className="text-sm muted">
                  Approving confirms the package and terms above. Contact the
                  shop to arrange the deposit.
                </p>
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api(
                        "/api/public/proposal",
                        json("POST", { token }),
                      );
                      setP(
                        await api(
                          `/api/public/proposal?token=${encodeURIComponent(token)}`,
                        ),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <CheckCircle2 size={18} />
                  Approve proposal
                </Button>
              </>
            )}
          </div>
          <section className="panel space-y-4">
            <h2>Order progress</h2>
            {p.events.map((event, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-l-2 border-brand pl-5 py-2"
              >
                <CheckCircle2 size={18} className="text-brand" />
                <div>
                  <p>{event.status.replaceAll("_", " ")}</p>
                  <p className="muted text-xs">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            <p className="muted text-xs">
              Shop updates refresh every 10 seconds. Carrier events are
              available on the carrier’s tracking page.
            </p>
            {p.tracking_number && (
              <div className="rounded-lg bg-black/20 p-4">
                <p className="flex gap-2">
                  <Truck size={18} />
                  {p.carrier} · {p.tracking_number}
                </p>
                {tracking && (
                  <a
                    className="text-brand underline text-sm"
                    href={tracking}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Track your package →
                  </a>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
