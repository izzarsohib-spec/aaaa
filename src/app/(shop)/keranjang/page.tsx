"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Empty, Skeleton } from "@/components/ui";
import { useCart } from "@/components/shop/cart";
import { ProductArt } from "@/components/shop/product-art";
import type { ShopProduct } from "@/components/shop/product-card";
import { calculateSubtotal, formatRupiah } from "@/lib/calculations";
import { api } from "@/lib/client";

export default function CartPage() {
  const cart = useCart();
  const [products, setProducts] = useState<Record<string, ShopProduct | null>>({});
  const [loaded, setLoaded] = useState(false);

  const ids = cart.lines.map((l) => l.product_id).join(",");
  useEffect(() => {
    if (!cart.ready) return;
    let cancelled = false;
    Promise.all(
      cart.lines.map((l) =>
        api<ShopProduct>("/api/shop/products/" + l.product_id)
          .then((p) => [l.product_id, p] as const)
          .catch(() => [l.product_id, null] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setProducts(Object.fromEntries(pairs));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready, ids]);

  if (!cart.ready || (cart.lines.length > 0 && !loaded)) return <Skeleton className="h-64" />;
  if (cart.lines.length === 0) {
    return (
      <Empty
        title="Keranjang masih kosong"
        hint="Pilih seragam, sepatu, atau atribut dari katalog, lalu kembali ke sini untuk checkout."
        action={<Link href="/katalog" className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">Lihat katalog</Link>}
      />
    );
  }

  const rows = cart.lines.map((l) => ({ line: l, p: products[l.product_id] }));
  const unavailable = rows.filter((r) => !r.p || r.p.current_stock < 1 || r.line.quantity > r.p.current_stock);
  const subtotal = rows.reduce((a, r) => a + (r.p ? calculateSubtotal(r.p.selling_price, r.line.quantity) : 0), 0);

  return (
    <div className="grid gap-5">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Keranjang Belanja <span className="text-base font-normal text-muted">({cart.lines.length} produk)</span></h1>
        <button onClick={cart.clear} className="text-sm font-medium text-danger hover:underline">Hapus semua</button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <ul className="grid gap-3">
          {rows.map(({ line, p }) => (
            <li key={line.product_id} className="grid grid-cols-[5rem_1fr] gap-3 rounded-lg border border-border bg-surface p-3">
              {p ? <ProductArt category={p.category} name={p.name} src={p.image_url} /> : <div className="aspect-square rounded-md bg-zinc-200" />}
              <div className="grid content-start gap-1">
                {p ? (
                  <>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted">{formatRupiah(p.selling_price)} / {p.unit}</p>
                    {line.quantity > p.current_stock && (
                      <p className="text-sm font-medium text-danger" role="alert">
                        {p.current_stock > 0 ? "Stok tersisa " + p.current_stock + ". Kurangi jumlah." : "Stok habis. Hapus dari keranjang."}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-medium text-danger" role="alert">Produk ini sudah tidak tersedia.</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button variant="secondary" className="min-w-10 px-0" disabled={line.quantity <= 1} onClick={() => cart.setQty(line.product_id, line.quantity - 1, p?.current_stock)} aria-label="Kurangi jumlah">-</Button>
                  <span className="w-8 text-center" aria-live="polite">{line.quantity}</span>
                  <Button variant="secondary" className="min-w-10 px-0" disabled={!p || line.quantity >= p.current_stock} onClick={() => cart.setQty(line.product_id, line.quantity + 1, p?.current_stock)} aria-label="Tambah jumlah">+</Button>
                  <span className="ml-auto font-semibold">{p ? formatRupiah(calculateSubtotal(p.selling_price, line.quantity)) : "-"}</span>
                  <button onClick={() => cart.remove(line.product_id)} className="text-sm text-danger hover:underline" aria-label="Hapus dari keranjang">Hapus</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <aside className="grid content-start gap-3 rounded-lg border border-border bg-surface p-5">
          <div className="flex justify-between text-sm"><span className="text-muted">Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
          <p className="text-xs text-muted">Ongkos kirim dihitung di halaman checkout. Harga final dihitung ulang oleh toko.</p>
          <Link
            href={unavailable.length ? "#" : "/checkout"}
            aria-disabled={unavailable.length > 0}
            className={"inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover " + (unavailable.length ? "pointer-events-none opacity-50" : "")}
          >
            Checkout
          </Link>
          <Link href="/katalog" className="text-center text-sm font-medium text-accent hover:underline">Lanjutkan belanja</Link>
        </aside>
      </div>
    </div>
  );
}
