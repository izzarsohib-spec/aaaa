"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button, Input } from "@/components/ui";
import { ProductArt } from "@/components/shop/product-art";
import { api, type Paged } from "@/lib/client";
import { whatsappLink } from "@/lib/shop";

type Cat = "seragam" | "sepatu" | "aksesoris";
type Product = { name: string; category: string; image_url: string | null };
/* Jumlah per ukuran, kunci "grup:ukuran" (mis. "baju:M"); aksesoris memakai kunci "qty". */
type Line = { cat: Cat; name: string; category: string; image: string | null; qty: Record<string, number> };

const SIZE_GROUPS: Record<Cat, { key: string; label: string; sizes: string[] }[]> = {
  seragam: [
    { key: "baju", label: "Ukuran baju", sizes: ["S", "M", "L", "XL", "XXL", "L4", "L5", "L6", "L7"] },
    { key: "celana", label: "Ukuran celana", sizes: ["28", "30", "32", "34", "36", "38", "40", "42", "44", "46", "48"] },
  ],
  sepatu: [{ key: "sepatu", label: "Ukuran sepatu", sizes: ["37", "38", "39", "40", "41", "42", "43", "44", "45"] }],
  aksesoris: [],
};

const CATS: { key: Cat; label: string; hint: string; unit: string; categories: string[]; fallback: string[] }[] = [
  { key: "seragam", label: "Seragam", hint: "Baju dan celana", unit: "potong", categories: ["Seragam Satpam"], fallback: ["Seragam Satpam"] },
  { key: "sepatu", label: "Sepatu", hint: "Pilih ukuran", unit: "pasang", categories: ["Sepatu"], fallback: ["Sepatu PDL", "Sepatu Pantofel", "Sepatu Boots", "Sepatu Safety"] },
  { key: "aksesoris", label: "Aksesoris", hint: "Topi, ikat pinggang, dll.", unit: "pcs", categories: ["Topi", "Atribut"], fallback: ["Topi Baret", "Ikat Pinggang", "Papan Nama", "Peluit & Tali"] },
];

const lineTotal = (l: Line) => Object.values(l.qty).reduce((a, n) => a + n, 0);
const sizesText = (l: Line, group: string, sizes: string[]) =>
  sizes.filter((s) => (l.qty[group + ":" + s] ?? 0) > 0).map((s) => s + " " + l.qty[group + ":" + s]);

