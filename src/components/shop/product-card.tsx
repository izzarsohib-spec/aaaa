"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/calculations";
import { useState } from "react";
import { useCart } from "./cart";
import { ProductArt } from "./product-art";
import { SizeBreakdown } from "./size-picker";
import { PANTS_SIZES, SHIRT_SIZES, mergeRows, needsSize, sizeLabel, sumRows, type SizeRow } from "@/lib/shop";
import { Button, Dialog, Input, useToast } from "@/components/ui";

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

function AddForm({ p, mode, onClose }: { p: ShopProduct; mode: "cart" | "buy"; onClose: () => void }) {
  const cart = useCart();
  const toast = useToast();
  const router = useRouter();
  const [qty, setQtyState] = useState(1);
  const [shirts, setShirts] = useState<SizeRow[]>([{ size: "", qty: 1 }]);
  const [pants, setPants] = useState<SizeRow[]>([{ size: "", qty: 1 }]);
  const [tried, setTried] = useState(false);
  const sized = needsSize(p.category);
  const max = Math.max(1, p.current_stock);
  // Jika baru satu baris, jumlahnya ikut jumlah seragam supaya tidak perlu diisi ulang.
  const setQty = (raw: number) => {
    const n = Math.max(1, Math.min(max, Math.floor(raw) || 1));
    setQtyState(n);
    const follow = (rows: SizeRow[]) => (rows.length === 1 ? [{ ...rows[0], qty: n }] : rows);
    setShirts(follow);
    setPants(follow);
  };
  const valid = (rows: SizeRow[]) => sumRows(rows) === qty && rows.every((r) => r.size && r.qty > 0);
  const submit = () => {
    if (sized) {
      if (!valid(shirts) || !valid(pants)) {
        setTried(true);
        return;
      }
      cart.add(p.id, qty, p.current_stock, sizeLabel(mergeRows(shirts, SHIRT_SIZES), mergeRows(pants, PANTS_SIZES)), true);
    } else {
      cart.add(p.id, qty, p.current_stock);
    }
    onClose();
    if (mode === "buy") router.push("/keranjang");
    else toast(qty + " x " + p.name + " masuk keranjang");
  };
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="w-20 shrink-0">
          <ProductArt category={p.category} name={p.name} src={p.image_url} />
        </div>
        <div className="grid gap-1">
          <p className="text-sm font-medium">{p.name}</p>
          <p className="text-sm text-muted">{formatRupiah(p.selling_price)} / {p.unit} · Stok {p.current_stock}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2" role="group" aria-label="Jumlah">
          <span className="mr-1 text-sm font-medium">Jumlah</span>
          <Button variant="secondary" className="min-w-10 px-0" disabled={qty <= 1} onClick={() => setQty(qty - 1)} aria-label="Kurangi jumlah">
            -
          </Button>
          <Input type="number" inputMode="numeric" min={1} max={max} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-20 text-center" aria-label="Jumlah" />
          <Button variant="secondary" className="min-w-10 px-0" disabled={qty >= max} onClick={() => setQty(qty + 1)} aria-label="Tambah jumlah">
            +
          </Button>
        </div>
        <p className="text-lg font-bold text-navy">{formatRupiah(p.selling_price * qty)}</p>
      </div>
      {sized && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SizeBreakdown title="Ukuran baju" options={SHIRT_SIZES} rows={shirts} onChange={setShirts} total={qty} error={tried} />
          <SizeBreakdown title="Ukuran celana" options={PANTS_SIZES} rows={pants} onChange={setPants} total={qty} error={tried} />
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        <button onClick={submit} className="min-h-10 rounded-md bg-gold px-4 text-sm font-bold text-navy hover:bg-gold-hover">
          {mode === "buy" ? "Beli sekarang" : "Masukkan keranjang"}
        </button>
      </div>
    </>
  );
}

/** Popup pilih jumlah, lalu ukuran baju dan celana tiap seragam. */
export function AddToCartDialog({ p, open, onClose, mode = "cart" }: { p: ShopProduct; open: boolean; onClose: () => void; mode?: "cart" | "buy" }) {
  return (
    <Dialog open={open} wide title={mode === "buy" ? "Beli sekarang" : "Masukkan ke keranjang"} onClose={onClose}>
      <AddForm p={p} mode={mode} onClose={onClose} />
    </Dialog>
  );
}

export function ProductCard({ p }: { p: ShopProduct }) {
  const router = useRouter();
  const out = p.current_stock <= 0;
  const [open, setOpen] = useState(false);
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
            setOpen(true);
          }}
          className="min-h-10 rounded-md border border-border px-3 text-sm font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          Masukkan keranjang
        </button>
      </div>
      <AddToCartDialog p={p} open={open} onClose={() => setOpen(false)} />
    </article>
  );
}
