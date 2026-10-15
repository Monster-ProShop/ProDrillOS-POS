"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
type Widget = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
export function Turnstile({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetKey: number;
}) {
  const container = useRef<HTMLDivElement>(null),
    callback = useRef(onToken);
  callback.current = onToken;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const api = (window as unknown as { turnstile?: Widget }).turnstile;
    if (!ready || !api || !container.current) return;
    const id = api.render(container.current, {
      sitekey: siteKey,
      action: "checkout",
      theme: "dark",
      callback: (token: string) => callback.current(token),
      "expired-callback": () => callback.current(""),
      "error-callback": () => callback.current(""),
    });
    return () => api.remove(id);
  }, [ready, siteKey, resetKey]);
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
      />
      <div ref={container} />
    </>
  );
}
