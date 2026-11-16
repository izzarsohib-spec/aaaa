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

function statusBadge(inv: Invoice, today: string) {
  if (inv.status === "LUNAS") return <Badge tone="good">Lunas</Badge>;
  if (inv.status === "DIBATALKAN") return <Badge>Dibatalkan</Badge>;
  if (!inv.due_date) return <Badge>Tanpa jatuh tempo</Badge>;
  const d = dayDiff(inv.due_date, today);
  if (d < 0) return <Badge tone="bad">Lewat {-d} hari</Badge>;
  if (d <= 7) return <Badge tone="warn">{d === 0 ? "Jatuh tempo hari ini" : d + " hari lagi"}</Badge>;
  return <Badge>{d} hari lagi</Badge>;
}

export default function TitipanTagihanPage() {
  const { code } = useParams<{ code: string }>();
  const toast = useToast();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [data, setData] = useState<Paged<Invoice> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showPaid, setShowPaid] = useState(false);
  const [target, setTarget] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const today = toJakartaDate(new Date());

  const loadClient = useCallback(async () => {
    try {
      const all = await api<ClientRow[]>("/api/titipan/clients");
      setClient(all.find((c) => c.code.toLowerCase() === code.toLowerCase()) ?? null);
    } catch {
      /* ringkasan bersifat tambahan; kesalahan utama ditampilkan oleh daftar tagihan */
    }
  }, [code]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const status = showPaid ? "LUNAS" : "MENDATANG";
      setData(
        await api<Paged<Invoice>>(
          "/api/pengadaan/invoices?limit=10&client=" + encodeURIComponent(code) + "&status=" + status + "&page=" + page,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat tagihan");
    }
  }, [code, page, showPaid]);

  useEffect(() => {
    void load();
  }, [load]);
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
      await Promise.all([load(), loadClient()]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal memperbarui tagihan", "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <TitipanTabs code={code} name={client?.name ?? code} active="tagihan" />

      <div className="grid gap-3 sm:grid-cols-2">
        {client ? (
          <>
            <Metric label="Belum dibayar" value={formatRupiah(client.unpaid_total)} note={client.unpaid_count + " tagihan"} />
            <Metric
              label="Lewat jatuh tempo"
              value={String(client.overdue_count)}
              note={client.overdue_count ? "Perlu ditagih" : "Tidak ada"}
            />
          </>
        ) : (
          [0, 1].map((i) => <Skeleton key={i} className="h-24" />)
        )}
      </div>

      <div className="grid gap-3">
        <div className="flex gap-2">
          <Button
            variant={showPaid ? "secondary" : "primary"}
            onClick={() => {
              setShowPaid(false);
              setPage(1);
            }}
          >
            Belum dibayar
          </Button>
          <Button
            variant={showPaid ? "primary" : "secondary"}
            onClick={() => {
              setShowPaid(true);
              setPage(1);
            }}
          >
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
            hint="Tagihan muncul di sini setelah dibuat di bagian Tagihan sistem pengadaan."
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
                    <Td>{statusBadge(i, today)}</Td>
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
      </div>

      <ConfirmDialog
        open={target !== null}
        title="Tandai tagihan lunas?"
        message={
          target
            ? "Tagihan " + target.invoice_number + " sebesar " + formatRupiah(target.total_amount) + " akan dipindah ke daftar lunas."
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
