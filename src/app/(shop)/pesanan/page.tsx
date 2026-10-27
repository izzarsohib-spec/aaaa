"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui";
import { LookupForm, OrderSkeleton, useOrder } from "@/components/shop/order-lookup";
import { fmtDateTime, type OrderDetail } from "@/components/shop/order-types";
import { formatRupiah } from "@/lib/calculations";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/shop";

const STEPS: OrderStatus[] = ["MENUNGGU_PEMBAYARAN", "MENUNGGU_KONFIRMASI", "DIPROSES", "DIKIRIM", "SELESAI"];

function Timeline({ order }: { order: OrderDetail }) {
  const at = new Map(order.events.map((e) => [e.status, e.created_at]));
  const cancelled = order.status === "DIBATALKAN";
  return (
    <ol className="grid gap-3">
      {STEPS.map((s) => {
        const done = at.has(s);
        return (
          <li key={s} className="flex items-start gap-3">
            <span aria-hidden className={"mt-1 grid h-5 w-5 place-items-center rounded-full text-xs " + (done ? "bg-accent text-white" : "bg-zinc-200")}>
              {done ? "✓" : ""}
            </span>
            <div>
              <p className={done ? "font-medium" : "text-muted"}>{ORDER_STATUS_LABEL[s]}</p>
              {done && <p className="text-xs text-muted">{fmtDateTime(at.get(s)!)} WIB</p>}
            </div>
          </li>
        );
      })}
      {cancelled && (
        <li className="flex items-start gap-3">
          <span aria-hidden className="mt-1 grid h-5 w-5 place-items-center rounded-full bg-danger text-xs text-white">×</span>
          <div>
            <p className="font-medium text-danger">Dibatalkan</p>
            <p className="text-xs text-muted">{fmtDateTime(at.get("DIBATALKAN")!)} WIB</p>
          </div>
        </li>
      )}
    </ol>
  );
}

function Tracking() {
  const no = useSearchParams().get("no");
  const { order, needPhone, loading, error, load } = useOrder(no);

  if (loading) return <OrderSkeleton />;
  if (!order) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Lacak Pesanan</h1>
        <LookupForm defaultNo={no} loading={loading} error={needPhone ? error : null} onSubmit={load} />
      </div>
    );
  }
  const tone = order.status === "DIBATALKAN" ? "bad" : order.status === "SELESAI" ? "good" : "warn";
  return (
    <div className="grid max-w-2xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Detail Pesanan</h1>
        <Badge tone={tone}>{ORDER_STATUS_LABEL[order.status]}</Badge>
      </div>
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-5 sm:grid-cols-3">
        <div><p className="text-xs text-muted">Nomor pesanan</p><p className="font-mono text-sm font-semibold">{order.order_number}</p></div>
        <div><p className="text-xs text-muted">Tanggal</p><p className="text-sm">{fmtDateTime(order.created_at)} WIB</p></div>
        <div><p className="text-xs text-muted">Total</p><p className="font-bold text-navy">{formatRupiah(order.total_amount)}</p></div>
      </div>
      {order.status === "MENUNGGU_PEMBAYARAN" && (
        <Link href={"/pembayaran?no=" + order.order_number} className="inline-flex min-h-11 items-center justify-center rounded-md bg-gold px-4 text-sm font-bold text-navy hover:bg-gold-hover">
          Lanjut ke pembayaran
        </Link>
      )}
      <section className="rounded-lg border border-border bg-surface p-5"><h2 className="mb-3 font-semibold">Status</h2><Timeline order={order} /></section>
      <section className="grid gap-2 rounded-lg border border-border bg-surface p-5 text-sm">
        <h2 className="font-semibold">Informasi pengiriman</h2>
        <p>{order.customer_name}</p>
        <p className="text-muted">{order.address}, {order.city} {order.postal_code ?? ""}</p>
        <p>{order.shipping_method}</p>
        {order.tracking_number && <p>Nomor resi: <span className="font-mono font-semibold">{order.tracking_number}</span></p>}
      </section>
      <section className="rounded-lg border border-border bg-surface p-5 text-sm">
        <h2 className="mb-2 font-semibold">Barang</h2>
        <ul className="grid gap-1.5">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3"><span>{i.name} × {i.quantity}</span><span>{formatRupiah(i.subtotal)}</span></li>
          ))}
        </ul>
        <div className="mt-3 grid gap-1 border-t border-border pt-3">
          <div className="flex justify-between"><span className="text-muted">Ongkos kirim</span><span>{formatRupiah(order.shipping_cost)}</span></div>
          <div className="flex justify-between font-bold"><span>Total</span><span>{formatRupiah(order.total_amount)}</span></div>
        </div>
      </section>
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={<OrderSkeleton />}>
      <Tracking />
    </Suspense>
  );
}
