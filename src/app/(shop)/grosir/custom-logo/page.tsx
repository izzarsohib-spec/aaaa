"use client";

import { Field, Input, Select } from "@/components/ui";
import { OrderRequestForm } from "@/components/shop/order-request-form";

const POSITIONS = ["Dada kiri", "Dada kanan", "Lengan kiri", "Lengan kanan", "Punggung", "Topi"];

export default function CustomLogoPage() {
  return (
    <OrderRequestForm
      title="Pemesanan Custom Logo"
      intro="Tambahkan logo atau nama instansi pada seragam dan atribut. Isi formulir ini, lalu kirim file logo lewat WhatsApp."
      heading="Permintaan penawaran custom logo"
      buildLines={(get, f) => [
        "Produk: " + get("product"),
        "Jumlah: " + get("qty"),
        "Jenis: " + get("method"),
        "Posisi logo: " + (f.getAll("position").join(", ") || "-"),
        "Teks / tulisan: " + (get("text") || "-"),
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
      <Field label="Teks / tulisan (opsional)" hint="Contoh: nama instansi atau nama di dada. File logo dikirim lewat WhatsApp.">{(a) => <Input {...a} name="text" />}</Field>
      <Field label="Catatan tambahan">{(a) => <Input {...a} name="notes" />}</Field>
    </OrderRequestForm>
  );
}
