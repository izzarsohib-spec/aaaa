"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Pagination,
  Skeleton,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
  useToast,
} from "@/components/ui";
import { formatRupiah, toJakartaDate } from "@/lib/calculations";
import { api, type Paged } from "@/lib/client";

interface Summary {
  upcoming_count: number;
  upcoming_total: number;
  nearest_due: string | null;
  overdue_count: number;
  receipts_30d_docs: number;
  receipts_30d_qty: number;
}
interface Receipt {
  id: string;
  receipt_no: string;
  po_number: string | null;
  received_date: string;
  notes: string | null;
  items: { sku: string; name: string; quantity: number }[];
  total_qty: number;
  created_at: string;
}
interface Invoice {
  id: string;
  invoice_number: string;
  issued_date: string;
  due_date: string | null;
  total_amount: number;
  status: "MENDATANG" | "LUNAS" | "DIBATALKAN";
  notes: string | null;
  items: { description: string; quantity: number; unit_price: number }[];
  paid_at: string | null;
}
interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  current_stock: number;
}

const fmtDay = (s: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(s + "T00:00:00+07:00"));
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </Card>
  );
}

function dueBadge(inv: Invoice, today: string) {
  if (inv.status === "LUNAS") return <Badge tone="good">Lunas</Badge>;
  if (inv.status === "DIBATALKAN") return <Badge>Dibatalkan</Badge>;
  if (!inv.due_date) return <Badge>Tanpa jatuh tempo</Badge>;
  const d = dayDiff(inv.due_date, today);
  if (d < 0) return <Badge tone="bad">Lewat {-d} hari</Badge>;
  if (d <= 7) return <Badge tone="warn">{d === 0 ? "Jatuh tempo hari ini" : d + " hari lagi"}</Badge>;
  return <Badge>{d} hari lagi</Badge>;
}

