"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ShoppingBag,
  SlidersHorizontal,
  CircleDot,
  Footprints,
  Briefcase,
  Package,
  ShieldCheck,
} from "lucide-react";
import { api, money } from "@/lib/client";
import { type CatalogProduct, categoryName } from "@/lib/commerce-types";
import { Button } from "@/components/ui/button";
import { PaymentButtons } from "@/components/payment-buttons";
export default function Store() {
  const [products, setProducts] = useState<CatalogProduct[]>([]),
    [cart, setCart] = useState<
      Record<string, { product: CatalogProduct; quantity: number }>
    >({}),
    [category, setCategory] = useState("All equipment"),
    [search, setSearch] = useState(""),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [checkout, setCheckout] = useState(false);
  const load = () =>
    api<CatalogProduct[]>("/api/store/products")
      .then((p) => {
        setProducts(p);
        setLoading(false);
        setError("");
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  useEffect(() => {
    try {
      if (localStorage.getItem("store-checkout-attempt")) setCheckout(true);
    } catch {}
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  const matches = (value: unknown, key: string) =>
    !filters[key] || String(value) === filters[key];
  const shown = products.filter(
    (p) =>
      (category === "All equipment" || categoryName(p.category) === category) &&
      `${p.name} ${p.brand ?? ""} ${p.model ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      matches(p.brand, "brand") &&
      matches(p.ball?.weight, "weight") &&
      matches(p.ball?.oil_category, "oil") &&
      matches(p.ball?.rg_category, "rg") &&
      matches(p.shoe?.size, "size") &&
      matches(p.shoe?.tier, "tier") &&
      matches(p.shoe?.style, "style") &&
      matches(p.bag?.ball_capacity, "capacity") &&
      matches(p.bag?.bag_type, "type"),
  );
  const options = (key: string, label: string, values: string[]) => (
    <label key={key}>
      {label}
      <select
        value={filters[key] ?? ""}
        onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
      >
        <option value="">All</option>
        {[...new Set(values)].sort().map((v) => (
          <option value={v} key={v}>
            {v.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
  const lines = Object.values(cart),
    total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  return (
    <div className="space-y-9">
      <section className="store-hero relative overflow-hidden rounded-3xl border border-white/10 p-7 md:p-12">
        <div className="relative z-10 max-w-xl">
          <p className="eyebrow mb-4">The pro shop advantage</p>
          <h1 className="!text-4xl md:!text-6xl !leading-[1.07]">
            Built for your
            <br />
            <span className="text-brand">next perfect game.</span>
          </h1>
          <p className="mt-5 max-w-md text-slate-300 leading-relaxed">
            The right equipment. The precise fit. Find your next ball, gear up,
            and make every frame count.
          </p>
          <a
            href="#equipment"
            className="mt-7 inline-flex items-center gap-3 rounded-lg bg-brand px-5 py-3 text-sm font-bold text-brand-ink"
          >
            Explore equipment <ArrowUpRight size={18} />
          </a>
          <p className="mt-5 text-xs muted">
            In-stock equipment · Pro shop pickup
          </p>
        </div>
        <div className="hero-ball" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>
      <section id="equipment" className="space-y-5">
        <div className="flex flex-wrap justify-between gap-4 items-end">
          <div>
            <p className="eyebrow">Curated for the lanes</p>
            <h2 className="!text-3xl">Find your edge.</h2>
          </div>
          <span className="muted text-sm">
            {products.length} available products
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            "All equipment",
            "Bowling balls",
            "Shoes",
            "Bags",
            "Accessories",
          ].map((c) => (
            <Button
              variant={c === category ? "default" : "outline"}
              key={c}
              onClick={() => {
                setCategory(c);
                setFilters({});
              }}
            >
              {c}
            </Button>
          ))}
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[220px_1fr_300px]">
          <aside className="panel space-y-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <SlidersHorizontal size={17} />
              Refine your game
            </h3>
            <label>
              Search
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Brand or model"
              />
            </label>
            {options(
              "brand",
              "Brand",
              products.flatMap((p) => (p.brand ? [p.brand] : [])),
            )}
            {category === "Bowling balls" && (
              <>
                {options(
                  "weight",
                  "Weight (lbs)",
                  products.flatMap((p) =>
                    p.ball ? [String(p.ball.weight)] : [],
                  ),
                )}
                {options("oil", "Lane / oil condition", [
                  "Heavy",
                  "Medium",
                  "Light",
                ])}
                {options("rg", "RG category", ["High", "Medium", "Low"])}
              </>
            )}
            {category === "Shoes" && (
              <>
                {options(
                  "size",
                  "Size",
                  products.flatMap((p) => (p.shoe ? [p.shoe.size] : [])),
                )}
                {options(
                  "style",
                  "Gender / style",
                  products.flatMap((p) => (p.shoe ? [p.shoe.style] : [])),
                )}
                {options("tier", "Level", [
                  "Pro",
                  "Competitive",
                  "Entry_Level",
                ])}
              </>
            )}
            {category === "Bags" && (
              <>
                {options("capacity", "Ball capacity", [
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                ])}
                {options("type", "Bag type", ["Tote", "Wheeled"])}
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setFilters({});
                setSearch("");
              }}
            >
              Reset filters
            </Button>
          </aside>
          <div>
            {error && (
              <p role="alert" className="notice mb-4">
                Catalog unavailable: {error}{" "}
                <button onClick={load}>Retry</button>
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {shown.map((p) => {
                const Icon =
                  categoryName(p.category) === "Bowling balls"
                    ? CircleDot
                    : p.category === "SHOES"
                      ? Footprints
                      : p.category === "BAGS"
                        ? Briefcase
                        : Package;
                return (
                  <article
                    key={p.id}
                    className="product-card rounded-2xl border border-white/10 overflow-hidden"
                  >
                    <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
                      <Icon
                        size={64}
                        strokeWidth={0.8}
                        className="text-brand/70"
                      />
                      <span className="absolute top-3 right-3 text-[10px] text-emerald-300 rounded-full bg-emerald-400/10 px-2 py-1">
                        IN STOCK
                      </span>
                    </div>
                    <div className="p-5 space-y-3">
                      <p className="eyebrow">
                        {p.brand ?? categoryName(p.category)}
                      </p>
                      <h3 className="text-lg font-semibold">{p.name}</h3>
                      <p className="text-xs muted min-h-8">
                        {p.ball
                          ? `${p.ball.weight} lbs · ${p.ball.oil_category} oil · ${p.ball.rg_category} RG`
                          : p.shoe
                            ? `${p.shoe.size} · ${p.shoe.style} · ${p.shoe.tier.replaceAll("_", " ")}`
                            : p.bag
                              ? `${p.bag.ball_capacity}-ball · ${p.bag.bag_type}`
                              : (p.model ?? p.sku)}
                      </p>
                      <div className="flex justify-between items-center">
                        <strong className="text-xl">{money(p.price)}</strong>
                        <Button
                          size="sm"
                          disabled={
                            checkout ||
                            (cart[p.id]?.quantity ?? 0) >= p.stock_quantity
                          }
                          onClick={() =>
                            setCart((c) => ({
                              ...c,
                              [p.id]: {
                                product: p,
                                quantity: (c[p.id]?.quantity ?? 0) + 1,
                              },
                            }))
                          }
                        >
                          <ShoppingBag size={15} />
                          Add
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {!shown.length && !error && (
              <div className="panel py-16 text-center muted">
                {loading
                  ? "Loading equipment…"
                  : "No in-stock products match. Try another category or check back soon."}
              </div>
            )}
          </div>
          <aside className="panel space-y-4 xl:sticky xl:top-6">
            <div className="flex justify-between">
              <h2>Your bag</h2>
              <ShoppingBag size={20} className="text-brand" />
            </div>
            {!lines.length && (
              <p className="muted text-sm py-6">
                Your next game starts here. Add some equipment to your bag.
              </p>
            )}
            {lines.map(({ product: p, quantity: q }) => (
              <div key={p.id} className="border-b border-white/10 pb-3">
                <p className="text-sm font-semibold">{p.name}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="muted text-xs">
                    {q} × {money(p.price)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={checkout}
                    aria-label={`Remove one ${p.name}`}
                    onClick={() =>
                      setCart((c) => {
                        const next = { ...c };
                        if (q === 1) delete next[p.id];
                        else next[p.id] = { product: p, quantity: q - 1 };
                        return next;
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            <p className="muted text-xs">
              Pro shop pickup. Prices and availability confirmed at checkout.
            </p>
            {!checkout ? (
              <Button
                className="w-full"
                disabled={!lines.length}
                onClick={() => setCheckout(true)}
              >
                Continue to payment
              </Button>
            ) : (
              <PaymentButtons
                items={lines.map((l) => ({
                  product_id: l.product.id,
                  quantity: l.quantity,
                }))}
                onReserved={() => {
                  void load();
                }}
              />
            )}
            <p className="flex items-center gap-2 muted text-xs">
              <ShieldCheck size={15} />
              Secure provider checkout
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
