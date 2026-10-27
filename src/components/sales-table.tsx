"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/app-shell";
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Empty,
  Pagination,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
  useToast,
} from "@/components/ui";
import { formatRupiah } from "@/lib/calculations";
import { api, type Paged } from "@/lib/client";

export interface SaleRow {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: "COMPLETED" | "CANCELLED";
  payment_method: "CASH" | "TRANSFER";
  created_at: string;
  cashier_name: string;
  item_count: number;
  gross_profit?: number;
}

const fmtTime = (s: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(s));

/** Tabel riwayat transaksi untuk rentang from..to (YYYY-MM-DD, WIB). Dipakai dashboard dan halaman riwayat. */
export function SalesTable({ from, to, refreshKey, onChanged }: { from?: string; to?: string; refreshKey?: number; onChanged?: () => void }) {
  const { role } = useSession();
  const isAdmin = role === "ADMIN";
  const toast = useToast();
  const [data, setData] = useState<Paged<SaleRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<SaleRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setPage(1), [from, to]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "10" });
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      setData(await api<Paged<SaleRow>>("/api/sales?" + qs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat transaksi");
    }
  }, [page, from, to]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function confirmCancel() {
    if (!cancelling || busy) return;
    setBusy(true);
    try {
      await api("/api/sales/" + cancelling.id + "/cancel", { method: "PATCH" });
      toast("Transaksi " + cancelling.invoice_number + " dibatalkan, stok dikembalikan");
      setCancelling(null);
      await load();
      onChanged?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal membatalkan", "err");
      setCancelling(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="grid gap-3">
        <Alert>{error}</Alert>
        <div>
          <Button variant="secondary" onClick={() => void load()}>
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }
  if (!data) return <TableSkeleton cols={isAdmin ? 7 : 6} />;
  if (data.items.length === 0) {
    return (
      <Empty
        title="Belum ada transaksi"
        hint="Transaksi yang disimpan dari menu Kasir akan muncul di sini."
        action={
          <Link href="/sales/pos" className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">
            Buka kasir
          </Link>
        }
      />
    );
  }

  return (
    <>
      <TableWrap>
        <thead>
          <tr>
            <Th>Invoice</Th>
            <Th>Waktu (WIB)</Th>
            <Th>Kasir</Th>
            <Th right>Item</Th>
            <Th right>Total</Th>
            {isAdmin && <Th right>Laba</Th>}
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {data.items.map((s) => (
            <tr key={s.id} className={s.status === "CANCELLED" ? "text-muted" : undefined}>
              <Td>
                <Link href={"/sales/view?id=" + s.id} className="font-mono text-xs text-accent underline-offset-2 hover:underline">
                  {s.invoice_number}
                </Link>
              </Td>
              <Td className="whitespace-nowrap">{fmtTime(s.created_at)}</Td>
              <Td>{s.cashier_name}</Td>
              <Td right>{s.item_count}</Td>
              <Td right>{formatRupiah(s.total_amount)}</Td>
              {isAdmin && <Td right>{s.status === "COMPLETED" ? formatRupiah(s.gross_profit ?? 0) : "-"}</Td>}
              <Td>
                <Badge tone={s.status === "COMPLETED" ? "good" : "bad"}>{s.status === "COMPLETED" ? "Selesai" : "Dibatalkan"}</Badge>{" "}
                <span className="text-xs text-muted">{s.payment_method === "CASH" ? "Tunai" : "Transfer"}</span>
              </Td>
              <Td right>
                {isAdmin && s.status === "COMPLETED" && (
                  <Button variant="ghost" className="text-danger" onClick={() => setCancelling(s)} aria-label={"Batalkan " + s.invoice_number}>
                    Batalkan
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Batalkan transaksi?"
        message={cancelling ? "Transaksi " + cancelling.invoice_number + " akan dibatalkan dan stok barang dikembalikan. Tindakan ini tidak dapat diulang." : ""}
        confirmLabel="Ya, batalkan"
        loading={busy}
        onConfirm={confirmCancel}
        onClose={() => setCancelling(null)}
      />
    </>
  );
}
