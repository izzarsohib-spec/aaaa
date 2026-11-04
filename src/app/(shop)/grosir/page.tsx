"use client";

import { Field, Input } from "@/components/ui";
import { OrderRequestForm } from "@/components/shop/order-request-form";

const GROUPS = [
  { key: "baju", label: "Baju", sizes: ["S", "M", "L", "XL", "XXL"] },
  { key: "celana", label: "Celana", sizes: ["S", "M", "L", "XL", "XXL"] },
  { key: "sepatu", label: "Sepatu", sizes: ["38", "39", "40", "41", "42", "43", "44", "45"] },
];

/* Jumlah per ukuran yang terisi (> 0), mis. "S 10, M 25". */
function picked(f: FormData, key: string, sizes: string[]) {
  return sizes
    .map((sz) => ({ sz, n: Number(f.get(key + ":" + sz)) || 0 }))
    .filter((x) => x.n > 0);
}

export default function WholesalePage() {
  return (
    <OrderRequestForm
      title="Pemesanan Grosir"
      intro="Untuk perusahaan, instansi, dan pemesanan dalam jumlah besar. Isi jumlah pada tiap ukuran, lalu kami lanjutkan lewat WhatsApp."
      heading="Permintaan penawaran grosir"
      validate={(f) => (GROUPS.some((g) => picked(f, g.key, g.sizes).length) ? null : "Isi jumlah minimal satu ukuran baju, celana, atau sepatu.")}
      buildLines={(get, f) => [
        ...GROUPS.map((g) => {
          const items = picked(f, g.key, g.sizes);
          const total = items.reduce((a, x) => a + x.n, 0);
          return g.label + ": " + (items.length ? items.map((x) => x.sz + " " + x.n).join(", ") + " (total " + total + ")" : "-");
        }),
        "Dibutuhkan paling lambat: " + (get("deadline") || "-"),
        "Catatan: " + get("notes"),
      ]}
    >
      {GROUPS.map((g) => (
        <fieldset key={g.key} className="grid gap-2">
          <legend className="text-sm font-medium">{g.label}</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {g.sizes.map((sz) => (
              <div key={sz} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-sm font-medium">{sz}</span>
                <Input className="min-w-0" name={g.key + ":" + sz} type="number" inputMode="numeric" min={0} step={1} placeholder="Qty" aria-label={g.label + " ukuran " + sz + ", jumlah"} />
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      <Field label="Dibutuhkan paling lambat (opsional)">{(a) => <Input {...a} name="deadline" type="date" />}</Field>
      <Field label="Catatan tambahan">{(a) => <Input {...a} name="notes" />}</Field>
    </OrderRequestForm>
  );
}
