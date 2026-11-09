"use client";

import { Select } from "@/components/ui";
import { PANTS_SIZES, SHIRT_SIZES, sizeLabel } from "@/lib/shop";

export interface Sizes {
  shirt: string;
  pants: string;
}

export const EMPTY_SIZES: Sizes = { shirt: "", pants: "" };

/** Samakan panjang daftar ukuran dengan jumlah beli; baris baru kosong. */
export function resizeSizes(list: Sizes[], n: number): Sizes[] {
  return Array.from({ length: n }, (_, i) => list[i] ?? EMPTY_SIZES);
}

export const sizesComplete = (list: Sizes[]) => list.every((s) => s.shirt && s.pants);

/** Kelompokkan potongan dengan ukuran sama menjadi satu baris keranjang. */
export function groupSizes(list: Sizes[]): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of list) {
    const k = sizeLabel(s.shirt, s.pants);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([label, count]) => ({ label, count }));
}

export function SizeRows({ value, onChange, error }: { value: Sizes[]; onChange: (v: Sizes[]) => void; error?: boolean }) {
  const set = (i: number, patch: Partial<Sizes>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Pilih ukuran tiap seragam</p>
        {value.length > 1 && (
          <button type="button" onClick={() => onChange(value.map(() => value[0]))} className="text-sm font-medium text-accent hover:underline">
            Samakan semua dengan no. 1
          </button>
        )}
      </div>
      <ul className="grid max-h-64 gap-2 overflow-y-auto pr-1">
        {value.map((s, i) => (
          <li key={i} className="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-2">
            <span className="text-sm text-muted">Seragam {i + 1}</span>
            <Select aria-label={"Ukuran baju seragam " + (i + 1)} value={s.shirt} onChange={(e) => set(i, { shirt: e.target.value })} aria-invalid={error && !s.shirt}>
              <option value="">Baju</option>
              {SHIRT_SIZES.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </Select>
            <Select aria-label={"Ukuran celana seragam " + (i + 1)} value={s.pants} onChange={(e) => set(i, { pants: e.target.value })} aria-invalid={error && !s.pants}>
              <option value="">Celana</option>
              {PANTS_SIZES.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
      {error && !sizesComplete(value) && (
        <p className="text-sm text-danger" role="alert">Lengkapi ukuran baju dan celana untuk setiap seragam.</p>
      )}
    </div>
  );
}
