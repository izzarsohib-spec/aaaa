"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/app-shell";
import { SalesTable } from "@/components/sales-table";
import { Alert, Button, Card, Skeleton } from "@/components/ui";
import { formatRupiah, toJakartaDate } from "@/lib/calculations";
import { api } from "@/lib/client";

interface Summary {
  date: string;
  total_sales_count: number;
  total_revenue: number;
  total_profit: number;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </Card>
  );
}

export default function DashboardPage() {
  const { role, name } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = toJakartaDate(new Date());

  const load = useCallback(async () => {
    setError(null);
    try {
      setSummary(await api<Summary>("/api/sales/daily-summary"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat ringkasan");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dateLabel = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "Asia/Jakarta" }).format(new Date());

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Halo, {name}</h1>
        <p className="text-sm text-muted">Ringkasan hari ini, {dateLabel} (00:00 - 23:59 WIB)</p>
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
      ) : !summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          {role === "ADMIN" && <Skeleton className="h-28" />}
        </div>
      ) : (
        <div className={"grid gap-3 " + (role === "ADMIN" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <Metric label="Omset hari ini" value={formatRupiah(summary.total_revenue)} />
          <Metric label="Jumlah transaksi" value={String(summary.total_sales_count)} note="Hanya transaksi selesai" />
          {role === "ADMIN" && <Metric label="Laba kotor" value={formatRupiah(summary.total_profit)} note="Harga jual dikurangi modal" />}
        </div>
      )}

      <section className="grid gap-3" aria-label="Transaksi hari ini">
        <h2 className="text-lg font-semibold">Transaksi hari ini</h2>
        <SalesTable from={today} to={today} onChanged={() => void load()} />
      </section>
    </div>
  );
}
