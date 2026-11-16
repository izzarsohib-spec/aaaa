"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Empty, Input, Pagination, TableSkeleton, TableWrap, Td, Th } from "@/components/ui";
import { api, type Paged } from "@/lib/client";

interface Move {
  id: string;
  direction: "IN" | "OUT";
  quantity: number;
  doc_no: string;
  ref_no: string | null;
  doc_date: string;
  notes: string | null;
  sku: string;
  name: string;
  unit: string;
}

const fmtDay = (s: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(s + "T00:00:00+07:00"));

const FILTERS = [
  ["", "Semua"],
  ["IN", "Masuk"],
  ["OUT", "Keluar"],
] as const;

/** Riwayat barang masuk (barang datang di klien) dan keluar (dikirim klien ke lokasi) untuk satu klien titipan. */
export function TitipanMoves({ code }: { code: string }) {
  const [direction, setDirection] = useState<"" | "IN" | "OUT">("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Move> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "15", page: String(page) });
      if (direction) qs.set("direction", direction);
      if (search) qs.set("search", search);
      setData(await api<Paged<Move>>("/api/titipan/" + encodeURIComponent(code) + "/moves?" + qs.toString()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat riwayat");
    }
  }, [code, direction, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="grid gap-3" aria-label="Riwayat barang masuk dan keluar">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Riwayat barang masuk dan keluar</h2>
        <p className="text-sm text-muted">
          Masuk = barang datang di klien. Keluar = barang yang sudah dikirim klien ke lokasi (surat jalan). Terbaru di atas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {FILTERS.map(([v, label]) => (
            <Button
              key={v || "semua"}
              variant={direction === v ? "primary" : "secondary"}
              onClick={() => {
                setDirection(v);
                setPage(1);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <form
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <div className="w-full sm:w-72">
            <Input
              type="search"
              placeholder="Cari barang, SKU, atau nomor kiriman"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Cari riwayat"
            />
          </div>
          <Button type="submit" variant="secondary">
            Cari
          </Button>
        </form>
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
        <TableSkeleton cols={6} />
      ) : data.items.length === 0 ? (
        <Empty
          title="Belum ada riwayat"
          hint={
            search || direction
              ? "Tidak ada catatan yang cocok. Ubah penyaring atau kata kunci."
              : "Setiap barang datang dan pengiriman dari pengadaan akan tercatat di sini otomatis."
          }
        />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Tanggal</Th>
                <Th>Jenis</Th>
                <Th>Barang</Th>
                <Th>No. kiriman</Th>
                <Th right>Jumlah</Th>
                <Th>Catatan</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id}>
                  <Td className="whitespace-nowrap">{fmtDay(m.doc_date)}</Td>
                  <Td>
                    <Badge tone={m.direction === "IN" ? "good" : "warn"}>{m.direction === "IN" ? "Masuk" : "Keluar"}</Badge>
                  </Td>
                  <Td>
                    {m.name}
                    <span className="block font-mono text-xs text-muted">{m.sku}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs">{m.doc_no}</span>
                    {m.ref_no && <span className="block text-xs text-muted">{m.ref_no}</span>}
                  </Td>
                  <Td right>
                    <span className={m.direction === "IN" ? "font-medium text-green-700" : "font-medium text-amber-700"}>
                      {m.direction === "IN" ? "+" : "-"}
                      {m.quantity} {m.unit}
                    </span>
                  </Td>
                  <Td className="text-xs text-muted">{m.notes ?? "-"}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
        </>
      )}
    </section>
  );
}
