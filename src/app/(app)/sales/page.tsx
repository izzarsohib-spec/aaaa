"use client";

import { useState } from "react";
import { SalesTable } from "@/components/sales-table";
import { Field, Input } from "@/components/ui";

export default function SalesHistoryPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalid = Boolean(from && to && from > to);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Riwayat penjualan</h1>
        <p className="text-sm text-muted">Semua transaksi kasir. Tanggal memakai zona waktu WIB.</p>
      </div>
      <div className="grid max-w-md gap-4 sm:grid-cols-2">
        <Field label="Dari tanggal">{(a) => <Input {...a} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label="Sampai tanggal" error={invalid ? "Tanggal akhir harus setelah tanggal awal" : undefined}>
          {(a) => <Input {...a} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}
        </Field>
      </div>
      <SalesTable from={invalid ? undefined : from || undefined} to={invalid ? undefined : to || undefined} />
    </div>
  );
}
