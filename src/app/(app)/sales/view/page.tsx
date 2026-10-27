"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Skeleton, TableWrap, Td, Th } from "@/components/ui";
import { formatRupiah } from "@/lib/calculations";
import { api } from "@/lib/client";

interface Detail {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: "COMPLETED" | "CANCELLED";
  payment_method: "CASH" | "TRANSFER";
  notes: string | null;
  created_at: string;
  cashier_name: string;
  items: { id: string; sku: string; name: string; unit: string; quantity: number; selling_price_at_sale: number; subtotal: number }[];
}

function Invoice() {
  const params = useSearchParams();
  const id = params.get("id");
  const isNew = params.get("baru") === "1";
  const [sale, setSale] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Nomor transaksi tidak ditemukan");
      return;
    }
    api<Detail>("/api/sales/" + id)
      .then(setSale)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat nota"));
  }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!sale) return <Skeleton className="h-96 max-w-xl" />;

  return (
    <div className="grid max-w-xl gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/sales" className="text-sm text-accent hover:underline">
          Kembali ke riwayat
        </Link>
        <div className="flex gap-2">
          {isNew && (
            <Link href="/sales/pos" className="inline-flex min-h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
              Transaksi baru
            </Link>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            Cetak nota
          </Button>
        </div>
      </div>
      <Card className="grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Adzkia Collection</p>
            <p className="text-xs text-muted">Seragam satpam</p>
          </div>
          <Badge tone={sale.status === "COMPLETED" ? "good" : "bad"}>{sale.status === "COMPLETED" ? "Selesai" : "Dibatalkan"}</Badge>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Invoice</dt>
          <dd className="font-mono">{sale.invoice_number}</dd>
          <dt className="text-muted">Waktu</dt>
          <dd>{new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(sale.created_at))} WIB</dd>
          <dt className="text-muted">Kasir</dt>
          <dd>{sale.cashier_name}</dd>
          <dt className="text-muted">Bayar</dt>
          <dd>{sale.payment_method === "CASH" ? "Tunai" : "Transfer"}</dd>
        </dl>
        <TableWrap>
          <thead>
            <tr>
              <Th>Barang</Th>
              <Th right>Qty</Th>
              <Th right>Harga</Th>
              <Th right>Subtotal</Th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((i) => (
              <tr key={i.id}>
                <Td>{i.name}</Td>
                <Td right>
                  {i.quantity} {i.unit}
                </Td>
                <Td right>{formatRupiah(i.selling_price_at_sale)}</Td>
                <Td right>{formatRupiah(i.subtotal)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-sm text-muted">Total</span>
          <span className="text-xl font-semibold">{formatRupiah(sale.total_amount)}</span>
        </div>
        {sale.notes && <p className="text-sm text-muted">Catatan: {sale.notes}</p>}
        <p className="text-center text-xs text-muted">Terima kasih telah berbelanja.</p>
      </Card>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-xl" />}>
      <Invoice />
    </Suspense>
  );
}
