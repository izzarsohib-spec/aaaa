"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
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
import { ApiError, api, type Paged } from "@/lib/client";

interface Adjustment {
  id: string;
  product_name: string;
  sku: string;
  user_name: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  notes: string;
  created_at: string;
}
interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  current_stock: number;
}

const TYPE_LABEL = { IN: "Masuk", OUT: "Keluar", ADJUSTMENT: "Koreksi opname" } as const;
const TYPE_TONE = { IN: "good", OUT: "bad", ADJUSTMENT: "warn" } as const;
const fmtDate = (s: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(s));

export default function StockPage() {
  const [data, setData] = useState<Paged<Adjustment> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<Paged<Adjustment>>("/api/stock-adjustments?limit=15&page=" + page));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat riwayat");
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stok</h1>
          <p className="text-sm text-muted">Riwayat mutasi stok: kulakan, barang rusak, dan koreksi opname.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Catat penyesuaian</Button>
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
          title="Belum ada mutasi stok"
          hint="Catat stok masuk saat kulakan atau koreksi selisih hasil opname."
          action={<Button onClick={() => setOpen(true)}>Catat penyesuaian</Button>}
        />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Waktu (WIB)</Th>
                <Th>Produk</Th>
                <Th>Tipe</Th>
                <Th right>Jumlah</Th>
                <Th>Catatan</Th>
                <Th>Oleh</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <Td className="whitespace-nowrap">{fmtDate(a.created_at)}</Td>
                  <Td>
                    {a.product_name} <span className="font-mono text-xs text-muted">{a.sku}</span>
                  </Td>
                  <Td>
                    <Badge tone={TYPE_TONE[a.type]}>{TYPE_LABEL[a.type]}</Badge>
                  </Td>
                  <Td right>{a.quantity}</Td>
                  <Td className="max-w-[28ch]">{a.notes}</Td>
                  <Td>{a.user_name}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
        </>
      )}

      <AdjustDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={async () => {
          setOpen(false);
          setPage(1);
          await load();
        }}
      />
    </div>
  );
}

function AdjustDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [type, setType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError(null);
    setType("IN");
    api<Paged<Product>>("/api/products?limit=100&sortBy=name")
      .then((d) => setProducts(d.items))
      .catch(() => setFormError("Gagal memuat daftar produk"));
  }, [open]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      await api("/api/stock-adjustments", {
        method: "POST",
        body: {
          product_id: String(f.get("product_id")),
          type,
          quantity: Number(f.get("quantity")),
          notes: String(f.get("notes")),
        },
      });
      toast("Penyesuaian stok tercatat");
      await onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors ?? {});
        if (!err.errors) setFormError(err.message);
      } else setFormError("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} title="Catat penyesuaian stok" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field label="Produk" error={errors.product_id}>
          {(a) => (
            <Select {...a} name="product_id" required defaultValue="">
              <option value="" disabled>
                Pilih produk
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name} (stok {p.current_stock} {p.unit})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Tipe" error={errors.type}>
          {(a) => (
            <Select {...a} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="IN">Masuk (kulakan / restock)</option>
              <option value="OUT">Keluar (rusak / hilang)</option>
              <option value="ADJUSTMENT">Koreksi opname</option>
            </Select>
          )}
        </Field>
        <Field
          label={type === "ADJUSTMENT" ? "Stok fisik hasil hitung" : "Jumlah"}
          hint={type === "ADJUSTMENT" ? "Stok sistem akan disamakan dengan angka ini." : undefined}
          error={errors.quantity}
        >
          {(a) => <Input {...a} name="quantity" type="number" inputMode="numeric" min={1} step={1} required />}
        </Field>
        <Field label="Catatan alasan" error={errors.notes}>
          {(a) => <Input {...a} name="notes" required maxLength={500} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={saving}>
            Simpan
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
