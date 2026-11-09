"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Button, Skeleton, useToast } from "@/components/ui";
import { useCart } from "@/components/shop/cart";
import { ProductArt } from "@/components/shop/product-art";
import type { ShopProduct } from "@/components/shop/product-card";
import { formatRupiah } from "@/lib/calculations";
import { api } from "@/lib/client";
import { EMPTY_SIZES, SizePicker, type Sizes } from "@/components/shop/size-picker";
import { STORE, needsSize, sizeLabel, whatsappLink } from "@/lib/shop";

function Detail() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const cart = useCart();
  const toast = useToast();
  const [p, setP] = useState<ShopProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [sizes, setSizes] = useState<Sizes>(EMPTY_SIZES);
  const [tried, setTried] = useState(false);

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
  const max = p.current_stock;
  const sized = needsSize(p.category);
  const addToCart = () => {
    if (sized && (!sizes.shirt || !sizes.pants)) {
      setTried(true);
      return false;
    }
    cart.add(p.id, qty, max, sized ? sizeLabel(sizes.shirt, sizes.pants) : undefined);
    return true;
  };

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
          {sized && <SizePicker value={sizes} onChange={setSizes} error={tried} />}
          <div className="flex items-center gap-2" role="group" aria-label="Jumlah">
            <Button variant="secondary" className="min-w-10 px-0" disabled={out || qty <= 1} onClick={() => setQty(qty - 1)} aria-label="Kurangi jumlah">
              -
            </Button>
            <span className="w-10 text-center font-medium" aria-live="polite">{qty}</span>
            <Button variant="secondary" className="min-w-10 px-0" disabled={out || qty >= max} onClick={() => setQty(qty + 1)} aria-label="Tambah jumlah">
              +
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              disabled={out}
              onClick={() => {
                if (addToCart()) toast(p.name + " masuk keranjang");
              }}
            >
              Masukkan keranjang
            </Button>
            <button
              disabled={out}
              onClick={() => {
                if (addToCart()) router.push("/keranjang");
              }}
              className="min-h-10 rounded-md bg-gold px-4 text-sm font-bold text-navy hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Beli sekarang
            </button>
          </div>
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
