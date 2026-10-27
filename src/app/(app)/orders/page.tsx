"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/app-shell";
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  Empty,
  Field,
  Input,
  Pagination,
  Select,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
  useToast,
} from "@/components/ui";
import { fmtDateTime, type OrderDetail } from "@/components/shop/order-types";
import { formatRupiah } from "@/lib/calculations";
import { api, type Paged } from "@/lib/client";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/shop";

interface Row {
  id: string;
  order_number: string;
  status: OrderStatus;
  customer_name: string;
  phone: string;
  city: string;
  total_amount: number;
  shipping_method: string;
  created_at: string;
}
type Detail = OrderDetail & { phone: string };

const TONE: Record<OrderStatus, "good" | "bad" | "warn" | "neutral"> = {
  MENUNGGU_PEMBAYARAN: "warn",
  MENUNGGU_KONFIRMASI: "warn",
  DIPROSES: "neutral",
  DIKIRIM: "neutral",
  SELESAI: "good",
  DIBATALKAN: "bad",
};

export default function OrdersPage() {
  const { role } = useSession();
  const toast = useToast();
  const [data, setData] = useState<Paged<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [resi, setResi] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "10" });
      if (status) qs.set("status", status);
      setData(await api<Paged<Row>>("/api/orders?" + qs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat pesanan");
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    try {
      setResi("");
      setOpen(await api<Detail>("/api/orders/" + id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memuat detail", "err");
    }
  }

  async function act(action: "confirm_payment" | "ship" | "complete" | "cancel") {
    if (!open || busy) return;
    setBusy(true);
    try {
      const updated = await api<Detail>("/api/orders/" + open.id, {
        method: "PATCH",
        body: { action, tracking_number: action === "ship" && resi.trim() ? resi.trim() : undefined },
      });
      setOpen(updated);
      setConfirmCancel(false);
      toast("Pesanan diperbarui: " + ORDER_STATUS_LABEL[updated.status]);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memperbarui", "err");
      setConfirmCancel(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pesanan Online</h1>
        <p className="text-sm text-muted">Pesanan dari toko online. Pembayaran dikonfirmasi di sini; setelah itu tercatat sebagai penjualan.</p>
      </div>
      <div className="max-w-xs">
        <Field label="Filter status">
          {(a) => (
            <Select {...a} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
              <option value="">Semua status</option>
              {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {error ? (
        <div className="grid gap-3"><Alert>{error}</Alert><div><Button variant="secondary" onClick={() => void load()}>Coba lagi</Button></div></div>
      ) : !data ? (
        <TableSkeleton cols={6} />
      ) : data.items.length === 0 ? (
        <Empty title="Belum ada pesanan online" hint="Pesanan dari etalase toko akan muncul di sini." />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr><Th>Pesanan</Th><Th>Waktu (WIB)</Th><Th>Pembeli</Th><Th right>Total</Th><Th>Status</Th><Th /></tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id}>
                  <Td className="font-mono text-xs">{o.order_number}</Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(o.created_at)}</Td>
                  <Td>{o.customer_name} <span className="text-xs text-muted">· {o.city}</span></Td>
                  <Td right>{formatRupiah(o.total_amount)}</Td>
                  <Td><Badge tone={TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></Td>
                  <Td right><Button variant="ghost" onClick={() => void openDetail(o.id)} aria-label={"Detail " + o.order_number}>Detail</Button></Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
        </>
      )}

      <Dialog open={Boolean(open)} title={open ? "Pesanan " + open.order_number : "Pesanan"} onClose={() => setOpen(null)}>
        {open && (
          <div className="grid gap-4 text-sm">
            <div className="flex items-center justify-between">
              <Badge tone={TONE[open.status]}>{ORDER_STATUS_LABEL[open.status]}</Badge>
              <span className="text-muted">{fmtDateTime(open.created_at)} WIB</span>
            </div>
            <div>
              <p className="font-medium">{open.customer_name} · {open.phone}</p>
              <p className="text-muted">{open.address}, {open.city} {open.postal_code ?? ""}</p>
              <p>{open.shipping_method}{open.tracking_number ? " · resi " + open.tracking_number : ""}</p>
              {open.notes && <p className="text-muted">Catatan: {open.notes}</p>}
            </div>
            <ul className="grid gap-1 border-y border-border py-3">
              {open.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3"><span>{i.name} × {i.quantity}</span><span>{formatRupiah(i.subtotal)}</span></li>
              ))}
              <li className="flex justify-between text-muted"><span>Ongkos kirim</span><span>{formatRupiah(open.shipping_cost)}</span></li>
              <li className="flex justify-between font-bold"><span>Total</span><span>{formatRupiah(open.total_amount)}</span></li>
            </ul>
            {open.status === "DIPROSES" && (
              <Field label="Nomor resi (opsional)">{(a) => <Input {...a} value={resi} onChange={(e) => setResi(e.target.value)} maxLength={60} />}</Field>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {(open.status === "MENUNGGU_PEMBAYARAN" || open.status === "MENUNGGU_KONFIRMASI") && (
                <Button loading={busy} onClick={() => void act("confirm_payment")}>Konfirmasi pembayaran</Button>
              )}
              {open.status === "DIPROSES" && <Button loading={busy} onClick={() => void act("ship")}>Tandai dikirim</Button>}
              {open.status === "DIKIRIM" && <Button loading={busy} onClick={() => void act("complete")}>Tandai selesai</Button>}
              {role === "ADMIN" && open.status !== "SELESAI" && open.status !== "DIBATALKAN" && (
                <Button variant="danger" onClick={() => setConfirmCancel(true)}>Batalkan</Button>
              )}
            </div>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmCancel}
        title="Batalkan pesanan?"
        message="Stok barang dikembalikan dan, bila pembayaran sudah dikonfirmasi, penjualan terkait ikut dibatalkan."
        confirmLabel="Ya, batalkan"
        loading={busy}
        onConfirm={() => void act("cancel")}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
}
