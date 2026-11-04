"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, Field, Input } from "@/components/ui";
import { OrderRequestForm } from "@/components/shop/order-request-form";
import { SizeCombobox } from "@/components/shop/size-combobox";
import { api, type Paged } from "@/lib/client";

type Row = { id: number; kind: string; size: string; qty: string };
type Item = "seragam" | "sepatu" | "aksesoris";

const ITEMS: { key: Item; label: string; hint: string }[] = [
  { key: "seragam", label: "Seragam", hint: "Baju dan celana" },
  { key: "sepatu", label: "Sepatu", hint: "Jenis, ukuran, qty" },
  { key: "aksesoris", label: "Aksesoris", hint: "Jenis dan qty" },
];

const SIZES = {
  baju: ["S", "M", "L", "XL", "XXL", "L4", "L5", "L6", "L7"],
  celana: ["28", "30", "32", "34", "36", "38", "40", "42", "44", "46", "48"],
  sepatu: ["37", "38", "39", "40", "41", "42", "43", "44", "45"],
};
/* Jenis diambil dari katalog toko (nama produk per kategori); daftar ini dipakai bila katalog gagal dimuat atau kosong. */
const FALLBACK = {
  seragam: ["Seragam Satpam"],
  sepatu: ["Sepatu PDL", "Sepatu Pantofel", "Sepatu Boots", "Sepatu Safety"],
  aksesoris: ["Topi Baret", "Topi Rimba", "Ikat Pinggang", "Papan Nama", "Peluit & Tali", "Dasi", "Emblem / Badge"],
};
const CATALOG_CATEGORIES: Record<keyof typeof FALLBACK, string[]> = {
  seragam: ["Seragam Satpam"],
  sepatu: ["Sepatu"],
  aksesoris: ["Topi", "Atribut"],
};

async function namesIn(categories: string[]) {
  const pages = await Promise.all(categories.map((c) => api<Paged<{ name: string }>>("/api/shop/products?limit=100&sortBy=name&category=" + encodeURIComponent(c))));
  return [...new Set(pages.flatMap((pg) => pg.items.map((i) => i.name)))];
}

let nextId = 1;
const blank = (): Row => ({ id: nextId++, kind: "", size: "", qty: "" });
const qtyOf = (r: Row) => Number(r.qty) || 0;
const total = (rows: Row[]) => rows.reduce((a, r) => a + qtyOf(r), 0);

type Groups = { baju: Row[]; celana: Row[]; sepatu: Row[]; aksesoris: Row[] };

function Rows({
  rows,
  onChange,
  addLabel,
  children,
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  addLabel: string;
  /* Kolom pilihan di kiri qty, per baris. */
  children: (r: Row, patch: (p: Partial<Row>) => void) => ReactNode;
}) {
  const patchRow = (id: number, p: Partial<Row>) => onChange(rows.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <div key={r.id} className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2 [&>*]:min-w-[8rem] [&>*]:flex-1">{children(r, (p) => patchRow(r.id, p))}</div>
          <div className="w-24 shrink-0">
            <Input type="number" inputMode="numeric" min={1} step={1} placeholder="Qty" aria-label="Jumlah" value={r.qty} onChange={(e) => patchRow(r.id, { qty: e.target.value })} />
          </div>
          <Button type="button" variant="secondary" className="shrink-0 px-3" aria-label="Hapus baris" onClick={() => onChange(rows.length > 1 ? rows.filter((x) => x.id !== r.id) : [blank()])}>
            ×
          </Button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, blank()])} className="justify-self-start text-sm font-medium text-accent hover:underline">
        + {addLabel}
      </button>
    </div>
  );
}

