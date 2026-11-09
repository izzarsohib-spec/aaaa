"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Button, Skeleton } from "@/components/ui";
import { ProductArt } from "@/components/shop/product-art";
import { AddForm, AddToCartDialog, type ShopProduct } from "@/components/shop/product-card";
import { formatRupiah } from "@/lib/calculations";
import { api } from "@/lib/client";
import { STORE, whatsappLink } from "@/lib/shop";

function Detail() {
  const id = useSearchParams().get("id");
  const [p, setP] = useState<ShopProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);

  useEffect(() => {
    if (!id) {
      setError("Produk tidak ditemukan");
      return;
    }
    api<ShopProduct>("/api/shop/products/" + id)
      .then(setP)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat produk"));
  }, [id]);

  if (error) {
    return (
      <div className="grid max-w-md gap-3">
        <Alert>{error}</Alert>
        <Link href="/katalog" className="text-sm font-medium text-accent hover:underline">
          Kembali ke katalog
        </Link>
      </div>
    );
  }
  if (!p) return <Skeleton className="h-96" />;

  const out = p.current_stock <= 0;
  return (
    <div className="grid gap-6">
      <nav aria-label="Jejak halaman" className="text-sm text-muted">
        <Link href="/" className="hover:underline">Beranda</Link> / <Link href={"/katalog?category=" + encodeURIComponent(p.category)} className="hover:underline">{p.category}</Link> / {p.name}
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <ProductArt category={p.category} name={p.name} src={p.image_url} />
        <div className="grid content-start gap-4">
          <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
          <p className="text-3xl font-bold text-navy">{formatRupiah(p.selling_price)}</p>
          <p className={"text-sm " + (out ? "font-medium text-danger" : "text-muted")}>
            {out ? "Stok habis" : "Stok tersedia: " + p.current_stock + " " + p.unit} · SKU {p.sku}
          </p>
          {p.description && <p className="max-w-[60ch] text-sm leading-relaxed">{p.description}</p>}
          {out ? (
            <Button disabled>Stok habis</Button>
          ) : (
            <AddForm
              p={p}
              mode="buy"
              inline
              onClose={() => {}}
              secondary={
                <Button variant="secondary" onClick={() => setDialog(true)}>
                  Masukkan keranjang
                </Button>
              }
            />
          )}
          <AddToCartDialog p={p} open={dialog} onClose={() => setDialog(false)} />
          <a
            href={whatsappLink("Halo " + STORE.name + ", saya ingin bertanya tentang " + p.name + " (" + p.sku + ").")}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-accent hover:underline"
          >
            Tanya produk ini via WhatsApp
          </a>
          <ul className="grid grid-cols-2 gap-2 border-t border-border pt-4 text-sm text-muted">
            <li>✓ Produk original</li>
            <li>✓ Pengiriman cepat</li>
            <li>✓ Bisa custom logo</li>
            <li>✓ Garansi produk</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Detail />
    </Suspense>
  );
}
