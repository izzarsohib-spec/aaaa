"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/calculations";
import { useCart } from "./cart";
import { ProductArt } from "./product-art";
import { useToast } from "@/components/ui";

export interface ShopProduct {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category: string;
  description: string | null;
  image_url: string | null;
  selling_price: number;
  current_stock: number;
}

export function ProductCard({ p }: { p: ShopProduct }) {
  const cart = useCart();
  const toast = useToast();
  const router = useRouter();
  const out = p.current_stock <= 0;
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <Link href={"/produk?id=" + p.id} aria-label={p.name}>
        <ProductArt category={p.category} name={p.name} src={p.image_url} />
      </Link>
      <div className="grid flex-1 content-start gap-1">
        <Link href={"/produk?id=" + p.id} className="line-clamp-2 text-sm font-medium hover:text-accent">
          {p.name}
        </Link>
        <p className="text-base font-bold text-navy">{formatRupiah(p.selling_price)}</p>
        <p className={"text-xs " + (out ? "font-medium text-danger" : p.current_stock <= 5 ? "text-warn" : "text-muted")}>
          {out ? "Stok habis" : "Stok: " + p.current_stock + " " + p.unit}
        </p>
      </div>
      <div className="grid gap-2">
        <button
          disabled={out}
          onClick={() => {
            router.push("/produk?id=" + p.id);
          }}
          className="min-h-10 rounded-md bg-gold px-3 text-sm font-bold text-navy hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {out ? "Habis" : "Beli sekarang"}
        </button>
        <button
          disabled={out}
          onClick={() => {
            cart.add(p.id, 1, p.current_stock);
            toast(p.name + " masuk keranjang");
          }}
          className="min-h-10 rounded-md border border-border px-3 text-sm font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          Masukkan keranjang
        </button>
      </div>
    </article>
  );
}
