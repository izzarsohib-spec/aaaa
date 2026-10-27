"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Skeleton } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { recallOrder, rememberOrder, type OrderDetail } from "./order-types";

/** Memuat pesanan dari ?no= bila nomor HP tersimpan di sesi; bila tidak, meminta nomor HP. */
export function useOrder(no: string | null) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [needPhone, setNeedPhone] = useState(false);
  const [loading, setLoading] = useState(Boolean(no));
  const [error, setError] = useState<string | null>(null);

  async function load(orderNo: string, phone: string) {
    setLoading(true);
    setError(null);
    try {
      const o = await api<OrderDetail>("/api/shop/orders/lookup", { method: "POST", body: { order_number: orderNo, phone } });
      rememberOrder(o.order_number, phone);
      setOrder(o);
      setNeedPhone(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal memuat pesanan");
      setNeedPhone(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!no) {
      setNeedPhone(true);
      setLoading(false);
      return;
    }
    const phone = recallOrder(no);
    if (phone) void load(no, phone);
    else {
      setNeedPhone(true);
      setLoading(false);
    }
  }, [no]);

  return { order, setOrder, needPhone, loading, error, load };
}

export function LookupForm({ defaultNo, loading, error, onSubmit }: { defaultNo?: string | null; loading: boolean; error: string | null; onSubmit: (no: string, phone: string) => void }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSubmit(String(f.get("no")).trim(), String(f.get("phone")).trim());
  }
  return (
    <form onSubmit={submit} className="grid max-w-md gap-4 rounded-lg border border-border bg-surface p-5">
      <p className="text-sm text-muted">Masukkan nomor pesanan dan nomor WhatsApp yang dipakai saat memesan.</p>
      {error && <Alert>{error}</Alert>}
      <Field label="Nomor pesanan">{(a) => <Input {...a} name="no" defaultValue={defaultNo ?? ""} placeholder="ORD-20261027-ABC123" required />}</Field>
      <Field label="Nomor WhatsApp">{(a) => <Input {...a} name="phone" type="tel" inputMode="tel" required />}</Field>
      <Button type="submit" loading={loading}>Cari pesanan</Button>
    </form>
  );
}

export function OrderSkeleton() {
  return <Skeleton className="h-72 max-w-2xl" />;
}
