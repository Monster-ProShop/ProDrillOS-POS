"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingBag,
  ScanBarcode,
  Package,
  Users,
  Wrench,
  ClipboardList,
  BarChart3,
  Truck,
} from "lucide-react";
export function Nav() {
  const path = usePathname();
  if (
    path === "/store" ||
    path.startsWith("/proposal/") ||
    path.startsWith("/receipt/")
  )
    return (
      <nav className="flex gap-5 text-sm">
        <Link href="/store">Shop equipment</Link>
        <Link className="muted" href="/pos">
          Staff sign-in →
        </Link>
      </nav>
    );
  return (
    <nav aria-label="Main navigation" className="flex flex-wrap gap-2">
      {[
        ["/pos", "Checkout", ScanBarcode],
        ["/inventory", "Inventory", Package],
        ["/receiving", "Receiving", Truck],
        ["/customers", "Customers", Users],
        ["/services", "Services", Wrench],
        ["/proposals", "Proposals", ClipboardList],
        ["/reports", "Reports", BarChart3],
        ["/store", "Store", ShoppingBag],
      ].map(([href, name, Icon]) => (
        <Link
          key={String(href)}
          href={String(href)}
          aria-current={path === href ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${path === href ? "bg-brand text-brand-ink font-bold" : "muted hover:bg-surface"}`}
        >
          <Icon size={15} />
          {String(name)}
        </Link>
      ))}
    </nav>
  );
}
