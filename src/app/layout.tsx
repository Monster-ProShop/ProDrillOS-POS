import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { brand } from "@/lib/brand";
import "./globals.css";
export const metadata: Metadata = {
  title: "ProDrillOS POS · Pro shop & equipment",
  description:
    "Bowling equipment, precision services, and pro shop operations.",
  referrer: "no-referrer",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  const logo = process.env.NEXT_PUBLIC_BRAND_LOGO || brand.logo;
  return (
    <html lang="en">
      <body>
        <header className="border-b border-white/10 px-5 py-5 md:px-10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5">
            <a
              href="/store"
              aria-label="ProDrillOS home"
              className="flex items-center gap-3"
            >
              <img
                src={logo}
                alt=""
                className="h-12 w-12 rounded-lg object-cover"
              />
              <span className="text-2xl font-bold tracking-tight">
                ProDrill<span className="text-brand">OS</span>
              </span>
              <span className="rounded border border-white/20 px-2 py-1 text-[10px] tracking-widest">
                PRO SHOP
              </span>
            </a>
            <Nav />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-9 md:px-10">{children}</main>
        <footer className="mx-auto max-w-7xl px-10 py-6 text-xs muted">
          ProDrillOS · Bowling pro shop operations
        </footer>
      </body>
    </html>
  );
}
