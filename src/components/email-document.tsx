"use client";
import { useState } from "react";
import { Mail } from "lucide-react";
import { api, json } from "@/lib/client";
import { Button } from "@/components/ui/button";
export function EmailDocument({
  kind,
  id,
}: {
  kind: "receipt" | "proposal";
  id: string;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="no-print">
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/documents/email", json("POST", { kind, id }));
            setMessage("Email accepted by delivery provider.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Mail size={16} />
        {busy ? "Sending…" : "Email customer"}
      </Button>
      {message && (
        <p role="status" className="text-sm muted mt-2">
          {message}
        </p>
      )}
    </div>
  );
}