export default function WholesalePage() {
  const [picked, setPicked] = useState<Item[]>([]);
  const [kinds, setKinds] = useState(FALLBACK);
  const [uniform, setUniform] = useState("");

  useEffect(() => {
    (Object.keys(CATALOG_CATEGORIES) as (keyof typeof FALLBACK)[]).forEach((k) => {
      namesIn(CATALOG_CATEGORIES[k])
        .then((names) => names.length && setKinds((s) => ({ ...s, [k]: names })))
        .catch(() => {});
    });
  }, []);
  const [g, setG] = useState<Groups>(() => ({ baju: [blank()], celana: [blank()], sepatu: [blank()], aksesoris: [blank()] }));
  const set = (k: keyof Groups) => (rows: Row[]) => setG((s) => ({ ...s, [k]: rows }));

  const done = {
    baju: g.baju.filter((r) => r.size && qtyOf(r) > 0),
    celana: g.celana.filter((r) => r.size && qtyOf(r) > 0),
    sepatu: g.sepatu.filter((r) => r.kind && r.size && qtyOf(r) > 0),
    aksesoris: g.aksesoris.filter((r) => r.kind && qtyOf(r) > 0),
  };
  const filledFor = (i: Item) => (i === "seragam" ? done.baju.length + done.celana.length : done[i].length);

  function validate() {
    if (picked.length === 0) return "Pilih jenis item dulu: seragam, sepatu, atau aksesoris.";
    if (picked.includes("seragam") && !uniform) return "Pilih jenis seragam dulu.";
    const empty = ITEMS.filter((i) => picked.includes(i.key) && filledFor(i.key) === 0).map((i) => i.label.toLowerCase());
    return empty.length ? "Lengkapi pilihan dan qty untuk: " + empty.join(", ") + "." : null;
  }

  function lines(): string[] {
    const out: string[] = [];
    const sizes = (rows: Row[]) => rows.map((r) => r.size + " " + qtyOf(r)).join(", ") + " (total " + total(rows) + ")";
    if (picked.includes("seragam")) {
      out.push("SERAGAM: " + uniform);
      out.push("Baju: " + (done.baju.length ? sizes(done.baju) : "-"));
      out.push("Celana: " + (done.celana.length ? sizes(done.celana) : "-"));
    }
    if (picked.includes("sepatu")) {
      out.push("SEPATU");
      done.sepatu.forEach((r) => out.push("- " + r.kind + " ukuran " + r.size + ": " + qtyOf(r)));
      out.push("(total " + total(done.sepatu) + " pasang)");
    }
    if (picked.includes("aksesoris")) {
      out.push("AKSESORIS");
      done.aksesoris.forEach((r) => out.push("- " + r.kind + ": " + qtyOf(r)));
    }
    return out;
  }

  const toggle = (k: Item) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  /* Opsi yang belum dipakai baris lain (opsi baris ini tetap tampil). */
  const free = (all: string[], rows: Row[], pick: (r: Row) => string, current: string) => all.filter((o) => o === current || !rows.some((x) => pick(x) === o));

  return (
    <OrderRequestForm
      title="Pemesanan Grosir"
      intro="Untuk perusahaan, instansi, dan pemesanan dalam jumlah besar. Pilih jenis item yang dipesan, isi ukuran dan jumlahnya, lalu kami lanjutkan lewat WhatsApp."
      heading="Permintaan penawaran grosir"
      validate={validate}
      buildLines={(get) => [...lines(), "Dibutuhkan paling lambat: " + (get("deadline") || "-"), "Catatan: " + get("notes")]}
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Jenis item yang dipesan</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ITEMS.map((i) => {
            const on = picked.includes(i.key);
            return (
              <button
                key={i.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(i.key)}
                className={"rounded-md border px-3 py-2.5 text-left " + (on ? "border-gold bg-gold/10" : "border-border bg-surface hover:border-zinc-400")}
              >
                <span className="block text-sm font-semibold">{(on ? "✓ " : "") + i.label}</span>
                <span className="block text-xs text-muted">{i.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {picked.includes("seragam") && (
        <section className="grid gap-4 rounded-md border border-border p-4" aria-label="Seragam">
          <h2 className="text-sm font-semibold">Seragam</h2>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Jenis seragam</p>
            <SizeCombobox label="Jenis seragam" placeholder="Cari / pilih jenis seragam" value={uniform} options={kinds.seragam} onChange={setUniform} />
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Ukuran baju</p>
            <Rows rows={g.baju} onChange={set("baju")} addLabel="Tambah ukuran baju">
              {(r, patch) => <SizeCombobox label="Ukuran baju" value={r.size} options={free(SIZES.baju, g.baju, (x) => x.size, r.size)} onChange={(v) => patch({ size: v })} />}
            </Rows>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Ukuran celana</p>
            <Rows rows={g.celana} onChange={set("celana")} addLabel="Tambah ukuran celana">
              {(r, patch) => <SizeCombobox label="Ukuran celana" value={r.size} options={free(SIZES.celana, g.celana, (x) => x.size, r.size)} onChange={(v) => patch({ size: v })} />}
            </Rows>
          </div>
        </section>
      )}

      {picked.includes("sepatu") && (
        <section className="grid gap-2 rounded-md border border-border p-4" aria-label="Sepatu">
          <h2 className="text-sm font-semibold">Sepatu</h2>
          <Rows rows={g.sepatu} onChange={set("sepatu")} addLabel="Tambah sepatu">
            {(r, patch) => (
              <>
                <SizeCombobox label="Jenis sepatu" placeholder="Pilih jenis sepatu" value={r.kind} options={kinds.sepatu} onChange={(v) => patch({ kind: v })} />
                <SizeCombobox label="Ukuran sepatu" value={r.size} options={SIZES.sepatu} onChange={(v) => patch({ size: v })} />
              </>
            )}
          </Rows>
        </section>
      )}

      {picked.includes("aksesoris") && (
        <section className="grid gap-2 rounded-md border border-border p-4" aria-label="Aksesoris">
          <h2 className="text-sm font-semibold">Aksesoris</h2>
          <Rows rows={g.aksesoris} onChange={set("aksesoris")} addLabel="Tambah aksesoris">
            {(r, patch) => <SizeCombobox label="Jenis aksesoris" placeholder="Pilih jenis aksesoris" value={r.kind} options={free(kinds.aksesoris, g.aksesoris, (x) => x.kind, r.kind)} onChange={(v) => patch({ kind: v })} />}
          </Rows>
        </section>
      )}

      <Field label="Dibutuhkan paling lambat (opsional)">{(a) => <Input {...a} name="deadline" type="date" />}</Field>
      <Field label="Catatan tambahan">{(a) => <Input {...a} name="notes" />}</Field>
    </OrderRequestForm>
  );
}