async function loadCatalog(): Promise<Record<Cat, Product[]>> {
  const out = {} as Record<Cat, Product[]>;
  await Promise.all(
    CATS.map(async (c) => {
      try {
        const pages = await Promise.all(c.categories.map((cat) => api<Paged<Product>>("/api/shop/products?limit=100&sortBy=name&category=" + encodeURIComponent(cat))));
        const seen = new Set<string>();
        out[c.key] = pages.flatMap((p) => p.items).filter((i) => !seen.has(i.name) && seen.add(i.name));
      } catch {
        out[c.key] = [];
      }
      if (out[c.key].length === 0) out[c.key] = c.fallback.map((name) => ({ name, category: c.categories[0], image_url: null }));
    }),
  );
  return out;
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface p-5" aria-labelledby={"step-" + n}>
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white" aria-hidden>
          {n}
        </span>
        <div>
          <h2 id={"step-" + n} className="text-base font-semibold leading-7">
            {title}
          </h2>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function TextField({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <Input {...rest} />
    </label>
  );
}

function QtyTile({ label, value, onChange, aria }: { label: string; value: number; onChange: (n: number) => void; aria: string }) {
  return (
    <label className={"grid gap-1 rounded-md border p-1.5 text-center " + (value > 0 ? "border-gold bg-gold/10" : "border-border bg-surface")}>
      <span className="text-xs font-semibold">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        placeholder="0"
        aria-label={aria}
        value={value || ""}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="w-full rounded border border-border bg-white px-1 py-1.5 text-center text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </label>
  );
}

export function BulkOrderForm() {
  const [who, setWho] = useState<"company" | "person">("company");
  const [catalog, setCatalog] = useState<Record<Cat, Product[]> | null>(null);
  const [tab, setTab] = useState<Cat>("seragam");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    loadCatalog().then(setCatalog);
  }, []);

  const has = (cat: Cat, name: string) => lines.some((l) => l.cat === cat && l.name === name);
  const add = (cat: Cat, p: Product) => setLines((ls) => (has(cat, p.name) ? ls : [...ls, { cat, name: p.name, category: p.category, image: p.image_url, qty: {} }]));
  const remove = (cat: Cat, name: string) => setLines((ls) => ls.filter((l) => !(l.cat === cat && l.name === name)));
  const setQty = (cat: Cat, name: string, key: string, n: number) =>
    setLines((ls) => ls.map((l) => (l.cat === cat && l.name === name ? { ...l, qty: { ...l.qty, [key]: n } } : l)));

  const shown = (catalog?.[tab] ?? []).filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
  const totals = CATS.map((c) => ({ ...c, n: lines.filter((l) => l.cat === c.key).reduce((a, l) => a + lineTotal(l), 0), kinds: lines.filter((l) => l.cat === c.key).length }));

  function message(f: FormData) {
    const get = (k: string) => String(f.get(k) ?? "").trim();
    const out = ["Permintaan penawaran grosir", ""];
    if (who === "company") out.push("Pemesan: Perusahaan / instansi", "Perusahaan: " + get("company"), "PIC: " + get("pic"));
    else out.push("Pemesan: Perorangan", "Nama: " + get("pic"));
    out.push("No. WhatsApp: " + get("phone"));
    for (const c of CATS) {
      const ls = lines.filter((l) => l.cat === c.key);
      if (!ls.length) continue;
      out.push("", "== " + c.label.toUpperCase() + " ==");
      ls.forEach((l, i) => {
        out.push(i + 1 + ". " + l.name);
        if (c.key === "aksesoris") out.push("   Jumlah: " + (l.qty.qty ?? 0));
        else
          for (const g of SIZE_GROUPS[c.key]) {
            const t = sizesText(l, g.key, g.sizes);
            if (t.length) out.push("   " + g.label.replace("Ukuran ", "").replace(/^./, (x) => x.toUpperCase()) + ": " + t.join(", "));
          }
        out.push("   Subtotal: " + lineTotal(l) + " " + c.unit);
      });
    }
    out.push("", "Dibutuhkan paling lambat: " + (get("deadline") || "-"), "Catatan: " + (get("notes") || "-"));
    return out.join("\n");
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lines.length === 0) return setError("Pilih minimal satu barang dulu di langkah 2.");
    const empty = lines.filter((l) => lineTotal(l) === 0).map((l) => l.name);
    if (empty.length) return setError("Isi jumlah untuk: " + empty.join(", ") + " (atau hapus barangnya).");
    setError(null);
    window.open(whatsappLink(message(new FormData(e.currentTarget))), "_blank", "noopener");
    setSent(true);
  }

  return (
    <form onSubmit={submit} className="grid max-w-6xl gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pemesanan Grosir</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Untuk perusahaan, instansi, atau perorangan yang memesan banyak sekaligus. Pilih barang, isi ukuran dan jumlahnya, lalu kirim ke kami lewat WhatsApp. Harga dan ketersediaan kami konfirmasi setelah itu.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_21rem]">
        <div className="grid gap-5">
          <Step n={1} title="Siapa yang memesan?">
            <div role="radiogroup" aria-label="Jenis pemesan" className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["company", "Perusahaan / instansi", "Seragam untuk karyawan atau anggota"],
                  ["person", "Perorangan", "Pesan sendiri atau untuk kelompok kecil"],
                ] as const
              ).map(([v, label, hint]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={who === v}
                  onClick={() => setWho(v)}
                  className={"rounded-md border px-3 py-2.5 text-left " + (who === v ? "border-gold bg-gold/10" : "border-border bg-surface hover:border-zinc-400")}
                >
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {who === "company" && <TextField label="Nama perusahaan / instansi" name="company" required />}
              <TextField label={who === "company" ? "Nama PIC (penanggung jawab)" : "Nama lengkap"} name="pic" required />
              <TextField label="Nomor WhatsApp" name="phone" type="tel" inputMode="tel" required placeholder="08xxxxxxxxxx" />
            </div>
          </Step>

          <Step n={2} title="Pilih barang yang dipesan" hint="Anda bisa menambah lebih dari satu jenis seragam, sepatu, dan aksesoris.">
            <div role="tablist" aria-label="Kategori barang" className="flex gap-1 border-b border-border">
              {CATS.map((c) => {
                const count = lines.filter((l) => l.cat === c.key).length;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === c.key}
                    onClick={() => {
                      setTab(c.key);
                      setSearch("");
                    }}
                    className="-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground aria-selected:border-gold aria-selected:text-foreground"
                  >
                    {c.label}
                    {count > 0 && <span className="ml-1.5 rounded-full bg-navy px-1.5 py-0.5 text-xs text-white">{count}</span>}
                  </button>
                );
              })}
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={"Cari " + CATS.find((c) => c.key === tab)!.label.toLowerCase() + "…"}
              aria-label="Cari barang"
              className="min-h-10 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {!catalog ? (
              <p className="text-sm text-muted">Memuat daftar barang…</p>
            ) : shown.length === 0 ? (
              <p className="text-sm text-muted">Tidak ada barang yang cocok.</p>
            ) : (
              <ul className="grid max-h-80 gap-2 overflow-auto sm:grid-cols-2">
                {shown.map((p) => {
                  const added = has(tab, p.name);
                  return (
                    <li key={p.name} className="flex items-center gap-3 rounded-md border border-border p-2">
                      <div className="w-12 shrink-0 overflow-hidden rounded">
                        <ProductArt category={p.category} name={p.name} src={p.image_url} />
                      </div>
                      <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{p.name}</span>
                      <Button type="button" variant={added ? "secondary" : "primary"} className="shrink-0 px-3 py-1.5 text-sm" onClick={() => (added ? remove(tab, p.name) : add(tab, p))}>
                        {added ? "✓ Dipilih" : "Tambah"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Step>

          <Step n={3} title="Isi ukuran dan jumlah" hint="Isi hanya ukuran yang dibutuhkan; ukuran yang dikosongkan tidak ikut dipesan.">
            {lines.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted">Belum ada barang. Tambahkan dulu di langkah 2.</p>
            ) : (
              <div className="grid gap-4">
                {lines.map((l) => (
                  <article key={l.cat + l.name} className="grid gap-3 rounded-md border border-border p-3" aria-label={l.name}>
                    <header className="flex items-center gap-3">
                      <div className="w-12 shrink-0 overflow-hidden rounded">
                        <ProductArt category={l.category} name={l.name} src={l.image} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold leading-snug">{l.name}</h3>
                        <p className="text-xs text-muted">
                          {CATS.find((c) => c.key === l.cat)!.label} · {lineTotal(l)} {CATS.find((c) => c.key === l.cat)!.unit}
                        </p>
                      </div>
                      <Button type="button" variant="secondary" className="shrink-0 px-3 py-1.5 text-sm" onClick={() => remove(l.cat, l.name)}>
                        Hapus
                      </Button>
                    </header>
                    {l.cat === "aksesoris" ? (
                      <div className="max-w-[9rem]">
                        <QtyTile label="Jumlah" value={l.qty.qty ?? 0} aria={"Jumlah " + l.name} onChange={(n) => setQty(l.cat, l.name, "qty", n)} />
                      </div>
                    ) : (
                      SIZE_GROUPS[l.cat].map((g) => (
                        <fieldset key={g.key} className="grid gap-1.5">
                          <legend className="mb-1 text-sm font-medium">{g.label}</legend>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-6">
                            {g.sizes.map((s) => (
                              <QtyTile key={s} label={s} value={l.qty[g.key + ":" + s] ?? 0} aria={l.name + ", " + g.label.toLowerCase() + " " + s} onChange={(n) => setQty(l.cat, l.name, g.key + ":" + s, n)} />
                            ))}
                          </div>
                        </fieldset>
                      ))
                    )}
                  </article>
                ))}
              </div>
            )}
          </Step>

          <Step n={4} title="Kapan dibutuhkan?" hint="Boleh dikosongkan.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Dibutuhkan paling lambat" name="deadline" type="date" />
              <TextField label="Catatan tambahan" name="notes" placeholder="Mis. warna, bordir nama, alamat kirim" />
            </div>
          </Step>
        </div>

        <aside className="grid gap-3 rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-32" aria-label="Ringkasan pesanan">
          <h2 className="text-base font-semibold">Ringkasan pesanan</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted">Belum ada barang dipilih.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {lines.map((l) => {
                const c = CATS.find((x) => x.key === l.cat)!;
                const n = lineTotal(l);
                return (
                  <li key={l.cat + l.name} className="flex justify-between gap-3">
                    <span className="min-w-0 leading-snug">{l.name}</span>
                    <span className={"shrink-0 font-medium " + (n === 0 ? "text-danger" : "")}>
                      {n} {c.unit}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <dl className="grid gap-1 border-t border-border pt-3 text-sm">
            {totals.map((t) => (
              <div key={t.key} className="flex justify-between">
                <dt className="text-muted">
                  {t.label} ({t.kinds} jenis)
                </dt>
                <dd className="font-semibold">
                  {t.n} {t.unit}
                </dd>
              </div>
            ))}
          </dl>
          {error && (
            <p role="alert" className="rounded-md bg-red-50 p-2.5 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit">Kirim permintaan via WhatsApp</Button>
          {sent && <p role="status" className="text-sm text-muted">WhatsApp terbuka di tab baru. Bila tidak terbuka, izinkan pop-up lalu kirim ulang.</p>}
        </aside>
      </div>
    </form>
  );
}
