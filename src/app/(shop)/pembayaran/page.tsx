"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Button, useToast } from "@/components/ui";
import { LookupForm, OrderSkeleton, useOrder } from "@/components/shop/order-lookup";
import { fmtDateTime, recallOrder, type OrderDetail } from "@/components/shop/order-types";
import { formatRupiah } from "@/lib/calculations";
import { ApiError, api } from "@/lib/client";
import { STORE, whatsappLink } from "@/lib/shop";

function Payment() {
  const no = useSearchParams().get("no");
  const router = useRouter();
  const toast = useToast();
  const { order, needPhone, loading, error, load } = useOrder(no);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  if (loading) return <OrderSkeleton />;
  if (!order) return <LookupForm defaultNo={no} loading={loading} error={needPhone ? error : null} onSubmit={load} />;

  async function claim() {
    if (claiming || !order) return;
    const phone = recallOrder(order.order_number);
    if (!phone) return;
    setClaiming(true);
    setClaimError(null);
    try {
      await api<OrderDetail>("/api/shop/orders/pay", { method: "POST", body: { order_number: order.order_number, phone } });
      router.push("/pesanan?no=" + order.order_number);
    } catch (e) {
      setClaimError(e instanceof ApiError ? e.message : "Gagal. Coba lagi.");
      setClaiming(false);
    }
  }

  const unpaid = order.status === "MENUNGGU_PEMBAYARAN";
  const rek = STORE.bank.number.replaceAll(" ", "");

  return (
    <div className="grid max-w-2xl gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Pembayaran</h1>
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-5 sm:grid-cols-3">
        <div><p className="text-xs text-muted">Nomor pesanan</p><p className="font-mono text-sm font-semibold">{order.order_number}</p></div>
        <div><p className="text-xs text-muted">Total tagihan</p><p className="text-lg font-bold text-navy">{formatRupiah(order.total_amount)}</p></div>
        <div><p className="text-xs text-muted">Dibuat</p><p className="text-sm">{fmtDateTime(order.created_at)} WIB</p></div>
      </div>

      {!unpaid ? (
        <Alert>Pesanan ini sudah tidak menunggu pembayaran (status: {order.status.replaceAll("_", " ").toLowerCase()}).</Alert>
      ) : (
        <>
          <section className="grid gap-3 rounded-lg border border-border bg-surface p-5">
            <h2 className="font-semibold">Transfer bank</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Bank</dt><dd className="font-semibold">{STORE.bank.name}</dd>
              <dt className="text-muted">Nomor rekening</dt>
              <dd className="flex items-center gap-3">
                <span className="font-mono font-semibold">{STORE.bank.number}</span>
                <button
                  className="text-sm font-medium text-accent hover:underline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(rek);
                    toast("Nomor rekening disalin");
                  }}
                >
                  Salin
                </button>
              </dd>
              <dt className="text-muted">Atas nama</dt><dd>{STORE.bank.holder}</dd>
            </dl>
          </section>
          <section className="grid gap-2 rounded-lg border border-border bg-surface p-5">
            <h2 className="font-semibold">Petunjuk pembayaran</h2>
            <ol className="grid gap-1.5 text-sm">
              <li>1. Transfer tepat sebesar <strong>{formatRupiah(order.total_amount)}</strong>.</li>
              <li>2. Cantumkan nomor pesanan <span className="font-mono">{order.order_number}</span> pada berita transfer.</li>
              <li>3. Kirim bukti transfer lewat WhatsApp, lalu tekan &quot;Saya sudah membayar&quot;.</li>
            </ol>
            <a href={whatsappLink("Halo, saya sudah transfer untuk pesanan " + order.order_number + " sebesar " + formatRupiah(order.total_amount) + ".")} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent hover:underline">
              Kirim bukti transfer via WhatsApp
            </a>
          </section>
          {claimError && <Alert>{claimError}</Alert>}
          <Button onClick={claim} loading={claiming}>Saya sudah membayar</Button>
          <p className="text-xs text-muted">Pesanan Anda dikonfirmasi pemilik toko setelah pembayaran diperiksa.</p>
        </>
      )}
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<OrderSkeleton />}>
      <Payment />
    </Suspense>
  );
}