export default function AdministratorPage() {
  const [tab, setTab] = useState<"barang" | "tagihan">("tagihan");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lowStock, setLowStock] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTop = useCallback(async () => {
    setError(null);
    try {
      const [s, p] = await Promise.all([
        api<Summary>("/api/pengadaan/summary"),
        api<Paged<Product>>("/api/products?limit=8&sortBy=current_stock&sortOrder=asc"),
      ]);
      setSummary(s);
      setLowStock(p.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat ringkasan");
    }
  }, []);

  useEffect(() => {
    void loadTop();
  }, [loadTop]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administrator</h1>
        <p className="text-sm text-muted">Pantau stok yang masuk dari pengadaan dan tagihan yang akan datang.</p>
      </div>

      {error && (
        <div className="grid gap-3">
          <Alert>{error}</Alert>
          <div>
            <Button variant="secondary" onClick={() => void loadTop()}>
              Coba lagi
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {summary ? (
          <>
            <Metric
              label="Tagihan akan datang"
              value={formatRupiah(summary.upcoming_total)}
              note={summary.upcoming_count + " tagihan" + (summary.overdue_count ? ", " + summary.overdue_count + " lewat jatuh tempo" : "")}
            />
            <Metric
              label="Jatuh tempo terdekat"
              value={summary.nearest_due ? fmtDay(summary.nearest_due) : "-"}
              note={summary.nearest_due ? undefined : "Tidak ada tagihan menunggu"}
            />
            <Metric
              label="Barang datang 30 hari"
              value={summary.receipts_30d_qty + " pcs"}
              note={summary.receipts_30d_docs + " penerimaan"}
            />
          </>
        ) : (
          !error && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)
        )}
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Stok paling sedikit</h2>
          <Link href="/stock" className="text-sm font-medium text-accent hover:underline">
            Riwayat stok
          </Link>
        </div>
        {!lowStock ? (
          <Skeleton className="h-24" />
        ) : lowStock.length === 0 ? (
          <p className="text-sm text-muted">Belum ada produk.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {lowStock.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {p.name} <span className="font-mono text-xs text-muted">{p.sku}</span>
                </span>
                <Badge tone={p.current_stock === 0 ? "bad" : p.current_stock <= 5 ? "warn" : "neutral"}>
                  {p.current_stock} {p.unit}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div role="tablist" aria-label="Data pengadaan" className="flex gap-1 border-b border-border">
        {(
          [
            ["tagihan", "Tagihan akan datang"],
            ["barang", "Barang datang"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="-mb-px min-h-10 border-b-2 border-transparent px-4 text-sm font-medium text-muted hover:text-foreground aria-selected:border-accent aria-selected:text-foreground"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tagihan" ? <InvoicesTab onChanged={loadTop} /> : <ReceiptsTab />}
    </div>
  );
}

function ReceiptsTab() {
  const [data, setData] = useState<Paged<Receipt> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<Paged<Receipt>>("/api/pengadaan/receipts?limit=10&page=" + page));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat barang datang");
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

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
  if (!data) return <TableSkeleton cols={5} />;
  if (data.items.length === 0) {
    return <Empty title="Belum ada barang datang" hint="Barang yang dicatat datang di sistem pengadaan akan muncul di sini dan stok bertambah otomatis." />;
  }
  return (
    <>
      <TableWrap>
        <thead>
          <tr>
            <Th>Tanggal diterima</Th>
            <Th>No. penerimaan</Th>
            <Th>No. dokumen / PO</Th>
            <Th>Barang</Th>
            <Th right>Total</Th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap">{fmtDay(r.received_date)}</Td>
              <Td className="font-mono text-xs">{r.receipt_no}</Td>
              <Td>{r.po_number ?? "-"}</Td>
              <Td>
                <details>
                  <summary className="cursor-pointer">{r.items.length} jenis barang</summary>
                  <ul className="mt-1 grid gap-0.5 text-xs text-muted">
                    {r.items.map((i) => (
                      <li key={i.sku}>
                        {i.name} <span className="font-mono">{i.sku}</span> x {i.quantity}
                      </li>
                    ))}
                  </ul>
                </details>
              </Td>
              <Td right>{r.total_qty}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
    </>
  );
}

function InvoicesTab({ onChanged }: { onChanged: () => void | Promise<void> }) {
  const toast = useToast();
  const [data, setData] = useState<Paged<Invoice> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showPaid, setShowPaid] = useState(false);
  const [target, setTarget] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const today = toJakartaDate(new Date());

  const load = useCallback(async () => {
    setError(null);
    try {
      const status = showPaid ? "LUNAS" : "MENDATANG";
      setData(await api<Paged<Invoice>>("/api/pengadaan/invoices?limit=10&status=" + status + "&page=" + page));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat tagihan");
    }
  }, [page, showPaid]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markPaid() {
    if (!target || saving) return;
    setSaving(true);
    try {
      await api("/api/pengadaan/invoices/" + target.id, { method: "PATCH", body: { status: "LUNAS" } });
      toast("Tagihan ditandai lunas");
      setTarget(null);
      await Promise.all([load(), onChanged()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memperbarui tagihan", "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <Button variant={showPaid ? "secondary" : "primary"} onClick={() => { setShowPaid(false); setPage(1); }}>
          Belum dibayar
        </Button>
        <Button variant={showPaid ? "primary" : "secondary"} onClick={() => { setShowPaid(true); setPage(1); }}>
          Sudah lunas
        </Button>
      </div>

      {error ? (
        <div className="grid gap-3">
          <Alert>{error}</Alert>
          <div>
            <Button variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          </div>
        </div>
      ) : !data ? (
        <TableSkeleton cols={5} />
      ) : data.items.length === 0 ? (
        <Empty
          title={showPaid ? "Belum ada tagihan lunas" : "Tidak ada tagihan menunggu"}
          hint="Tagihan muncul di sini setelah diproses di bagian Tagihan sistem pengadaan."
        />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>No. tagihan</Th>
                <Th>Tanggal</Th>
                <Th>Jatuh tempo</Th>
                <Th right>Total</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.id}>
                  <Td>
                    <span className="font-mono text-xs">{i.invoice_number}</span>
                    {i.notes && <span className="block text-xs text-muted">{i.notes}</span>}
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDay(i.issued_date)}</Td>
                  <Td className="whitespace-nowrap">{i.due_date ? fmtDay(i.due_date) : "-"}</Td>
                  <Td right>{formatRupiah(i.total_amount)}</Td>
                  <Td>{dueBadge(i, today)}</Td>
                  <Td right>
                    {i.status === "MENDATANG" && (
                      <Button variant="secondary" onClick={() => setTarget(i)}>
                        Tandai lunas
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
        </>
      )}

      <ConfirmDialog
        open={target !== null}
        title="Tandai tagihan lunas?"
        message={target ? "Tagihan " + target.invoice_number + " sebesar " + formatRupiah(target.total_amount) + " akan dipindah ke daftar lunas." : ""}
        confirmLabel="Ya, lunas"
        loading={saving}
        onConfirm={() => void markPaid()}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
