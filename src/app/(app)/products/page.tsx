"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
import { formatRupiah } from "@/lib/calculations";
import { CATEGORIES } from "@/lib/shop";
import { ApiError, api, type Paged } from "@/lib/client";

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category?: string;
  description?: string | null;
  image_url?: string | null;
  cost_price?: number;
  selling_price: number;
  current_stock: number;
}

export default function ProductsPage() {
  const { role } = useSession();
  const isAdmin = role === "ADMIN";
  const toast = useToast();
  const [data, setData] = useState<Paged<Product> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "15", search: query });
      setData(await api<Paged<Product>>("/api/products?" + qs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat produk");
    }
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmDelete() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await api("/api/products/" + deleting.id, { method: "DELETE" });
      toast("Produk " + deleting.sku + " dihapus");
      setDeleting(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal menghapus", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produk</h1>
          <p className="text-sm text-muted">
            {isAdmin ? "Master barang, modal (HPP), dan harga jual." : "Daftar barang, harga jual, dan stok."}
          </p>
        </div>
        {isAdmin && <Button onClick={() => setEditing("new")}>Tambah produk</Button>}
      </div>

      <form
        className="flex max-w-md gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <Input aria-label="Cari nama atau SKU" placeholder="Cari nama atau SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="secondary">
          Cari
        </Button>
      </form>

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
        <TableSkeleton cols={isAdmin ? 7 : 5} />
      ) : data.items.length === 0 ? (
        <Empty
          title={query ? "Produk tidak ditemukan" : "Belum ada produk"}
          hint={query ? "Coba kata kunci lain." : isAdmin ? "Tambahkan produk pertama lengkap dengan modal, harga jual, dan stok awal." : "Minta pemilik toko menambahkan produk."}
          action={isAdmin && !query ? <Button onClick={() => setEditing("new")}>Tambah produk</Button> : undefined}
        />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Nama</Th>
                <Th>Satuan</Th>
                {isAdmin && <Th right>Modal (HPP)</Th>}
                <Th right>Harga jual</Th>
                <Th right>Stok</Th>
                {isAdmin && <Th />}
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <Td className="font-mono text-xs">{p.sku}</Td>
                  <Td>{p.name}</Td>
                  <Td>{p.unit}</Td>
                  {isAdmin && <Td right>{formatRupiah(p.cost_price ?? 0)}</Td>}
                  <Td right>{formatRupiah(p.selling_price)}</Td>
                  <Td right>{p.current_stock === 0 ? <Badge tone="bad">Habis</Badge> : p.current_stock}</Td>
                  {isAdmin && (
                    <Td right>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => setEditing(p)} aria-label={"Ubah " + p.name}>
                          Ubah
                        </Button>
                        <Button variant="ghost" className="text-danger" onClick={() => setDeleting(p)} aria-label={"Hapus " + p.name}>
                          Hapus
                        </Button>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
        </>
      )}

      <ProductDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Hapus produk?"
        message={
          deleting
            ? deleting.name + " (" + deleting.sku + ") akan disembunyikan dari daftar. Riwayat transaksi lama tetap tersimpan."
            : ""
        }
        confirmLabel="Hapus"
        loading={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function ProductDialog({
  target,
  onClose,
  onSaved,
}: {
  target: Product | "new" | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const isNew = target === "new";
  const p = target && target !== "new" ? target : null;
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setErrors({});
    setFormError(null);
  }, [target]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      sku: String(f.get("sku")),
      name: String(f.get("name")),
      unit: String(f.get("unit")),
      category: String(f.get("category")),
      description: String(f.get("description") ?? ""),
      image_url: String(f.get("image_url") ?? ""),
      cost_price: Number(f.get("cost_price")),
      selling_price: Number(f.get("selling_price")),
    };
    if (isNew) body.current_stock = Number(f.get("current_stock") || 0);
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      if (isNew) await api("/api/products", { method: "POST", body });
      else await api("/api/products/" + p!.id, { method: "PATCH", body });
      toast(isNew ? "Produk ditambahkan" : "Produk diperbarui");
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
    <Dialog open={Boolean(target)} title={isNew ? "Tambah produk" : "Ubah produk"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {formError && <Alert>{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU" error={errors.sku}>
            {(a) => <Input {...a} name="sku" defaultValue={p?.sku} required maxLength={50} />}
          </Field>
          <Field label="Satuan" error={errors.unit}>
            {(a) => <Input {...a} name="unit" defaultValue={p?.unit ?? "pcs"} required maxLength={20} />}
          </Field>
        </div>
        <Field label="Nama produk" error={errors.name}>
          {(a) => <Input {...a} name="name" defaultValue={p?.name} required maxLength={200} />}
        </Field>
        <Field label="Kategori toko online" error={errors.category}>
          {(a) => (
            <Select {...a} name="category" defaultValue={p?.category ?? "Seragam Satpam"}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Deskripsi (tampil di toko online)" error={errors.description}>
          {(a) => <Input {...a} name="description" defaultValue={p?.description ?? ""} maxLength={1000} />}
        </Field>
        <Field label="URL gambar (opsional)" hint="Alamat https:// ke foto produk. Kosongkan untuk ilustrasi bawaan." error={errors.image_url}>
          {(a) => <Input {...a} name="image_url" type="url" defaultValue={p?.image_url ?? ""} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Modal / HPP (Rp)" error={errors.cost_price}>
            {(a) => <Input {...a} name="cost_price" type="number" inputMode="numeric" min={0} step={1} defaultValue={p?.cost_price ?? 0} required />}
          </Field>
          <Field label="Harga jual (Rp)" error={errors.selling_price}>
            {(a) => <Input {...a} name="selling_price" type="number" inputMode="numeric" min={0} step={1} defaultValue={p?.selling_price ?? 0} required />}
          </Field>
        </div>
        {isNew ? (
          <Field label="Stok awal" error={errors.current_stock}>
            {(a) => <Input {...a} name="current_stock" type="number" inputMode="numeric" min={0} step={1} defaultValue={0} />}
          </Field>
        ) : (
          <p className="text-sm text-muted">Stok diubah lewat menu Stok agar tercatat di riwayat mutasi.</p>
        )}
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
