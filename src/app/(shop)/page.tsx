"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui";
import { ProductArt } from "@/components/shop/product-art";
import { ProductCard, type ShopProduct } from "@/components/shop/product-card";
import { api, type Paged } from "@/lib/client";
import { STORE, whatsappLink } from "@/lib/shop";

const TILES = ["Seragam Satpam", "Celana", "Sepatu", "Topi", "Atribut", "Paket Hemat"];

export default function HomePage() {
  const [items, setItems] = useState<ShopProduct[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<Paged<ShopProduct>>("/api/shop/products?limit=8&sortBy=newest")
      .then((d) => setItems(d.items))
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="grid gap-10">
      <section className="grid items-center gap-6 overflow-hidden rounded-lg bg-navy p-6 text-white md:grid-cols-[1.2fr_1fr] md:p-10">
        <div className="grid gap-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-gold">Adzkia Collection</p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            Seragam Satpam
            <br />
            Lengkap &amp; Berkualitas
          </h1>
          <ul className="grid gap-1.5 text-sm text-blue-100">
            <li>✓ Bahan nyaman dan tahan lama</li>
            <li>✓ Bisa custom logo dan bordir</li>
            <li>✓ Pengiriman ke seluruh Indonesia</li>
          </ul>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/katalog" className="inline-flex min-h-11 items-center rounded-md bg-gold px-6 text-sm font-bold text-navy hover:bg-gold-hover">
              Belanja Sekarang
            </Link>
            <a
              href={whatsappLink("Halo " + STORE.name + ", saya ingin konsultasi seragam.")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-md border border-white/40 px-5 text-sm font-medium hover:bg-white/10"
            >
              Konsultasi via WhatsApp
            </a>
          </div>
        </div>
        <div className="hidden grid-cols-2 gap-3 md:grid" aria-hidden>
          <ProductArt category="Seragam Satpam" name="Seragam" />
          <ProductArt category="Topi" name="Topi" />
          <ProductArt category="Sepatu" name="Sepatu" />
          <ProductArt category="Atribut" name="Atribut" />
        </div>
      </section>

      <section aria-label="Kategori" className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {TILES.map((c) => (
          <Link
            key={c}
            href={"/katalog?category=" + encodeURIComponent(c)}
            className="grid gap-2 rounded-lg border border-border bg-surface p-3 text-center text-sm font-medium hover:border-accent"
          >
            <ProductArt category={c} name={c} />
            {c}
          </Link>
        ))}
      </section>

      <section aria-label="Produk pilihan" className="grid gap-4">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Produk Pilihan</h2>
          <Link href="/katalog" className="text-sm font-medium text-accent hover:underline">
            Lihat semua
          </Link>
        </div>
        {failed ? (
          <p className="text-sm text-muted">Produk belum dapat dimuat. Coba muat ulang halaman.</p>
        ) : !items ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">Produk akan segera tersedia.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-lg border border-border bg-surface p-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Produk berkualitas", "Bahan dipilih untuk pemakaian harian di lapangan."],
          ["Pengiriman cepat", "Dikirim lewat JNE, J&T, dan SiCepat."],
          ["Bisa custom logo", "Bordir nama dan logo perusahaan Anda."],
          ["Harga grosir", "Penawaran khusus untuk perusahaan dan instansi."],
        ].map(([t, d]) => (
          <div key={t}>
            <p className="font-semibold text-navy">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
