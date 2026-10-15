"use client";
import { use, useEffect, useState } from "react";
import { Printer, CheckCircle2 } from "lucide-react";
import { api, json, money } from "@/lib/client";
import { ShareLinks } from "@/components/share-links";
import { Button } from "@/components/ui/button";
type Receipt = {
  id: string;
  timestamp: string;
  status: string;
  total_amount: number;
  currency: string;
  payment_method: string;
  items: {
    id: string;
    name_at_sale: string;
    quantity: number;
    price_at_sale: number;
  }[];
};
export default function ReceiptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params),
    [sale, setSale] = useState<Receipt | null>(null),
    [error, setError] = useState(""),
    [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(location.href.split("?")[0]);
    const load = () =>
      api<Receipt>(`/api/public/receipt?token=${encodeURIComponent(token)}`)
        .then((s) => {
          setSale(s);
          if (s.status === "COMPLETE")
            localStorage.removeItem("store-checkout-attempt");
        })
        .catch((e) => setError(e.message));
    void load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [token]);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {error && (
        <p role="status" className="notice">
          {error}
        </p>
      )}
      {!sale ? (
        <p className="panel muted">
          {error ? "Receipt unavailable." : "Loading your receipt…"}
        </p>
      ) : (
        <>
          <article className="panel space-y-6 receipt">
            <div className="flex justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/brand/prodrillos-logo.png"
                  alt="ProDrillOS logo"
                  width={48}
                  height={48}
                />
                <div>
                  <h2>ProDrillOS POS</h2>
                  <p className="muted text-xs">
                    Purchase receipt · Pro shop pickup
                  </p>
                </div>
              </div>
              <CheckCircle2
                className={
                  sale.status === "COMPLETE" ? "text-emerald-400" : "muted"
                }
              />
            </div>
            <div>
              <p className="eyebrow">
                {sale.status === "COMPLETE"
                  ? "Thank you for shopping with us"
                  : "Payment not yet confirmed"}
              </p>
              <h1 className="!text-2xl">
                Order {sale.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="muted text-sm">
                {new Date(sale.timestamp).toLocaleString()} ·{" "}
                {sale.payment_method}
              </p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name_at_sale}</td>
                    <td>{i.quantity}</td>
                    <td>
                      {money(i.quantity * i.price_at_sale, sale.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between text-2xl font-bold">
              <span>Total</span>
              <span>{money(sale.total_amount, sale.currency)}</span>
            </div>
            <p className="status-pill">{sale.status}</p>
            <p className="muted text-xs">
              Keep this receipt for collection. This purchase note is not a tax
              invoice.
            </p>
          </article>
          <div className="no-print flex gap-2">
            <Button onClick={() => window.print()}>
              <Printer size={16} />
              Print / save PDF
            </Button>
            {sale.payment_method === "PAYPAL" && sale.status === "PENDING" && (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await api("/api/public/receipt", json("POST", { token }));
                    setSale(
                      await api(
                        `/api/public/receipt?token=${encodeURIComponent(token)}`,
                      ),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Check PayPal payment
              </Button>
            )}
          </div>
          <ShareLinks title={`Receipt ${sale.id.slice(0, 8)}`} url={url} />
        </>
      )}
    </div>
  );
}
