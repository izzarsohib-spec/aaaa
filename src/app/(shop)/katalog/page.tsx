"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Button, Empty, Pagination, Select, Skeleton } from "@/components/ui";
import { ProductCard, type ShopProduct } from "@/components/shop/product-card";
import { api, type Paged } from "@/lib/client";
import { CATEGORIES } from "@/lib/shop";

function Catalog() {
  const router = useRouter();
  const sp = useSearchParams();
  const category = sp.get("category") ?? "";
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "newest";
  const inStock = sp.get("in_stock") === "1";
  const page = Number(sp.get("page") ?? "1") || 1;

  const [data, setData] = useState<Paged<ShopProduct> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function go(next: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!("page" in next)) p.delete("page");
    router.push("/katalog?" + p.toString());
  }

  useEffect(() => {
    setData(null);
    setError(null);
    const qs = new URLSearchParams({ page: String(page), limit: "12", sortBy: sort });
    if (category) qs.set("category", category);
    if (q) qs.set("search", q);
    if (inStock) qs.set("in_stock", "1");
    api<Paged<ShopProduct>>("/api/shop/products?" + qs)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat produk"));
  }, [category, q, sort, inStock, page]);

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
      <aside className="grid content-start gap-5 rounded-lg border border-border bg-surface p-4" aria-label="Filter">
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-sm font-semibold">Kategori</legend>
          {[["", "Semua produk"], ...CATEGORIES.map((c) => [c, c])].map(([value, label]) => (
            <label key={value} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="category" checked={category === value} onChange={() => go({ category: value || null })} />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={inStock} onChange={(e) => go({ in_stock: e.target.checked ? "1" : null })} />
          Hanya yang tersedia
        </label>
      </aside>

      <section className="grid content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {q ? "Hasil untuk \"" + q + "\"" : category || "Semua Produk"}
            {data && <span className="ml-2 text-sm font-normal text-muted">({data.total} produk)</span>}
          </h1>
          <label className="flex items-center gap-2 text-sm">
            Urutkan
            <Select value={sort} onChange={(e) => go({ sort: e.target.value })} className="w-auto" aria-label="Urutkan produk">
              <option value="newest">Terbaru</option>
              <option value="price_asc">Harga terendah</option>
              <option value="price_desc">Harga tertinggi</option>
              <option value="name">Nama A-Z</option>
            </Select>
          </label>
        </div>

        {error ? (
          <div className="grid gap-3">
            <Alert>{error}</Alert>
            <div>
              <Button variant="secondary" onClick={() => router.refresh()}>
                Coba lagi
              </Button>
            </div>
          </div>
        ) : !data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <Empty title="Produk tidak ditemukan" hint="Coba kategori lain atau kata kunci yang berbeda." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {data.items.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(n) => go({ page: String(n) })} />
          </>
        )}
      </section>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Catalog />
    </Suspense>
  );
}
