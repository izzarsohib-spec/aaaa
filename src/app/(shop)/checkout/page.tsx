"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Empty, Field, Input, Skeleton } from "@/components/ui";
import { useCart } from "@/components/shop/cart";
import { rememberOrder, type OrderDetail } from "@/components/shop/order-types";
import type { ShopProduct } from "@/components/shop/product-card";
import { calculateSubtotal, formatRupiah } from "@/lib/calculations";
import { ApiError, api } from "@/lib/client";
import { SHIPPING } from "@/lib/shop";

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const [products, setProducts] = useState<Record<string, ShopProduct | null>>({});
  const [loaded, setLoaded] = useState(false);
  const [shipping, setShipping] = useState<(typeof SHIPPING)[number]["id"]>("JNE_REG");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);

  useEffect(() => {
    if (!cart.ready) return;
    Promise.all(
      cart.lines.map((l) =>
        api<ShopProduct>("/api/shop/products/" + l.product_id)
          .then((p) => [l.product_id, p] as const)
          .catch(() => [l.product_id, null] as const),
      ),
    ).then((pairs) => {
      setProducts(Object.fromEntries(pairs));
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready]);

  if (!cart.ready || !loaded) return <Skeleton className="h-96" />;
  if (cart.lines.length === 0) {
    return (
      <Empty
        title="Keranjang kosong"
        hint="Tambahkan barang ke keranjang sebelum checkout."
        action={<Link href="/katalog" className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">Lihat katalog</Link>}
      />
    );
  }

  const rows = cart.lines.map((l) => ({ line: l, p: products[l.product_id] }));
  const subtotal = rows.reduce((a, r) => a + (r.p ? calculateSubtotal(r.p.selling_price, r.line.quantity) : 0), 0);
  const ship = SHIPPING.find((s) => s.id === shipping)!;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    const f = new FormData(e.currentTarget);
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    setErrors({});
    try {
      const phone = String(f.get("phone"));
      const order = await api<OrderDetail>("/api/shop/orders", {
        method: "POST",
        body: {
          customer_name: String(f.get("customer_name")),
          phone,
          address: String(f.get("address")),
          city: String(f.get("city")),
          postal_code: String(f.get("postal_code") || "") || undefined,
          shipping_method: shipping,
          notes: String(f.get("notes") || "") || undefined,
          items: cart.lines,
        },
      });
      rememberOrder(order.order_number, phone);
      cart.clear();
      router.push("/pembayaran?no=" + order.order_number);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors ?? {});
        setError(err.errors ? "Periksa kembali isian yang ditandai." : err.message);
      } else setError("Terjadi kesalahan. Coba lagi.");
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid content-start gap-6">
        <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <h2 className="font-semibold">Alamat penerima</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama penerima" error={errors.customer_name}>{(a) => <Input {...a} name="customer_name" autoComplete="name" required />}</Field>
            <Field label="Nomor WhatsApp" error={errors.phone}>{(a) => <Input {...a} name="phone" type="tel" inputMode="tel" autoComplete="tel" required />}</Field>
          </div>
          <Field label="Alamat lengkap" error={errors.address}>{(a) => <Input {...a} name="address" autoComplete="street-address" required />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kota / kabupaten" error={errors.city}>{(a) => <Input {...a} name="city" autoComplete="address-level2" required />}</Field>
            <Field label="Kode pos" error={errors.postal_code}>{(a) => <Input {...a} name="postal_code" inputMode="numeric" autoComplete="postal-code" />}</Field>
          </div>
        </section>
        <fieldset className="grid gap-2 rounded-lg border border-border bg-surface p-5">
          <legend className="px-1 font-semibold">Metode pengiriman</legend>
          {SHIPPING.map((s) => (
            <label key={s.id} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
              <input type="radio" name="shipping" checked={shipping === s.id} onChange={() => setShipping(s.id)} />
              <span className="flex-1">{s.label}</span>
              <span>{s.cost === 0 ? "Gratis" : formatRupiah(s.cost)}</span>
            </label>
          ))}
          {errors.shipping_method && <p className="text-sm text-danger">{errors.shipping_method}</p>}
        </fieldset>
        <section className="rounded-lg border border-border bg-surface p-5">
          <Field label="Catatan pesanan (opsional)" error={errors.notes}>{(a) => <Input {...a} name="notes" maxLength={500} />}</Field>
        </section>
      </div>

      <aside className="grid content-start gap-3 rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-32">
        <h2 className="font-semibold">Ringkasan pesanan</h2>
        <ul className="grid gap-2 text-sm">
          {rows.map(({ line, p }) => (
            <li key={line.product_id} className="flex justify-between gap-3">
              <span>{p ? p.name : "Produk tidak tersedia"} × {line.quantity}</span>
              <span>{p ? formatRupiah(calculateSubtotal(p.selling_price, line.quantity)) : "-"}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Ongkos kirim</span><span>{ship.cost === 0 ? "Gratis" : formatRupiah(ship.cost)}</span></div>
          <div className="flex justify-between pt-1 text-base font-bold"><span>Total</span><span>{formatRupiah(subtotal + ship.cost)}</span></div>
        </div>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={submitting}>Lanjut ke pembayaran</Button>
        <Link href="/keranjang" className="text-center text-sm font-medium text-accent hover:underline">Kembali ke keranjang</Link>
      </aside>
    </form>
  );
}
