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
  Select,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
  useToast,
} from "@/components/ui";
import { ApiError, api, type Paged } from "@/lib/client";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
}

export default function UsersPage() {
  const toast = useToast();
  const [data, setData] = useState<Paged<UserRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<Paged<UserRow>>("/api/users?limit=100"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat akun");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      await api("/api/users", {
        method: "POST",
        body: { name: String(f.get("name")), email: String(f.get("email")), password: String(f.get("password")), role: String(f.get("role")) },
      });
      toast("Akun dibuat");
      setOpen(false);
      await load();
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
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Akun staf</h1>
          <p className="text-sm text-muted">Reset password dilakukan pemilik lewat database.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Tambah akun</Button>
      </div>

      {error ? (
        <Alert>{error}</Alert>
      ) : !data ? (
        <TableSkeleton cols={3} />
      ) : data.items.length === 0 ? (
        <Empty title="Belum ada akun" hint="Buat akun kasir untuk pegawai toko." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Nama</Th>
              <Th>Email</Th>
              <Th>Peran</Th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id}>
                <Td>{u.name}</Td>
                <Td>{u.email}</Td>
                <Td>
                  <Badge tone={u.role === "ADMIN" ? "good" : "neutral"}>{u.role === "ADMIN" ? "Pemilik" : "Kasir"}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Dialog open={open} title="Tambah akun" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {formError && <Alert>{formError}</Alert>}
          <Field label="Nama lengkap" error={errors.name}>
            {(a) => <Input {...a} name="name" required />}
          </Field>
          <Field label="Email" error={errors.email}>
            {(a) => <Input {...a} name="email" type="email" autoComplete="off" required />}
          </Field>
          <Field label="Password" hint="Minimal 8 karakter" error={errors.password}>
            {(a) => <Input {...a} name="password" type="password" autoComplete="new-password" required />}
          </Field>
          <Field label="Peran" error={errors.role}>
            {(a) => (
              <Select {...a} name="role" defaultValue="STAFF">
                <option value="STAFF">Kasir (STAFF)</option>
                <option value="ADMIN">Pemilik (ADMIN)</option>
              </Select>
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={saving}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
