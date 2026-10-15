"use client";
import { Mail, MessageCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
export function ShareLinks({
  url,
  title,
  phone,
  email,
}: {
  url: string;
  title: string;
  phone?: string | null;
  email?: string | null;
}) {
  const [message, setMessage] = useState("");
  const text = `ProDrillOS POS · ${title}\n${url}`;
  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a
          href={`https://wa.me/${(phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={16} />
          WhatsApp
        </a>
      </Button>
      <Button asChild variant="outline">
        <a
          href={`mailto:${email ?? ""}?subject=${encodeURIComponent(`ProDrillOS · ${title}`)}&body=${encodeURIComponent(text)}`}
        >
          <Mail size={16} />
          Email draft
        </a>
      </Button>
      <Button
        variant="ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage("Link copied");
          } catch {
            setMessage(url);
          }
        }}
      >
        <Copy size={16} />
        Copy link
      </Button>
      {message && (
        <p role="status" className="text-xs muted break-all">
          {message}
        </p>
      )}
    </div>
  );
}
