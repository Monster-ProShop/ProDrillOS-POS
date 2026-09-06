"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function Nav() {
  const path = usePathname();
  return <nav aria-label="Main navigation" className="flex flex-wrap gap-2">
    {[["/pos", "Checkout"], ["/inventory", "Inventory"], ["/invoices", "Invoice import"], ["/reports", "Daily report"]].map(([href, name]) =>
      <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
        className={`rounded-lg px-4 py-2 text-sm ${path === href ? "bg-brand text-brand-ink font-bold" : "muted hover:bg-surface"}`}>{name}</Link>)}
  </nav>;
}
