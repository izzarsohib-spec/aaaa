"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Empty, Skeleton } from "@/components/ui";
import { formatRupiah } from "@/lib/calculations";
import { api } from "@/lib/client";

interface Client {
  code: string;
  name: string;
  item_count: number;
  qty_in: number;
  qty_out: number;
  qty_left: number;
  unpaid_count: number;
  unpaid_total: number;
  overdue_count: number;
}

export default function TitipanPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setClients(await api<Client[]>("/api/titipan/clients"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat daftar klien");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Titipan Seragam</h1>
        <p className="text-sm text-muted">
          Seragam milik Mas Wahyu yang dititipkan di klien. Pilih klien untuk melihat stok titipan dan tagihannya.
        </p>
      </div>

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

      {!clients ? (
        !error && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        )
      ) : clients.length === 0 ? (
        <Empty title="Belum ada klien titipan" hint="Klien muncul di sini setelah terdaftar di toko." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {clients.map((c) => (
            <Card key={c.code} className="grid gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                  <p className="font-mono text-xs text-muted">{c.code}</p>
                </div>
                {c.overdue_count > 0 && <Badge tone="bad">{c.overdue_count} lewat jatuh tempo</Badge>}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted">Sisa stok titipan</dt>
                  <dd className="text-2xl font-semibold tracking-tight">{c.qty_left} pcs</dd>
                  <dd className="text-xs text-muted">{c.item_count} jenis barang</dd>
                </div>
                <div>
                  <dt className="text-muted">Tagihan belum dibayar</dt>
                  <dd className="text-2xl font-semibold tracking-tight">{formatRupiah(c.unpaid_total)}</dd>
                  <dd className="text-xs text-muted">{c.unpaid_count} tagihan</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={"/titipan/" + encodeURIComponent(c.code) + "/stok"}
                  className="inline-flex min-h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:opacity-90"
                >
                  Lihat stok
                </Link>
                <Link
                  href={"/titipan/" + encodeURIComponent(c.code) + "/tagihan"}
                  className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-black/5"
                >
                  Lihat tagihan
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
