"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TitipanTabs } from "@/components/titipan-tabs";
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

interface Invoice {
  id: string;
  invoice_number: string;
  issued_date: string;
  due_date: string | null;
  total_amount: number;
  status: "MENDATANG" | "LUNAS" | "DIBATALKAN";
  notes: string | null;
  paid_at: string | null;
}
interface ClientRow {
  code: string;
  name: string;
  unpaid_count: number;
  unpaid_total: number;
  overdue_count: number;
  paid_count: number;
  paid_total: number;
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
  if (!inv.due_date) return <Badge>Tanpa jatuh tempo</Badge>;
  const d = dayDiff(inv.due_date, today);
  if (d < 0) return <Badge tone="bad">Lewat {-d} hari</Badge>;
  if (d <= 7) return <Badge tone="warn">{d === 0 ? "Jatuh tempo hari ini" : d + " hari lagi"}</Badge>;
  return <Badge>{d} hari lagi</Badge>;
}

function InvoiceNo({ inv }: { inv: Invoice }) {
  return (
    <>
      <span className="font-mono text-xs">{inv.invoice_number}</span>
      {inv.notes && <span className="block text-xs text-muted">{inv.notes}</span>}
    </>
  );
}

export default function TitipanTagihanPage() {
  const { code } = useParams<{ code: string }>();
  const toast = useToast();
  const today = toJakartaDate(new Date());

  const [client, setClient] = useState<ClientRow | null>(null);
  const [open, setOpen] = useState<Paged<Invoice> | null>(null);
  const [paid, setPaid] = useState<Paged<Invoice> | null>(null);
  const [openPage, setOpenPage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);

  const base = "/api/pengadaan/invoices?limit=10&client=" + encodeURIComponent(code);

  const loadClient = useCallback(async () => {
    try {
      const all = await api<ClientRow[]>("/api/titipan/clients");
      setClient(all.find((c) => c.code.toLowerCase() === code.toLowerCase()) ?? null);
    } catch {
      /* ringkasan bersifat tambahan; kesalahan utama ditampilkan oleh daftar tagihan */
    }
  }, [code]);

  const loadOpen = useCallback(async () => {
    setError(null);
    try {
      setOpen(await api<Paged<Invoice>>(base + "&status=MENDATANG&page=" + openPage));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat tagihan");
    }
  }, [base, openPage]);

  const loadPaid = useCallback(async () => {
    try {
      setPaid(await api<Paged<Invoice>>(base + "&status=LUNAS&page=" + paidPage));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat riwayat tagihan lunas");
    }
  }, [base, paidPage]);

  useEffect(() => {
    void loadOpen();
  }, [loadOpen]);
  useEffect(() => {
    void loadPaid();
  }, [loadPaid]);
  useEffect(() => {
    void loadClient();
  }, [loadClient]);

  async function markPaid() {
    if (!target || saving) return;
    setSaving(true);
    try {
      await api("/api/pengadaan/invoices/" + target.id, { method: "PATCH", body: { status: "LUNAS" } });
      toast("Tagihan ditandai lunas");
      setTarget(null);
      await Promise.all([loadOpen(), loadPaid(), loadClient()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memperbarui tagihan", "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <TitipanTabs code={code} name={client?.name ?? code} active="tagihan" />

      <div className="grid gap-3 sm:grid-cols-3">
        {client ? (
          <>
            <Metric label="Belum dibayar" value={formatRupiah(client.unpaid_total)} note={client.unpaid_count + " tagihan"} />
            <Metric
              label="Lewat jatuh tempo"
              value={String(client.overdue_count)}
              note={client.overdue_count ? "Perlu ditagih" : "Tidak ada"}
            />
            <Metric label="Sudah lunas" value={formatRupiah(client.paid_total)} note={client.paid_count + " tagihan"} />
          </>
        ) : (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)
        )}
      </div>

      {error && (
        <div className="grid gap-3">
          <Alert>{error}</Alert>
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                void loadOpen();
                void loadPaid();
              }}
            >
              Coba lagi
            </Button>
          </div>
        </div>
      )}

      <section className="grid gap-3" aria-label="Tagihan belum dibayar">
        <h2 className="text-lg font-semibold tracking-tight">Belum dibayar</h2>
        {!open ? (
          !error && <TableSkeleton cols={5} />
        ) : open.items.length === 0 ? (
          <Empty title="Tidak ada tagihan menunggu" hint="Tagihan muncul di sini setelah dibuat di bagian Tagihan sistem pengadaan." />
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
                {open.items.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <InvoiceNo inv={i} />
                    </Td>
                    <Td className="whitespace-nowrap">{fmtDay(i.issued_date)}</Td>
                    <Td className="whitespace-nowrap">{i.due_date ? fmtDay(i.due_date) : "-"}</Td>
                    <Td right>{formatRupiah(i.total_amount)}</Td>
                    <Td>{dueBadge(i, today)}</Td>
                    <Td right>
                      <Button variant="secondary" onClick={() => setTarget(i)}>
                        Tandai lunas
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination page={open.page} totalPages={open.totalPages} total={open.total} onPage={setOpenPage} />
          </>
        )}
      </section>

      <section className="grid gap-3" aria-label="Riwayat tagihan lunas">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Riwayat tagihan lunas</h2>
          <p className="text-sm text-muted">Tagihan yang sudah ditandai lunas, yang terbaru dibayar di atas.</p>
        </div>
        {!paid ? (
          !error && <TableSkeleton cols={5} />
        ) : paid.items.length === 0 ? (
          <Empty title="Belum ada tagihan lunas" hint="Tagihan yang ditandai lunas akan tercatat di sini beserta tanggal dibayarnya." />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>No. tagihan</Th>
                  <Th>Tanggal</Th>
                  <Th>Jatuh tempo</Th>
                  <Th right>Total</Th>
                  <Th>Dibayar pada</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {paid.items.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <InvoiceNo inv={i} />
                    </Td>
                    <Td className="whitespace-nowrap">{fmtDay(i.issued_date)}</Td>
                    <Td className="whitespace-nowrap">{i.due_date ? fmtDay(i.due_date) : "-"}</Td>
                    <Td right>{formatRupiah(i.total_amount)}</Td>
                    <Td className="whitespace-nowrap">{i.paid_at ? fmtDay(toJakartaDate(new Date(i.paid_at))) : "-"}</Td>
                    <Td>
                      <Badge tone="good">Lunas</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination page={paid.page} totalPages={paid.totalPages} total={paid.total} onPage={setPaidPage} />
          </>
        )}
      </section>

      <ConfirmDialog
        open={target !== null}
        title="Tandai tagihan lunas?"
        message={
          target
            ? "Tagihan " + target.invoice_number + " sebesar " + formatRupiah(target.total_amount) + " akan dipindah ke riwayat tagihan lunas."
            : ""
        }
        confirmLabel="Ya, lunas"
        loading={saving}
        onConfirm={() => void markPaid()}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
