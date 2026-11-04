"use client";

import { Field, Input } from "@/components/ui";
import { OrderRequestForm } from "@/components/shop/order-request-form";

export default function WholesalePage() {
  return (
    <OrderRequestForm
      title="Pemesanan Grosir"
      intro="Untuk perusahaan, instansi, dan pemesanan dalam jumlah besar. Isi formulir ini dan kami lanjutkan lewat WhatsApp."
      heading="Permintaan penawaran grosir"
      buildLines={(get) => ["Produk: " + get("product"), "Jumlah & ukuran: " + get("qty"), "Dibutuhkan paling lambat: " + (get("deadline") || "-"), "Catatan: " + get("notes")]}
    >
      <Field label="Produk yang diminati">{(a) => <Input {...a} name="product" placeholder="Contoh: Seragam satpam lengan panjang" required />}</Field>
      <Field label="Jumlah dan ukuran" hint="Contoh: S 10, M 25, L 30, XL 20">{(a) => <Input {...a} name="qty" required />}</Field>
      <Field label="Dibutuhkan paling lambat (opsional)">{(a) => <Input {...a} name="deadline" type="date" />}</Field>
      <Field label="Catatan tambahan">{(a) => <Input {...a} name="notes" />}</Field>
    </OrderRequestForm>
  );
}
