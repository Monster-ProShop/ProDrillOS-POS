"use client";
import { useEffect, useState, useRef } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";
import { api, json } from "@/lib/client";
import { Turnstile } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
type Attempt = {
  idempotency_key: string;
  payment_method: "PAYPAL" | "MERCADOPAGO";
  items: { product_id: string; quantity: number }[];
};
type Result = {
  id: string;
  provider_id: string;
  receipt_token: string;
  status: string;
};
export function PaymentButtons({
  items,
  onReserved,
}: {
  items: Attempt["items"];
  onReserved: () => void;
}) {
  const [config, setConfig] = useState<{
      paypal: string | null;
      mercadopago: string | null;
      currency: string;
      turnstile: string | null;
    } | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState<Attempt | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<NonNullable<typeof config>>("/api/store/config")
      .then((c) => {
        setConfig(c);
        if (c.mercadopago) initMercadoPago(c.mercadopago, { locale: "en-US" });
      })
      .catch((e) => setError(e.message));
    try {
      const saved = localStorage.getItem("store-checkout-attempt");
      if (saved) setAttempt(JSON.parse(saved));
    } catch {
      setError(
        "Unable to restore checkout. Contact the shop if a payment was started.",
      );
    }
  }, []);
  const [challenge, setChallenge] = useState(""),
    [resetKey, setResetKey] = useState(0);
  const resultRef = useRef<Result | null>(null),
    attemptRef = useRef<Attempt | null>(null);
  async function prepare(method: Attempt["payment_method"]) {
    const request = attemptRef.current ??
      attempt ?? {
        idempotency_key: crypto.randomUUID(),
        payment_method: method,
        items,
      };
    if (request.payment_method !== method)
      throw new Error("Continue the payment method already selected.");
    localStorage.setItem("store-checkout-attempt", JSON.stringify(request));
    setAttempt(request);
    attemptRef.current = request;
    const sale = await api<Result>(
      "/api/store/checkout",
      json("POST", { ...request, challenge }),
    ).finally(() => {
      setChallenge("");
      setResetKey((k) => k + 1);
    });
    setResult(sale);
    resultRef.current = sale;
    onReserved();
    if (sale.status === "COMPLETE") paid(sale.receipt_token);
    return sale;
  }
  function paid(token: string) {
    localStorage.removeItem("store-checkout-attempt");
    location.assign(`/receipt/${token}`);
  }
  return (
    <div className="space-y-3">
      {config?.turnstile && (
        <Turnstile
          siteKey={config.turnstile}
          onToken={setChallenge}
          resetKey={resetKey}
        />
      )}{" "}
      {error && (
        <p role="alert" className="notice text-sm">
          {error}
        </p>
      )}
      {attempt && (
        <p className="text-xs muted">
          Checkout saved. Retrying uses your original cart and payment method.
        </p>
      )}
      {config?.paypal && (!attempt || attempt.payment_method === "PAYPAL") && (
        <PayPalScriptProvider
          options={{
            clientId: config.paypal,
            currency: config.currency,
            intent: "capture",
          }}
        >
          <PayPalButtons
            disabled={
              busy ||
              (!!config.turnstile && !challenge) ||
              (!items.length && !attempt)
            }
            style={{ layout: "vertical", color: "gold", label: "pay" }}
            createOrder={async () => {
              try {
                return (await prepare("PAYPAL")).provider_id;
              } catch (e) {
                setError((e as Error).message);
                throw e;
              }
            }}
            onApprove={async () => {
              setBusy(true);
              try {
                const saved = resultRef.current ?? (await prepare("PAYPAL"));
                const status = await api<{ status: string }>(
                  "/api/public/receipt",
                  json("POST", { token: saved.receipt_token }),
                );
                if (status.status === "COMPLETE") paid(saved.receipt_token);
                else
                  setError(
                    "Payment is pending. Check your receipt before trying again.",
                  );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            onError={(e) =>
              setError(
                e instanceof Error
                  ? e.message
                  : "PayPal could not open. Retry the same checkout.",
              )
            }
          />
        </PayPalScriptProvider>
      )}
      {config?.mercadopago &&
        (!attempt || attempt.payment_method === "MERCADOPAGO") &&
        (result?.provider_id ? (
          <Wallet initialization={{ preferenceId: result.provider_id }} />
        ) : (
          <Button
            className="w-full"
            disabled={
              busy ||
              (!!config.turnstile && !challenge) ||
              (!items.length && !attempt)
            }
            onClick={async () => {
              setBusy(true);
              try {
                await prepare("MERCADOPAGO");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Pay with MercadoPago
          </Button>
        ))}
      {config && !config.paypal && !config.mercadopago && (
        <p className="notice text-sm">
          Online payments are not configured yet. Contact the shop to purchase.
        </p>
      )}
      {result && (
        <a
          className="text-brand text-sm underline"
          href={`/receipt/${result.receipt_token}`}
        >
          View order & payment status →
        </a>
      )}
    </div>
  );
}
