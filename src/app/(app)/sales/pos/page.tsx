"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Field,
  Input,
  Select,
  Skeleton,
  useToast,
} from "@/components/ui";
import { calculateSubtotal, formatRupiah } from "@/lib/calculations";
import { ApiError, api, type Paged } from "@/lib/client";

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  selling_price: number;
  current_stock: number;
}

export default function PosPage() {
  const router = useRouter();
  const toast = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [paid, setPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function loadProducts() {
    setLoadError(null);
    try {
      const d = await api<Paged<Product>>("/api/products?limit=100&sortBy=name");
      setProducts(d.items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat produk");
    }
  }
  useEffect(() => {
    void loadProducts();
  }, []);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId.get(id), qty }))
    .filter((l): l is { product: Product; qty: number } => Boolean(l.product));
  const total = lines.reduce((a, l) => a + calculateSubtotal(l.product.selling_price, l.qty), 0);
  const paidNum = Number(paid || 0);
  const change = paidNum - total;
  const cashShort = method === "CASH" && paid !== "" && change < 0;

  const shown = (products ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  function setQty(id: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      const max = byId.get(id)?.current_stock ?? 0;
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, max);
      return next;
    });
  }

  async function submit() {
    if (inFlight.current || lines.length === 0) return;
    if (method === "CASH" && paid !== "" && change < 0) {
      setError("Uang bayar kurang dari total belanja");
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const sale = await api<{ id: string }>("/api/sales", {
        method: "POST",
        body: {
          payment_method: method,
          notes: notes.trim() || undefined,
          items: lines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
        },
      });
      toast("Transaksi tersimpan");
      router.push("/sales/view?id=" + sale.id + "&baru=1");
    } catch (e) {
      if (e instanceof ApiError && e.code === "STOCK_INSUFFICIENT") {
        setError(e.message);
        await loadProducts(); // segarkan stok terkini
        setCart((c) => {
          const next = { ...c };
          for (const id of Object.keys(next)) delete next[id];
          return next;
        });
        toast("Stok berubah. Keranjang dikosongkan, silakan input ulang.", "err");
      } else setError(e instanceof Error ? e.message : "Gagal menyimpan transaksi");
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kasir</h1>
        <p className="text-sm text-muted">Pilih barang, atur jumlah, lalu simpan transaksi.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
        <section aria-label="Daftar barang" className="grid content-start gap-3">
          <Input aria-label="Cari barang" placeholder="Cari nama atau SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
          {loadError ? (
            <div className="grid gap-3">
              <Alert>{loadError}</Alert>
              <div>
                <Button variant="secondary" onClick={() => void loadProducts()}>
                  Coba lagi
                </Button>
              </div>
            </div>
          ) : !products ? (
            <div className="grid gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <Empty title="Barang tidak ditemukan" hint="Periksa ejaan, atau minta pemilik menambahkan barang di menu Produk." />
          ) : (
            <ul className="grid gap-2">
              {shown.map((p) => {
                const inCart = cart[p.id] ?? 0;
                const out = p.current_stock === 0;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted">
                        <span className="font-mono">{p.sku}</span> · {formatRupiah(p.selling_price)} / {p.unit} · stok {p.current_stock}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={out || inCart >= p.current_stock || submitting}
                      onClick={() => setQty(p.id, inCart + 1)}
                      aria-label={"Tambah " + p.name + " ke keranjang"}
                    >
                      {out ? "Habis" : "Tambah"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Card className="grid content-start gap-4 lg:sticky lg:top-24">
          <h2 className="font-semibold">Keranjang</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted">Belum ada barang. Tekan &quot;Tambah&quot; pada barang di sebelah.</p>
          ) : (
            <ul className="grid gap-3">
              {lines.map(({ product: p, qty }) => (
                <li key={p.id} className="grid gap-1.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span>{formatRupiah(calculateSubtotal(p.selling_price, qty))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" className="min-w-10 px-0" disabled={submitting} onClick={() => setQty(p.id, qty - 1)} aria-label={"Kurangi " + p.name}>
                      -
                    </Button>
                    <Input
                      aria-label={"Jumlah " + p.name}
                      className="w-20 text-center"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={p.current_stock}
                      value={qty}
                      disabled={submitting}
                      onChange={(e) => setQty(p.id, Math.floor(Number(e.target.value)))}
                    />
                    <Button variant="secondary" className="min-w-10 px-0" disabled={submitting || qty >= p.current_stock} onClick={() => setQty(p.id, qty + 1)} aria-label={"Tambah jumlah " + p.name}>
                      +
                    </Button>
                    <span className="text-xs text-muted">maks {p.current_stock}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-sm text-muted">Total</span>
            <span className="text-2xl font-semibold">{formatRupiah(total)}</span>
          </div>

          <Field label="Metode bayar">
            {(a) => (
              <Select {...a} value={method} disabled={submitting} onChange={(e) => setMethod(e.target.value as typeof method)}>
                <option value="CASH">Tunai</option>
                <option value="TRANSFER">Transfer</option>
              </Select>
            )}
          </Field>
          {method === "CASH" && (
            <Field
              label="Uang diterima (Rp)"
              error={cashShort ? "Uang bayar kurang " + formatRupiah(-change) : undefined}
              hint={paid !== "" && change >= 0 ? "Kembalian " + formatRupiah(change) : undefined}
            >
              {(a) => <Input {...a} type="number" inputMode="numeric" min={0} step={1} value={paid} disabled={submitting} onChange={(e) => setPaid(e.target.value)} />}
            </Field>
          )}
          <Field label="Catatan (opsional)">
            {(a) => <Input {...a} value={notes} maxLength={500} disabled={submitting} onChange={(e) => setNotes(e.target.value)} />}
          </Field>

          {error && <Alert>{error}</Alert>}
          <Button onClick={submit} loading={submitting} disabled={lines.length === 0 || cashShort}>
            Simpan transaksi
          </Button>
        </Card>
      </div>
    </div>
  );
}
