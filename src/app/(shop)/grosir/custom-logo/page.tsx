"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { OrderRequestForm } from "@/components/shop/order-request-form";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const EXT = ["jpg", "jpeg", "png", "webp", "svg", "pdf", "ai", "cdr", "eps"];
const extOf = (n: string) => n.split(".").pop()?.toLowerCase() ?? "";
const kb = (n: number) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

const POSITIONS = ["Dada kiri", "Dada kanan", "Lengan kiri", "Lengan kanan", "Punggung", "Topi"];

export default function CustomLogoPage() {
  const [files, setFiles] = useState<File[]>([]);
  const canShare = typeof navigator !== "undefined" && files.length > 0 && Boolean(navigator.canShare?.({ files }));

  function validateFiles(): string | null {
    if (files.length > MAX_FILES) return "Maksimal " + MAX_FILES + " file logo.";
    const bad = files.find((f) => !EXT.includes(extOf(f.name)));
    if (bad) return "Format " + bad.name + " tidak didukung. Gunakan JPG, PNG, PDF, SVG, WEBP, AI, CDR, atau EPS.";
    const big = files.find((f) => f.size > MAX_BYTES);
    if (big) return big.name + " lebih dari 10 MB.";
    return null;
  }

  return (
    <OrderRequestForm
      title="Pemesanan Custom Logo"
      intro="Tambahkan logo atau nama instansi pada seragam dan atribut. Isi formulir ini dan unggah file logo, lalu kirim lewat WhatsApp."
      validate={validateFiles}
      afterSent={
        files.length > 0 ? (
          <div className="grid gap-2 rounded-md border border-green-700 bg-green-50 p-3 text-sm text-green-900">
            <p>File logo belum terkirim otomatis. Lampirkan {files.length} file ({files.map((f) => f.name).join(", ")}) di chat WhatsApp tadi.</p>
            {canShare && (
              <button type="button" onClick={() => navigator.share({ files }).catch(() => {})} className="justify-self-start rounded-md border border-green-700 px-3 py-1.5 font-medium hover:bg-green-100">
                Kirim file logo via WhatsApp
              </button>
            )}
          </div>
        ) : null
      }
      heading="Permintaan penawaran custom logo"
      buildLines={(get, f) => [
        "Produk: " + get("product"),
        "Jumlah: " + get("qty"),
        "Jenis: " + get("method"),
        "Posisi logo: " + (f.getAll("position").join(", ") || "-"),
        "Teks / tulisan: " + (get("text") || "-"),
        "File logo: " + (files.length ? files.map((f) => f.name).join(", ") + " (dilampirkan di chat ini)" : "belum ada"),
        "Catatan: " + get("notes"),
      ]}
    >
      <Field label="Produk yang akan diberi logo">{(a) => <Input {...a} name="product" placeholder="Contoh: Seragam satpam lengan pendek" required />}</Field>
      <Field label="Jumlah (potong)">{(a) => <Input {...a} name="qty" inputMode="numeric" required />}</Field>
      <Field label="Jenis">
        {(a) => (
          <Select {...a} name="method" defaultValue="Bordir">
            <option>Bordir</option>
            <option>Sablon</option>
            <option>Belum tahu, mohon saran</option>
          </Select>
        )}
      </Field>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Posisi logo</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {POSITIONS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="position" value={p} />
              {p}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Teks / tulisan (opsional)" hint="Contoh: nama instansi atau nama di dada. ">{(a) => <Input {...a} name="text" />}</Field>
      <Field label="File logo" hint="JPG, PNG, PDF, SVG, WEBP, AI, CDR, atau EPS. Maksimal 5 file, tiap file 10 MB.">
        {(a) => (
          <Input
            {...a}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.svg,.pdf,.ai,.cdr,.eps,image/*,application/pdf"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        )}
      </Field>
      {files.length > 0 && (
        <ul className="grid gap-1 text-sm text-muted">
          {files.map((f) => (
            <li key={f.name + f.size}>📎 {f.name} ({kb(f.size)})</li>
          ))}
        </ul>
      )}
      <Field label="Catatan tambahan">{(a) => <Input {...a} name="notes" />}</Field>
    </OrderRequestForm>
  );
}
