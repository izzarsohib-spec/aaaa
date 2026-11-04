"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { OrderRequestForm } from "@/components/shop/order-request-form";
import { SizeCombobox } from "@/components/shop/size-combobox";

type Row = { id: number; size: string; qty: string };

const GROUPS = [
  { key: "baju", label: "Baju", sizes: ["S", "M", "L", "XL", "XXL", "L4", "L5", "L6", "L7"] },
  { key: "celana", label: "Celana", sizes: ["28", "30", "32", "34", "36", "38", "40", "42", "44", "46", "48"] },
  { key: "sepatu", label: "Sepatu", sizes: ["37", "38", "39", "40", "41", "42", "43", "44", "45"] },
];

let nextId = 1;
const blank = (): Row => ({ id: nextId++, size: "", qty: "" });

/* Baris yang ukuran dan jumlahnya terisi. */
const filled = (rows: Row[]) => rows.filter((r) => r.size && Number(r.qty) > 0);

export default function WholesalePage() {
  const [rows, setRows] = useState<Record<string, Row[]>>(() => ({ baju: [blank()], celana: [blank()], sepatu: [blank()] }));

  function update(key: string, id: number, patch: Partial<Row>) {
    setRows((s) => ({ ...s, [key]: s[key].map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }
  function remove(key: string, id: number) {
    setRows((s) => ({ ...s, [key]: s[key].length > 1 ? s[key].filter((r) => r.id !== id) : [blank()] }));
  }

  return (
    <OrderRequestForm
      title="Pemesanan Grosir"
      intro="Untuk perusahaan, instansi, dan pemesanan dalam jumlah besar. Pilih ukuran baju, celana, dan sepatu beserta jumlahnya, lalu kami lanjutkan lewat WhatsApp."
      heading="Permintaan penawaran grosir"
      validate={() => (GROUPS.some((g) => filled(rows[g.key]).length) ? null : "Pilih minimal satu ukuran dan isi jumlahnya (baju, celana, atau sepatu).")}
      buildLines={(get) => [
        ...GROUPS.map((g) => {
          const items = filled(rows[g.key]);
          const total = items.reduce((a, r) => a + Number(r.qty), 0);
          return g.label + ": " + (items.length ? items.map((r) => r.size + " " + Number(r.qty)).join(", ") + " (total " + total + ")" : "-");
        }),
        "Dibutuhkan paling lambat: " + (get("deadline") || "-"),
        "Catatan: " + get("notes"),
      ]}
    >
      {GROUPS.map((g) => {
        const list = rows[g.key];
        return (
          <fieldset key={g.key} className="grid gap-2">
            <legend className="text-sm font-medium">Ukuran {g.label.toLowerCase()}</legend>
            {list.map((r) => (
              <div key={r.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <SizeCombobox
                    label={"Ukuran " + g.label.toLowerCase()}
                    value={r.size}
                    options={g.sizes.filter((s) => s === r.size || !list.some((x) => x.size === s))}
                    onChange={(v) => update(g.key, r.id, { size: v })}
                  />
                </div>
                <div className="w-24 shrink-0">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    placeholder="Qty"
                    aria-label={"Jumlah " + g.label.toLowerCase() + " ukuran " + (r.size || "")}
                    value={r.qty}
                    onChange={(e) => update(g.key, r.id, { qty: e.target.value })}
                  />
                </div>
                <Button type="button" variant="secondary" className="shrink-0 px-3" aria-label="Hapus baris" onClick={() => remove(g.key, r.id)}>
                  ×
                </Button>
              </div>
            ))}
            {list.length < g.sizes.length && (
              <button type="button" onClick={() => setRows((s) => ({ ...s, [g.key]: [...s[g.key], blank()] }))} className="justify-self-start text-sm font-medium text-accent hover:underline">
                + Tambah ukuran {g.label.toLowerCase()}
              </button>
            )}
          </fieldset>
        );
      })}
      <Field label="Dibutuhkan paling lambat (opsional)">{(a) => <Input {...a} name="deadline" type="date" />}</Field>
      <Field label="Catatan tambahan">{(a) => <Input {...a} name="notes" />}</Field>
    </OrderRequestForm>
  );
}
