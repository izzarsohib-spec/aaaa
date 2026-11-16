"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TitipanTabs } from "@/components/titipan-tabs";
import { Alert, Badge, Button, Card, Empty, Input, Skeleton, TableSkeleton, TableWrap, Td, Th } from "@/components/ui";
import { api } from "@/lib/client";

interface Row {
  product_id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  qty_in: number;
  qty_out: number;
  qty_left: number;
  last_date: string | null;
}
interface StockData {
  client: { code: string; name: string };
  items: Row[];
}

const fmtDay = (s: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(s + "T00:00:00+07:00"));

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </Card>
  );
}

export default function TitipanStokPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyLeft, setOnlyLeft] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<StockData>("/api/titipan/" + encodeURIComponent(code) + "/stock"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat stok titipan");
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.items.filter(
      (r) =>
        (!onlyLeft || r.qty_left !== 0) &&
        (!term || r.name.toLowerCase().includes(term) || r.sku.toLowerCase().includes(term)),
    );
  }, [data, q, onlyLeft]);

  const totals = useMemo(() => {
    const items = data?.items ?? [];
    return {
      left: items.reduce((a, r) => a + r.qty_left, 0),
      inn: items.reduce((a, r) => a + r.qty_in, 0),
      out: items.reduce((a, r) => a + r.qty_out, 0),
      kinds: items.filter((r) => r.qty_left > 0).length,
      minus: items.filter((r) => r.qty_left < 0).length,
    };
  }, [data]);

  return (
    <div className="grid gap-6">
      <TitipanTabs code={code} name={data?.client.name ?? code} active="stok" />

      {error && (
        <div className="grid gap-3">
          <Alert>{error}</Alert>
          <div>
            <Button variant="secondary" onClick={() => void load()}>
              Coba lagi
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {data ? (
          <>
            <Metric label="Sisa stok titipan" value={totals.left + " pcs"} note={totals.kinds + " jenis barang masih ada"} />
            <Metric label="Total masuk" value={totals.inn + " pcs"} note="Barang datang di klien" />
            <Metric label="Total keluar" value={totals.out + " pcs"} note="Sudah dikirim klien ke lokasi" />
            <Metric label="Jenis barang tercatat" value={String(data.items.length)} />
          </>
        ) : (
          !error && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)
        )}
      </div>

      {totals.minus > 0 && (
        <Alert>
          {totals.minus} barang tercatat keluar lebih banyak daripada yang tercatat masuk (sisa minus). Cek catatan barang datang di
          pengadaan.
        </Alert>
      )}

      {data && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-72">
            <Input
              type="search"
              placeholder="Cari nama atau SKU"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari barang titipan"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyLeft} onChange={(e) => setOnlyLeft(e.target.checked)} />
            Sembunyikan yang sisanya 0
          </label>
        </div>
      )}

      {!data ? (
        !error && <TableSkeleton cols={6} />
      ) : data.items.length === 0 ? (
        <Empty
          title="Belum ada stok titipan"
          hint="Barang yang dicatat datang di pengadaan dari Mas Wahyu akan muncul di sini otomatis."
        />
      ) : rows.length === 0 ? (
        <Empty title="Tidak ada barang yang cocok" hint="Ubah kata kunci atau matikan penyaringan." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Barang</Th>
              <Th>Kategori</Th>
              <Th right>Masuk</Th>
              <Th right>Keluar</Th>
              <Th right>Sisa</Th>
              <Th>Terakhir</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_id}>
                <Td className="font-mono text-xs">{r.sku}</Td>
                <Td>{r.name}</Td>
                <Td>{r.category}</Td>
                <Td right>{r.qty_in}</Td>
                <Td right>{r.qty_out}</Td>
                <Td right>
                  <Badge tone={r.qty_left < 0 ? "bad" : r.qty_left === 0 ? "neutral" : "good"}>
                    {r.qty_left} {r.unit}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap">{r.last_date ? fmtDay(r.last_date) : "-"}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
