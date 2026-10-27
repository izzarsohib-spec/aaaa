"use client";

import { useState, type FormEvent } from "react";
import { Button, Field, Input } from "@/components/ui";
import { whatsappLink } from "@/lib/shop";

export default function WholesalePage() {
  const [sent, setSent] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    const msg = [
      "Permintaan penawaran grosir / custom logo",
      "Perusahaan: " + get("company"),
      "PIC: " + get("pic"),
      "No. WhatsApp: " + get("phone"),
      "Produk: " + get("product"),
      "Jumlah & ukuran: " + get("qty"),
      "Custom logo / bordir: " + (get("logo") || "tidak"),
      "Catatan: " + get("notes"),
    ].join("\n");
    window.open(whatsappLink(msg), "_blank", "noopener");
    setSent(true);
  }

  return (
    <div className="grid max-w-2xl gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pemesanan Grosir &amp; Custom Logo</h1>
        <p className="mt-1 text-sm text-muted">Untuk perusahaan, instansi, dan pemesanan dalam jumlah besar. Isi formulir ini dan kami lanjutkan lewat WhatsApp.</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama perusahaan / instansi">{(a) => <Input {...a} name="company" required />}</Field>
          <Field label="Nama PIC">{(a) => <Input {...a} name="pic" required />}</Field>
        </div>
        <Field label="Nomor WhatsApp">{(a) => <Input {...a} name="phone" type="tel" required />}</Field>
        <Field label="Produk yang diminati">{(a) => <Input {...a} name="product" placeholder="Contoh: Seragam satpam lengan panjang" required />}</Field>
        <Field label="Jumlah dan ukuran" hint="Contoh: S 10, M 25, L 30, XL 20">{(a) => <Input {...a} name="qty" required />}</Field>
        <Field label="Custom logo / bordir" hint="Tuliskan lokasi bordir dan teks. File logo dikirim lewat WhatsApp.">{(a) => <Input {...a} name="logo" />}</Field>
        <Field label="Catatan tambahan">{(a) => <Input {...a} name="notes" />}</Field>
        <Button type="submit">Kirim permintaan via WhatsApp</Button>
        {sent && <p role="status" className="text-sm text-muted">WhatsApp terbuka di tab baru. Bila tidak terbuka, izinkan pop-up lalu kirim ulang.</p>}
      </form>
    </div>
  );
}
